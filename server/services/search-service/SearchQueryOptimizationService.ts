import { Client } from '@elastic/elasticsearch';
import winston from 'winston';
import { ElasticsearchClusterService } from './ElasticsearchClusterService';

interface QueryPerformanceMetrics {
  queryId: string;
  query: any;
  executionTime: number;
  totalHits: number;
  maxScore: number;
  shardStats: {
    total: number;
    successful: number;
    skipped: number;
    failed: number;
  };
  suggestions: string[];
}

interface QueryOptimizationRule {
  name: string;
  condition: (query: any, metrics?: QueryPerformanceMetrics) => boolean;
  optimize: (query: any) => any;
  description: string;
  priority: number;
}

interface SearchProfile {
  took: number;
  shards: any[];
  aggregations?: any[];
}

interface OptimizedQuery {
  original: any;
  optimized: any;
  optimizations: string[];
  estimatedImprovement: number;
}

export class SearchQueryOptimizationService {
  private client: Client;
  private logger: winston.Logger;
  private clusterService: ElasticsearchClusterService;
  private optimizationRules: QueryOptimizationRule[];
  private queryCache: Map<string, any> = new Map();
  private performanceHistory: Map<string, QueryPerformanceMetrics[]> = new Map();

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
      defaultMeta: { service: 'search-query-optimization' },
      transports: [
        new winston.transports.File({ filename: 'logs/search-optimization-error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/search-optimization-combined.log' }),
        new winston.transports.Console({ format: winston.format.simple() })
      ]
    });

    this.initializeOptimizationRules();
  }

  private initializeOptimizationRules(): void {
    this.optimizationRules = [
      {
        name: 'wildcard_optimization',
        condition: (query) => this.hasWildcardQueries(query),
        optimize: (query) => this.optimizeWildcardQueries(query),
        description: 'Convert expensive wildcard queries to more efficient alternatives',
        priority: 1
      },
      {
        name: 'range_optimization',
        condition: (query) => this.hasRangeQueries(query),
        optimize: (query) => this.optimizeRangeQueries(query),
        description: 'Optimize range queries for better performance',
        priority: 2
      },
      {
        name: 'bool_query_optimization',
        condition: (query) => this.hasBoolQueries(query),
        optimize: (query) => this.optimizeBoolQueries(query),
        description: 'Optimize boolean queries by reordering clauses',
        priority: 3
      },
      {
        name: 'source_filtering',
        condition: (query) => !query._source || query._source === true,
        optimize: (query) => this.addSourceFiltering(query),
        description: 'Add source filtering to reduce data transfer',
        priority: 4
      },
      {
        name: 'highlight_optimization',
        condition: (query) => query.highlight && this.hasInfefficientHighlight(query.highlight),
        optimize: (query) => this.optimizeHighlight(query),
        description: 'Optimize highlight settings for better performance',
        priority: 5
      },
      {
        name: 'aggregation_optimization',
        condition: (query) => query.aggs && this.hasInefficientAggregations(query.aggs),
        optimize: (query) => this.optimizeAggregations(query),
        description: 'Optimize aggregations for better performance',
        priority: 6
      },
      {
        name: 'sort_optimization',
        condition: (query) => query.sort && this.hasInefficientSorting(query.sort),
        optimize: (query) => this.optimizeSorting(query),
        description: 'Optimize sorting for better performance',
        priority: 7
      },
      {
        name: 'size_optimization',
        condition: (query) => !query.size || query.size > 1000,
        optimize: (query) => this.optimizeSize(query),
        description: 'Optimize result size for better performance',
        priority: 8
      }
    ];
  }

  async optimizeQuery(originalQuery: any, indexName: string): Promise<OptimizedQuery> {
    try {
      let optimizedQuery = JSON.parse(JSON.stringify(originalQuery));
      const appliedOptimizations: string[] = [];

      // Apply optimization rules in priority order
      for (const rule of this.optimizationRules.sort((a, b) => a.priority - b.priority)) {
        if (rule.condition(optimizedQuery)) {
          optimizedQuery = rule.optimize(optimizedQuery);
          appliedOptimizations.push(rule.description);
        }
      }

      // Estimate improvement based on query complexity reduction
      const estimatedImprovement = this.estimatePerformanceImprovement(originalQuery, optimizedQuery);

      return {
        original: originalQuery,
        optimized: optimizedQuery,
        optimizations: appliedOptimizations,
        estimatedImprovement
      };
    } catch (error) {
      this.logger.error('Failed to optimize query:', error);
      throw error;
    }
  }

  async executeOptimizedSearch(indexName: string, query: any, enableProfiling: boolean = false): Promise<any> {
    try {
      const optimizedQuery = await this.optimizeQuery(query, indexName);
      
      const searchParams: any = {
        index: indexName,
        body: optimizedQuery.optimized
      };

      if (enableProfiling) {
        searchParams.body.profile = true;
      }

      const startTime = Date.now();
      const response = await this.client.search(searchParams);
      const executionTime = Date.now() - startTime;

      // Store performance metrics
      const metrics: QueryPerformanceMetrics = {
        queryId: this.generateQueryId(query),
        query: optimizedQuery.optimized,
        executionTime,
        totalHits: response.body.hits.total.value,
        maxScore: response.body.hits.max_score,
        shardStats: response.body._shards,
        suggestions: optimizedQuery.optimizations
      };

      this.storePerformanceMetrics(indexName, metrics);

      return {
        ...response.body,
        optimization_info: {
          applied_optimizations: optimizedQuery.optimizations,
          estimated_improvement: optimizedQuery.estimatedImprovement,
          execution_time: executionTime
        }
      };
    } catch (error) {
      this.logger.error('Failed to execute optimized search:', error);
      throw error;
    }
  }

  async analyzeQueryPerformance(indexName: string, query: any): Promise<QueryPerformanceMetrics> {
    try {
      const queryId = this.generateQueryId(query);
      
      const searchParams = {
        index: indexName,
        body: {
          ...query,
          profile: true
        }
      };

      const startTime = Date.now();
      const response = await this.client.search(searchParams);
      const executionTime = Date.now() - startTime;

      const profile: SearchProfile = response.body.profile;
      const suggestions = this.generatePerformanceSuggestions(profile, query);

      const metrics: QueryPerformanceMetrics = {
        queryId,
        query,
        executionTime,
        totalHits: response.body.hits.total.value,
        maxScore: response.body.hits.max_score,
        shardStats: response.body._shards,
        suggestions
      };

      this.storePerformanceMetrics(indexName, metrics);
      return metrics;
    } catch (error) {
      this.logger.error('Failed to analyze query performance:', error);
      throw error;
    }
  }

  private hasWildcardQueries(query: any): boolean {
    const queryString = JSON.stringify(query);
    return queryString.includes('"wildcard"') || queryString.includes('"regexp"');
  }

  private optimizeWildcardQueries(query: any): any {
    const optimized = JSON.parse(JSON.stringify(query));
    
    const replaceWildcards = (obj: any) => {
      for (const key in obj) {
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          if (key === 'wildcard' && typeof obj[key].value === 'string') {
            const value = obj[key].value;
            if (value.endsWith('*') && !value.includes('?')) {
              // Convert simple suffix wildcard to prefix query
              obj['prefix'] = { [Object.keys(obj[key])[0]]: value.slice(0, -1) };
              delete obj['wildcard'];
            }
          }
          replaceWildcards(obj[key]);
        }
      }
    };

    replaceWildcards(optimized);
    return optimized;
  }

  private hasRangeQueries(query: any): boolean {
    return JSON.stringify(query).includes('"range"');
  }

  private optimizeRangeQueries(query: any): any {
    const optimized = JSON.parse(JSON.stringify(query));
    
    const optimizeRanges = (obj: any) => {
      for (const key in obj) {
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          if (key === 'range') {
            // Add boost to range queries for better scoring
            for (const field in obj[key]) {
              if (!obj[key][field].boost) {
                obj[key][field].boost = 1.0;
              }
            }
          }
          optimizeRanges(obj[key]);
        }
      }
    };

    optimizeRanges(optimized);
    return optimized;
  }

  private hasBoolQueries(query: any): boolean {
    return JSON.stringify(query).includes('"bool"');
  }

  private optimizeBoolQueries(query: any): any {
    const optimized = JSON.parse(JSON.stringify(query));
    
    const optimizeBool = (obj: any) => {
      for (const key in obj) {
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          if (key === 'bool') {
            // Reorder bool clauses: filter first, then must, should, must_not
            const reorderedBool: any = {};
            if (obj[key].filter) reorderedBool.filter = obj[key].filter;
            if (obj[key].must) reorderedBool.must = obj[key].must;
            if (obj[key].should) reorderedBool.should = obj[key].should;
            if (obj[key].must_not) reorderedBool.must_not = obj[key].must_not;
            if (obj[key].minimum_should_match) reorderedBool.minimum_should_match = obj[key].minimum_should_match;
            obj[key] = reorderedBool;
          }
          optimizeBool(obj[key]);
        }
      }
    };

    optimizeBool(optimized);
    return optimized;
  }

  private addSourceFiltering(query: any): any {
    const optimized = JSON.parse(JSON.stringify(query));
    
    if (!optimized._source) {
      // Add common source fields that are typically needed
      optimized._source = ['id', 'title', 'content', 'created_at', 'updated_at'];
    }
    
    return optimized;
  }

  private hasInfefficientHighlight(highlight: any): boolean {
    return !highlight.pre_tags || !highlight.post_tags || 
           (highlight.fragment_size && highlight.fragment_size > 200) ||
           (highlight.number_of_fragments && highlight.number_of_fragments > 5);
  }

  private optimizeHighlight(query: any): any {
    const optimized = JSON.parse(JSON.stringify(query));
    
    if (optimized.highlight) {
      optimized.highlight.pre_tags = optimized.highlight.pre_tags || ['<mark>'];
      optimized.highlight.post_tags = optimized.highlight.post_tags || ['</mark>'];
      optimized.highlight.fragment_size = Math.min(optimized.highlight.fragment_size || 150, 150);
      optimized.highlight.number_of_fragments = Math.min(optimized.highlight.number_of_fragments || 3, 3);
    }
    
    return optimized;
  }

  private hasInefficientAggregations(aggs: any): boolean {
    const aggsString = JSON.stringify(aggs);
    return aggsString.includes('"size":') && (aggsString.includes('"size":0') || aggsString.includes('"size":10000'));
  }

  private optimizeAggregations(query: any): any {
    const optimized = JSON.parse(JSON.stringify(query));
    
    const optimizeAggs = (aggs: any) => {
      for (const key in aggs) {
        if (aggs[key].terms && (!aggs[key].terms.size || aggs[key].terms.size > 100)) {
          aggs[key].terms.size = 50; // Reasonable default
        }
        if (aggs[key].aggs) {
          optimizeAggs(aggs[key].aggs);
        }
      }
    };

    if (optimized.aggs) {
      optimizeAggs(optimized.aggs);
    }
    
    return optimized;
  }

  private hasInefficientSorting(sort: any): boolean {
    return Array.isArray(sort) && sort.length > 3;
  }

  private optimizeSorting(query: any): any {
    const optimized = JSON.parse(JSON.stringify(query));
    
    if (Array.isArray(optimized.sort) && optimized.sort.length > 3) {
      // Keep only the first 3 sort criteria
      optimized.sort = optimized.sort.slice(0, 3);
    }
    
    return optimized;
  }

  private optimizeSize(query: any): any {
    const optimized = JSON.parse(JSON.stringify(query));
    
    if (!optimized.size || optimized.size > 100) {
      optimized.size = 20; // Reasonable default
    }
    
    return optimized;
  }

  private estimatePerformanceImprovement(original: any, optimized: any): number {
    let improvement = 0;
    
    // Calculate improvement based on applied optimizations
    const originalComplexity = this.calculateQueryComplexity(original);
    const optimizedComplexity = this.calculateQueryComplexity(optimized);
    
    improvement = ((originalComplexity - optimizedComplexity) / originalComplexity) * 100;
    
    return Math.max(0, Math.min(100, improvement));
  }

  private calculateQueryComplexity(query: any): number {
    let complexity = 0;
    const queryString = JSON.stringify(query);
    
    // Count complex query types
    complexity += (queryString.match(/"wildcard"/g) || []).length * 10;
    complexity += (queryString.match(/"regexp"/g) || []).length * 15;
    complexity += (queryString.match(/"range"/g) || []).length * 3;
    complexity += (queryString.match(/"bool"/g) || []).length * 2;
    complexity += (queryString.match(/"nested"/g) || []).length * 8;
    complexity += (queryString.match(/"script"/g) || []).length * 20;
    
    // Add complexity for large result sets
    if (query.size && query.size > 100) {
      complexity += query.size / 10;
    }
    
    return complexity;
  }

  private generatePerformanceSuggestions(profile: SearchProfile, query: any): string[] {
    const suggestions: string[] = [];
    
    if (profile.took > 1000) {
      suggestions.push('Query took longer than 1 second, consider adding filters or reducing result size');
    }
    
    if (profile.shards && profile.shards.some((shard: any) => shard.time_in_nanos > 500000000)) {
      suggestions.push('Some shards are slow, consider optimizing index settings or query structure');
    }
    
    if (JSON.stringify(query).includes('wildcard')) {
      suggestions.push('Wildcard queries detected, consider using prefix or term queries instead');
    }
    
    if (query.size && query.size > 100) {
      suggestions.push('Large result set requested, consider using pagination');
    }
    
    return suggestions;
  }

  private generateQueryId(query: any): string {
    return Buffer.from(JSON.stringify(query)).toString('base64').substring(0, 16);
  }

  private storePerformanceMetrics(indexName: string, metrics: QueryPerformanceMetrics): void {
    const key = `${indexName}:${metrics.queryId}`;
    const history = this.performanceHistory.get(key) || [];
    history.push(metrics);
    
    // Keep only last 100 metrics per query
    if (history.length > 100) {
      history.shift();
    }
    
    this.performanceHistory.set(key, history);
  }

  async getQueryPerformanceHistory(indexName: string, queryId: string): Promise<QueryPerformanceMetrics[]> {
    const key = `${indexName}:${queryId}`;
    return this.performanceHistory.get(key) || [];
  }

  async getSlowQueries(indexName?: string, threshold: number = 1000): Promise<QueryPerformanceMetrics[]> {
    const slowQueries: QueryPerformanceMetrics[] = [];
    
    for (const [key, history] of this.performanceHistory.entries()) {
      if (indexName && !key.startsWith(`${indexName}:`)) {
        continue;
      }
      
      const latestMetrics = history[history.length - 1];
      if (latestMetrics && latestMetrics.executionTime > threshold) {
        slowQueries.push(latestMetrics);
      }
    }
    
    return slowQueries.sort((a, b) => b.executionTime - a.executionTime);
  }

  clearPerformanceHistory(): void {
    this.performanceHistory.clear();
    this.logger.info('Performance history cleared');
  }
}
