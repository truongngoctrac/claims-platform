import { ElasticsearchClusterService, defaultClusterConfigs } from './ElasticsearchClusterService';
import { IndexManagementService } from './IndexManagementService';
import { SearchQueryOptimizationService } from './SearchQueryOptimizationService';
import { FacetedSearchService } from './FacetedSearchService';
import { AutoCompleteService } from './AutoCompleteService';
import { SearchAnalyticsService } from './SearchAnalyticsService';
import { RelevanceScoringService } from './RelevanceScoringService';
import { SearchSuggestionService } from './SearchSuggestionService';
import { MultiLanguageSearchService } from './MultiLanguageSearchService';
import { SearchPerformanceMonitoringService } from './SearchPerformanceMonitoringService';
import winston from 'winston';

interface SearchServiceConfig {
  elasticsearch: {
    nodes: string[];
    auth?: {
      username: string;
      password: string;
    };
    ssl?: {
      enabled: boolean;
      ca?: string;
      cert?: string;
      key?: string;
    };
  };
  analytics: {
    enabled: boolean;
    indexName?: string;
  };
  performance: {
    monitoring: boolean;
    slowQueryThreshold: number;
  };
  multiLanguage: {
    enabled: boolean;
    defaultLanguage: string;
    supportedLanguages: string[];
  };
}

interface UnifiedSearchRequest {
  query: string;
  index: string;
  from?: number;
  size?: number;
  filters?: any[];
  facets?: { [name: string]: any };
  sort?: any[];
  highlight?: any;
  language?: string;
  autoComplete?: boolean;
  suggestions?: boolean;
  analytics?: {
    trackSearch: boolean;
    userId?: string;
    sessionId?: string;
  };
}

interface UnifiedSearchResponse {
  hits: {
    total: { value: number; relation: string };
    hits: any[];
    max_score?: number;
  };
  facets?: { [name: string]: any };
  suggestions?: any[];
  autoComplete?: any[];
  aggregations?: any;
  took: number;
  optimization?: {
    applied: string[];
    improvement: number;
  };
  analytics?: {
    tracked: boolean;
    queryId?: string;
  };
  language?: {
    detected?: string;
    used: string[];
  };
}

export class SearchService {
  private clusterService: ElasticsearchClusterService;
  private indexManagement: IndexManagementService;
  private queryOptimization: SearchQueryOptimizationService;
  private facetedSearch: FacetedSearchService;
  private autoComplete: AutoCompleteService;
  private analytics: SearchAnalyticsService;
  private relevanceScoring: RelevanceScoringService;
  private suggestions: SearchSuggestionService;
  private multiLanguage: MultiLanguageSearchService;
  private performanceMonitoring: SearchPerformanceMonitoringService;
  private logger: winston.Logger;
  private config: SearchServiceConfig;

  constructor(config: SearchServiceConfig) {
    this.config = config;

    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { service: 'search-service' },
      transports: [
        new winston.transports.File({ filename: 'logs/search-service-error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/search-service-combined.log' }),
        new winston.transports.Console({ format: winston.format.simple() })
      ]
    });

    // Initialize services asynchronously to not block constructor
    this.initializeServices().catch(error => {
      this.logger.error('Failed to initialize search services:', error);
    });
  }

  private async initializeServices(): Promise<void> {
    try {
      // Initialize cluster service
      this.clusterService = new ElasticsearchClusterService(this.config.elasticsearch);

      // Test connection but don't fail if it's not available in development
      try {
        await this.clusterService.ping();
        this.logger.info('Elasticsearch cluster connection successful');
      } catch (pingError) {
        this.logger.warn('Elasticsearch cluster not available:', pingError);
        if (process.env.NODE_ENV === 'production') {
          throw pingError;
        }
        // In development, continue without Elasticsearch
        this.logger.info('Continuing in development mode without Elasticsearch');
        return;
      }

      // Initialize all sub-services
      this.indexManagement = new IndexManagementService(this.clusterService);
      this.queryOptimization = new SearchQueryOptimizationService(this.clusterService);
      this.facetedSearch = new FacetedSearchService(this.clusterService);
      this.autoComplete = new AutoCompleteService(this.clusterService);
      this.relevanceScoring = new RelevanceScoringService(this.clusterService);
      this.suggestions = new SearchSuggestionService(this.clusterService);
      this.multiLanguage = new MultiLanguageSearchService(this.clusterService);

      if (this.config.analytics.enabled) {
        this.analytics = new SearchAnalyticsService(
          this.clusterService,
          this.config.analytics.indexName
        );
      }

      if (this.config.performance.monitoring) {
        this.performanceMonitoring = new SearchPerformanceMonitoringService(this.clusterService);
      }

      this.logger.info('Search service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize search service:', error);
      throw error;
    }
  }

  async search(request: UnifiedSearchRequest): Promise<UnifiedSearchResponse> {
    const startTime = Date.now();
    let queryId: string | undefined;

    // Check if cluster service is available
    if (!this.clusterService) {
      throw new Error('Search service not available - Elasticsearch cluster not connected');
    }

    try {
      const {
        query,
        index,
        from = 0,
        size = 20,
        filters = [],
        facets,
        sort,
        highlight,
        language,
        autoComplete = false,
        suggestions = false,
        analytics = { trackSearch: true }
      } = request;

      // Build base search query
      let searchQuery: any = {
        query: {
          multi_match: {
            query,
            fields: ['title^2', 'content', 'tags'],
            type: 'best_fields',
            operator: 'or'
          }
        },
        from,
        size,
        sort,
        highlight
      };

      // Apply filters
      if (filters.length > 0) {
        searchQuery.query = {
          bool: {
            must: [searchQuery.query],
            filter: filters
          }
        };
      }

      // Language-specific processing
      let detectedLanguage: string | undefined;
      let usedLanguages: string[] = [];
      
      if (this.config.multiLanguage.enabled) {
        const langRequest = {
          originalQuery: query,
          sourceLanguage: language || this.config.multiLanguage.defaultLanguage,
          autoDetectLanguage: !language,
          crossLanguageSearch: true,
          targetLanguages: this.config.multiLanguage.supportedLanguages
        };
        
        const langResult = await this.multiLanguage.search(index, langRequest);
        if (langResult.detectedLanguage) {
          detectedLanguage = langResult.detectedLanguage.language;
        }
        usedLanguages = langResult.searchedLanguages;
        
        // Use the optimized multi-language query
        searchQuery = langResult.hits;
      }

      // Apply query optimization
      const optimizedQuery = await this.queryOptimization.optimizeQuery(searchQuery, index);
      searchQuery = optimizedQuery.optimized;

      // Apply relevance scoring
      const scoredResult = await this.relevanceScoring.applyScoring(index, searchQuery);

      // Handle faceted search
      let facetResults: any = {};
      if (facets) {
        const facetRequest = {
          query: searchQuery.query,
          facets,
          filters,
          from,
          size,
          sort,
          highlight
        };
        
        const facetedResult = await this.facetedSearch.search(index, facetRequest);
        facetResults = facetedResult.facets;
        
        // Merge results
        scoredResult.hits = facetedResult.hits;
        scoredResult.aggregations = facetedResult.aggregations;
      }

      // Get auto-complete suggestions
      let autoCompleteResults: any[] = [];
      if (autoComplete) {
        const autoCompleteRequest = {
          text: query,
          size: 5
        };
        
        const autoCompleteConfig = {
          field: 'title.completion',
          size: 5,
          fuzziness: 'AUTO'
        };
        
        const autoCompleteResponse = await this.autoComplete.suggest(
          index,
          autoCompleteRequest,
          autoCompleteConfig
        );
        autoCompleteResults = autoCompleteResponse.suggestions;
      }

      // Get search suggestions
      let suggestionResults: any[] = [];
      if (suggestions) {
        const suggestionRequest = {
          text: query,
          configs: [
            { type: 'completion' as const, field: 'title.completion', size: 5 },
            { type: 'phrase' as const, field: 'content', size: 3 }
          ],
          includePopular: true,
          includeTrending: true
        };
        
        const suggestionResponse = await this.suggestions.getSuggestions(index, suggestionRequest);
        suggestionResults = suggestionResponse.suggestions;
      }

      const executionTime = Date.now() - startTime;

      // Track analytics
      if (this.config.analytics.enabled && analytics.trackSearch) {
        queryId = await this.trackSearchAnalytics({
          query,
          index,
          executionTime,
          totalHits: scoredResult.hits.total.value,
          userId: analytics.userId,
          sessionId: analytics.sessionId
        });
      }

      // Record performance metrics
      if (this.config.performance.monitoring) {
        await this.performanceMonitoring.recordQueryMetrics({
          indexName: index,
          query: searchQuery,
          executionTime,
          totalHits: scoredResult.hits.total.value,
          shardsQueried: scoredResult._shards?.total || 0,
          shardsSuccessful: scoredResult._shards?.successful || 0,
          shardsFailed: scoredResult._shards?.failed || 0,
          peakMemoryUsage: 0, // Would need to be collected from cluster stats
          cacheHits: 0,
          cacheMisses: 0,
          slowQuery: executionTime > this.config.performance.slowQueryThreshold,
          errorOccurred: false,
          userId: analytics.userId,
          sessionId: analytics.sessionId
        });
      }

      const response: UnifiedSearchResponse = {
        hits: scoredResult.hits,
        facets: Object.keys(facetResults).length > 0 ? facetResults : undefined,
        suggestions: suggestionResults.length > 0 ? suggestionResults : undefined,
        autoComplete: autoCompleteResults.length > 0 ? autoCompleteResults : undefined,
        aggregations: scoredResult.aggregations,
        took: executionTime,
        optimization: optimizedQuery.optimizations.length > 0 ? {
          applied: optimizedQuery.optimizations,
          improvement: optimizedQuery.estimatedImprovement
        } : undefined,
        analytics: this.config.analytics.enabled ? {
          tracked: analytics.trackSearch,
          queryId
        } : undefined,
        language: this.config.multiLanguage.enabled ? {
          detected: detectedLanguage,
          used: usedLanguages
        } : undefined
      };

      return response;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      // Record error metrics
      if (this.config.performance.monitoring) {
        await this.performanceMonitoring.recordQueryMetrics({
          indexName: request.index,
          query: request.query,
          executionTime,
          totalHits: 0,
          shardsQueried: 0,
          shardsSuccessful: 0,
          shardsFailed: 1,
          peakMemoryUsage: 0,
          cacheHits: 0,
          cacheMisses: 0,
          slowQuery: false,
          errorOccurred: true,
          errorMessage: error.message,
          userId: request.analytics?.userId,
          sessionId: request.analytics?.sessionId
        });
      }

      this.logger.error('Search failed:', error);
      throw error;
    }
  }

  private async trackSearchAnalytics(data: {
    query: string;
    index: string;
    executionTime: number;
    totalHits: number;
    userId?: string;
    sessionId?: string;
  }): Promise<string> {
    const searchEvent = {
      eventType: 'search' as const,
      sessionId: data.sessionId || 'anonymous',
      userId: data.userId,
      query: data.query,
      results: {
        totalHits: data.totalHits,
        tookMs: data.executionTime,
        maxScore: 0
      }
    };

    await this.analytics.trackSearchEvent(searchEvent);
    return searchEvent.sessionId + '-' + Date.now();
  }

  // Expose individual service methods
  async createIndex(indexName: string, settings: any, mappings: any): Promise<any> {
    if (!this.indexManagement) {
      throw new Error('Index management service not available');
    }
    return this.indexManagement.createIndex(indexName, settings, mappings);
  }

  async deleteIndex(indexName: string): Promise<any> {
    if (!this.indexManagement) {
      throw new Error('Index management service not available');
    }
    return this.indexManagement.deleteIndex(indexName);
  }

  async getIndexStats(indexName?: string): Promise<any> {
    if (!this.indexManagement) {
      throw new Error('Index management service not available');
    }
    return this.indexManagement.getIndexStats(indexName);
  }

  async optimizeIndex(indexName: string, maxSegments?: number): Promise<any> {
    if (!this.indexManagement) {
      throw new Error('Index management service not available');
    }
    return this.indexManagement.optimizeIndex(indexName, maxSegments);
  }

  async getClusterHealth(): Promise<any> {
    if (!this.clusterService) {
      throw new Error('Cluster service not available');
    }
    return this.clusterService.getClusterHealth();
  }

  async getSearchMetrics(timeRange: { from: Date; to: Date }): Promise<any> {
    if (!this.config.analytics.enabled) {
      throw new Error('Analytics not enabled');
    }
    return this.analytics.getSearchMetrics(timeRange);
  }

  async getPerformanceReport(period: 'hour' | 'day' | 'week' | 'month' = 'day'): Promise<any> {
    if (!this.config.performance.monitoring) {
      throw new Error('Performance monitoring not enabled');
    }
    return this.performanceMonitoring.getPerformanceReport(period);
  }

  async createScoringModel(model: any): Promise<any> {
    return this.relevanceScoring.createScoringModel(model);
  }

  async setActiveScoringModel(modelId: string): Promise<void> {
    return this.relevanceScoring.setActiveModel(modelId);
  }

  async getScoringModels(): Promise<any[]> {
    return this.relevanceScoring.getAllModels();
  }

  async buildAutoCompleteIndex(sourceIndex: string, completionIndex: string, config: any): Promise<void> {
    return this.autoComplete.buildCompletionIndex(sourceIndex, completionIndex, config);
  }

  async updatePopularQueries(queries: any[]): Promise<void> {
    return this.suggestions.updatePopularQueries(queries);
  }

  async setupLanguageAnalyzers(indexName: string): Promise<void> {
    if (!this.config.multiLanguage.enabled) {
      throw new Error('Multi-language support not enabled');
    }
    return this.multiLanguage.setupLanguageAnalyzers(indexName);
  }

  async getSupportedLanguages(): Promise<any[]> {
    if (!this.config.multiLanguage.enabled) {
      throw new Error('Multi-language support not enabled');
    }
    return this.multiLanguage.getSupportedLanguages();
  }

  async getActiveAlerts(): Promise<any[]> {
    if (!this.config.performance.monitoring) {
      throw new Error('Performance monitoring not enabled');
    }
    return this.performanceMonitoring.getActiveAlerts();
  }

  async resolveAlert(alertId: string): Promise<void> {
    if (!this.config.performance.monitoring) {
      throw new Error('Performance monitoring not enabled');
    }
    return this.performanceMonitoring.resolveAlert(alertId);
  }

  async cleanup(): Promise<void> {
    try {
      if (this.analytics) {
        await this.analytics.cleanup();
      }
      
      if (this.performanceMonitoring) {
        await this.performanceMonitoring.stop();
      }
      
      await this.clusterService.close();
      
      this.logger.info('Search service cleanup completed');
    } catch (error) {
      this.logger.error('Error during cleanup:', error);
      throw error;
    }
  }
}

// Factory function for creating search service
export function createSearchService(config: SearchServiceConfig): SearchService {
  return new SearchService(config);
}

// Default configuration
export const defaultSearchConfig: SearchServiceConfig = {
  elasticsearch: {
    nodes: process.env.NODE_ENV === 'production' 
      ? defaultClusterConfigs.production.nodes 
      : defaultClusterConfigs.development.nodes,
    auth: process.env.NODE_ENV === 'production' ? {
      username: process.env.ELASTICSEARCH_USERNAME || 'elastic',
      password: process.env.ELASTICSEARCH_PASSWORD || 'changeme'
    } : undefined,
    ssl: process.env.NODE_ENV === 'production' ? {
      enabled: true,
      ca: process.env.ELASTICSEARCH_CA_CERT
    } : undefined
  },
  analytics: {
    enabled: true,
    indexName: 'search-analytics'
  },
  performance: {
    monitoring: true,
    slowQueryThreshold: 1000 // 1 second
  },
  multiLanguage: {
    enabled: true,
    defaultLanguage: 'en',
    supportedLanguages: ['en', 'vi', 'zh', 'ja', 'ko', 'fr', 'de', 'es']
  }
};
