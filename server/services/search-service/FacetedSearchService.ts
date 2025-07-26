import { Client } from '@elastic/elasticsearch';
import winston from 'winston';
import { ElasticsearchClusterService } from './ElasticsearchClusterService';

interface FacetConfig {
  field: string;
  type: 'terms' | 'range' | 'date_histogram' | 'nested' | 'geo_distance';
  size?: number;
  min_doc_count?: number;
  missing?: string;
  include?: string[];
  exclude?: string[];
  order?: { [key: string]: 'asc' | 'desc' };
  ranges?: Array<{ from?: number; to?: number; key?: string }>;
  interval?: string;
  format?: string;
  time_zone?: string;
  nested_path?: string;
  origin?: { lat: number; lon: number };
  unit?: string;
  distance_type?: 'arc' | 'plane';
}

interface FacetFilter {
  field: string;
  values: string[] | number[] | { from?: number; to?: number };
  operator?: 'and' | 'or';
}

interface FacetResult {
  field: string;
  buckets: Array<{
    key: string | number;
    doc_count: number;
    from?: number;
    to?: number;
    key_as_string?: string;
  }>;
  doc_count_error_upper_bound?: number;
  sum_other_doc_count?: number;
}

interface FacetedSearchRequest {
  query?: any;
  facets: { [name: string]: FacetConfig };
  filters?: FacetFilter[];
  from?: number;
  size?: number;
  sort?: any[];
  highlight?: any;
  source?: string[] | boolean;
}

interface FacetedSearchResponse {
  hits: {
    total: { value: number; relation: string };
    hits: any[];
    max_score?: number;
  };
  facets: { [name: string]: FacetResult };
  aggregations?: any;
  took: number;
  timed_out: boolean;
}

interface FacetAnalytics {
  facetName: string;
  totalQueries: number;
  averageSelections: number;
  popularValues: Array<{ value: string; count: number }>;
  refinementRate: number;
}

export class FacetedSearchService {
  private client: Client;
  private logger: winston.Logger;
  private clusterService: ElasticsearchClusterService;
  private facetUsageStats: Map<string, any> = new Map();

  constructor(clusterService: ElasticsearchClusterService) {
    this.clusterService = clusterService;
    this.client = clusterService.getClient();
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { service: 'faceted-search' },
      transports: [
        new winston.transports.File({ filename: 'logs/faceted-search-error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/faceted-search-combined.log' }),
        new winston.transports.Console({ format: winston.format.simple() })
      ]
    });
  }

  async search(indexName: string, request: FacetedSearchRequest): Promise<FacetedSearchResponse> {
    try {
      const { query, facets, filters, from = 0, size = 20, sort, highlight, source } = request;

      // Build the main query with filters
      const searchQuery = this.buildSearchQuery(query, filters);

      // Build aggregations for facets
      const aggregations = this.buildAggregations(facets, filters);

      const searchParams: any = {
        index: indexName,
        body: {
          query: searchQuery,
          aggs: aggregations,
          from,
          size,
          sort,
          highlight,
          _source: source
        }
      };

      const startTime = Date.now();
      const response = await this.client.search(searchParams);
      const took = Date.now() - startTime;

      // Process facet results
      const facetResults = this.processFacetResults(response.body.aggregations, facets);

      // Track facet usage
      this.trackFacetUsage(facets, filters);

      return {
        hits: response.body.hits,
        facets: facetResults,
        aggregations: response.body.aggregations,
        took,
        timed_out: response.body.timed_out
      };
    } catch (error) {
      this.logger.error('Faceted search failed:', error);
      throw error;
    }
  }

  private buildSearchQuery(baseQuery?: any, filters?: FacetFilter[]): any {
    const boolQuery: any = {
      bool: {
        must: [],
        filter: []
      }
    };

    // Add base query
    if (baseQuery) {
      boolQuery.bool.must.push(baseQuery);
    } else {
      boolQuery.bool.must.push({ match_all: {} });
    }

    // Add filters
    if (filters && filters.length > 0) {
      for (const filter of filters) {
        const filterQuery = this.buildFilterQuery(filter);
        if (filterQuery) {
          boolQuery.bool.filter.push(filterQuery);
        }
      }
    }

    return boolQuery;
  }

  private buildFilterQuery(filter: FacetFilter): any {
    const { field, values, operator = 'or' } = filter;

    if (Array.isArray(values)) {
      if (values.length === 0) return null;

      if (operator === 'and') {
        return {
          bool: {
            must: values.map(value => ({ term: { [field]: value } }))
          }
        };
      } else {
        return {
          terms: { [field]: values }
        };
      }
    } else if (typeof values === 'object' && (values.from !== undefined || values.to !== undefined)) {
      // Range filter
      const rangeQuery: any = {};
      if (values.from !== undefined) rangeQuery.gte = values.from;
      if (values.to !== undefined) rangeQuery.lte = values.to;
      
      return {
        range: { [field]: rangeQuery }
      };
    }

    return null;
  }

  private buildAggregations(facets: { [name: string]: FacetConfig }, filters?: FacetFilter[]): any {
    const aggregations: any = {};

    for (const [facetName, config] of Object.entries(facets)) {
      aggregations[facetName] = this.buildFacetAggregation(config, facetName, filters);
    }

    return aggregations;
  }

  private buildFacetAggregation(config: FacetConfig, facetName: string, filters?: FacetFilter[]): any {
    const { field, type, size = 10, min_doc_count = 1 } = config;

    let aggregation: any;

    switch (type) {
      case 'terms':
        aggregation = {
          terms: {
            field,
            size,
            min_doc_count,
            missing: config.missing,
            include: config.include,
            exclude: config.exclude,
            order: config.order || { _count: 'desc' }
          }
        };
        break;

      case 'range':
        if (!config.ranges) {
          throw new Error(`Range facet ${facetName} requires ranges configuration`);
        }
        aggregation = {
          range: {
            field,
            ranges: config.ranges
          }
        };
        break;

      case 'date_histogram':
        aggregation = {
          date_histogram: {
            field,
            interval: config.interval || 'day',
            format: config.format,
            time_zone: config.time_zone,
            min_doc_count
          }
        };
        break;

      case 'nested':
        if (!config.nested_path) {
          throw new Error(`Nested facet ${facetName} requires nested_path configuration`);
        }
        aggregation = {
          nested: { path: config.nested_path },
          aggs: {
            [facetName]: {
              terms: {
                field,
                size,
                min_doc_count
              }
            }
          }
        };
        break;

      case 'geo_distance':
        if (!config.origin) {
          throw new Error(`Geo distance facet ${facetName} requires origin configuration`);
        }
        aggregation = {
          geo_distance: {
            field,
            origin: config.origin,
            unit: config.unit || 'km',
            distance_type: config.distance_type || 'arc',
            ranges: config.ranges || [
              { to: 100 },
              { from: 100, to: 300 },
              { from: 300 }
            ]
          }
        };
        break;

      default:
        throw new Error(`Unsupported facet type: ${type}`);
    }

    // Apply global filter that excludes current facet's filter
    const otherFilters = filters?.filter(f => f.field !== field) || [];
    if (otherFilters.length > 0) {
      return {
        global: {},
        aggs: {
          filtered: {
            filter: this.buildGlobalFilter(otherFilters),
            aggs: {
              [facetName]: aggregation
            }
          }
        }
      };
    }

    return aggregation;
  }

  private buildGlobalFilter(filters: FacetFilter[]): any {
    if (filters.length === 0) {
      return { match_all: {} };
    }

    const filterQueries = filters.map(filter => this.buildFilterQuery(filter)).filter(Boolean);

    if (filterQueries.length === 1) {
      return filterQueries[0];
    }

    return {
      bool: {
        must: filterQueries
      }
    };
  }

  private processFacetResults(aggregations: any, facetConfigs: { [name: string]: FacetConfig }): { [name: string]: FacetResult } {
    const results: { [name: string]: FacetResult } = {};

    for (const [facetName, config] of Object.entries(facetConfigs)) {
      let aggResult = aggregations[facetName];

      // Handle global aggregations
      if (aggResult && aggResult.filtered) {
        aggResult = aggResult.filtered[facetName];
      }

      if (!aggResult) continue;

      results[facetName] = {
        field: config.field,
        buckets: aggResult.buckets || [],
        doc_count_error_upper_bound: aggResult.doc_count_error_upper_bound,
        sum_other_doc_count: aggResult.sum_other_doc_count
      };

      // Handle nested aggregations
      if (config.type === 'nested' && aggResult[facetName]) {
        results[facetName] = {
          field: config.field,
          buckets: aggResult[facetName].buckets || [],
          doc_count_error_upper_bound: aggResult[facetName].doc_count_error_upper_bound,
          sum_other_doc_count: aggResult[facetName].sum_other_doc_count
        };
      }
    }

    return results;
  }

  private trackFacetUsage(facets: { [name: string]: FacetConfig }, filters?: FacetFilter[]): void {
    for (const facetName of Object.keys(facets)) {
      const stats = this.facetUsageStats.get(facetName) || {
        totalQueries: 0,
        selections: [],
        refinements: 0
      };

      stats.totalQueries++;

      // Track filter selections
      const facetFilter = filters?.find(f => f.field === facets[facetName].field);
      if (facetFilter && Array.isArray(facetFilter.values)) {
        stats.selections.push(...facetFilter.values);
        stats.refinements++;
      }

      this.facetUsageStats.set(facetName, stats);
    }
  }

  async getFacetAnalytics(facetName?: string): Promise<FacetAnalytics[]> {
    const analytics: FacetAnalytics[] = [];

    const facetsToAnalyze = facetName ? [facetName] : Array.from(this.facetUsageStats.keys());

    for (const name of facetsToAnalyze) {
      const stats = this.facetUsageStats.get(name);
      if (!stats) continue;

      // Calculate popular values
      const valueCounts = stats.selections.reduce((acc: any, value: any) => {
        acc[value] = (acc[value] || 0) + 1;
        return acc;
      }, {});

      const popularValues = Object.entries(valueCounts)
        .map(([value, count]) => ({ value, count: count as number }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      analytics.push({
        facetName: name,
        totalQueries: stats.totalQueries,
        averageSelections: stats.selections.length / stats.totalQueries,
        popularValues,
        refinementRate: stats.refinements / stats.totalQueries
      });
    }

    return analytics;
  }

  async suggestFacetValues(indexName: string, facetConfig: FacetConfig, prefix: string, size: number = 10): Promise<string[]> {
    try {
      const { field } = facetConfig;

      const response = await this.client.search({
        index: indexName,
        body: {
          size: 0,
          aggs: {
            suggestions: {
              terms: {
                field,
                include: `${prefix}.*`,
                size
              }
            }
          }
        }
      });

      const buckets = response.body.aggregations.suggestions.buckets;
      return buckets.map((bucket: any) => bucket.key);
    } catch (error) {
      this.logger.error('Failed to suggest facet values:', error);
      throw error;
    }
  }

  async getAvailableFacets(indexName: string): Promise<{ [field: string]: FacetConfig }> {
    try {
      const response = await this.client.indices.getMapping({
        index: indexName
      });

      const mappings = response.body[indexName].mappings.properties;
      const facets: { [field: string]: FacetConfig } = {};

      for (const [field, mapping] of Object.entries(mappings)) {
        const fieldMapping = mapping as any;
        
        if (fieldMapping.type === 'keyword' || fieldMapping.type === 'text' && fieldMapping.fields?.keyword) {
          facets[field] = {
            field: fieldMapping.fields?.keyword ? `${field}.keyword` : field,
            type: 'terms',
            size: 10
          };
        } else if (fieldMapping.type === 'date') {
          facets[field] = {
            field,
            type: 'date_histogram',
            interval: 'day'
          };
        } else if (fieldMapping.type === 'long' || fieldMapping.type === 'integer' || fieldMapping.type === 'double') {
          facets[field] = {
            field,
            type: 'range',
            ranges: [
              { to: 100 },
              { from: 100, to: 500 },
              { from: 500 }
            ]
          };
        } else if (fieldMapping.type === 'nested') {
          facets[field] = {
            field: `${field}.name`, // Assuming nested objects have a 'name' field
            type: 'nested',
            nested_path: field
          };
        } else if (fieldMapping.type === 'geo_point') {
          facets[field] = {
            field,
            type: 'geo_distance',
            origin: { lat: 0, lon: 0 }, // Default origin, should be configurable
            ranges: [
              { to: 100 },
              { from: 100, to: 300 },
              { from: 300 }
            ]
          };
        }
      }

      return facets;
    } catch (error) {
      this.logger.error('Failed to get available facets:', error);
      throw error;
    }
  }

  async optimizeFacetConfiguration(indexName: string, currentFacets: { [name: string]: FacetConfig }): Promise<{ [name: string]: FacetConfig }> {
    try {
      const analytics = await this.getFacetAnalytics();
      const optimizedFacets: { [name: string]: FacetConfig } = {};

      for (const [facetName, config] of Object.entries(currentFacets)) {
        const facetAnalytics = analytics.find(a => a.facetName === facetName);
        const optimizedConfig = { ...config };

        if (facetAnalytics) {
          // Adjust size based on popular values
          if (facetAnalytics.popularValues.length > 0) {
            optimizedConfig.size = Math.max(10, Math.min(50, facetAnalytics.popularValues.length * 2));
          }

          // Set popular values as includes if refinement rate is high
          if (facetAnalytics.refinementRate > 0.5 && facetAnalytics.popularValues.length > 0) {
            optimizedConfig.include = facetAnalytics.popularValues.slice(0, 20).map(v => v.value);
          }
        }

        optimizedFacets[facetName] = optimizedConfig;
      }

      return optimizedFacets;
    } catch (error) {
      this.logger.error('Failed to optimize facet configuration:', error);
      throw error;
    }
  }

  clearFacetUsageStats(): void {
    this.facetUsageStats.clear();
    this.logger.info('Facet usage statistics cleared');
  }
}

// Default facet configurations for common use cases
export const defaultFacetConfigs = {
  category: {
    field: 'category.keyword',
    type: 'terms' as const,
    size: 20
  },
  status: {
    field: 'status.keyword',
    type: 'terms' as const,
    size: 10
  },
  dateRange: {
    field: 'created_at',
    type: 'date_histogram' as const,
    interval: 'month',
    format: 'yyyy-MM'
  },
  priceRange: {
    field: 'price',
    type: 'range' as const,
    ranges: [
      { key: 'cheap', to: 100 },
      { key: 'medium', from: 100, to: 500 },
      { key: 'expensive', from: 500 }
    ]
  },
  tags: {
    field: 'tags.keyword',
    type: 'terms' as const,
    size: 15
  }
};
