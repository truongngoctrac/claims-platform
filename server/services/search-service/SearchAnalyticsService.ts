import { Client } from '@elastic/elasticsearch';
import winston from 'winston';
import { ElasticsearchClusterService } from './ElasticsearchClusterService';

interface SearchEvent {
  eventId: string;
  eventType: 'search' | 'click' | 'view' | 'conversion' | 'pagination' | 'filter' | 'sort';
  timestamp: Date;
  sessionId: string;
  userId?: string;
  query?: string;
  filters?: { [key: string]: any };
  sort?: any[];
  pagination?: { page: number; size: number };
  results?: {
    totalHits: number;
    tookMs: number;
    maxScore: number;
  };
  clickedResult?: {
    documentId: string;
    position: number;
    score: number;
  };
  userAgent?: string;
  ipAddress?: string;
  referrer?: string;
  location?: {
    country?: string;
    city?: string;
    coordinates?: { lat: number; lon: number };
  };
}

interface SearchMetrics {
  totalSearches: number;
  uniqueUsers: number;
  averageResponseTime: number;
  clickThroughRate: number;
  bounceRate: number;
  conversionRate: number;
  popularQueries: Array<{ query: string; count: number; avgResponseTime: number }>;
  failedQueries: Array<{ query: string; errorCount: number; lastError: string }>;
  searchTrends: Array<{ date: string; searchCount: number; uniqueUsers: number }>;
  performanceMetrics: {
    p50ResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    errorRate: number;
  };
}

interface UserBehaviorAnalytics {
  userId: string;
  sessionCount: number;
  totalSearches: number;
  averageSessionDuration: number;
  searchPatterns: string[];
  preferredFilters: { [key: string]: any };
  clickThroughRate: number;
  conversionRate: number;
  lastActivity: Date;
  deviceInfo: {
    mobile: boolean;
    browser: string;
    os: string;
  };
}

interface QueryAnalytics {
  query: string;
  totalSearches: number;
  uniqueUsers: number;
  averageResponseTime: number;
  successRate: number;
  clickThroughRate: number;
  conversionRate: number;
  abandonmentRate: number;
  popularFilters: Array<{ filter: string; usage: number }>;
  resultQuality: {
    averageRelevanceScore: number;
    zeroResultsRate: number;
    lowResultsRate: number;
  };
  trends: Array<{ date: string; searchCount: number }>;
}

interface SearchFunnel {
  stage: string;
  users: number;
  dropoffRate: number;
  averageTime: number;
}

export class SearchAnalyticsService {
  private client: Client;
  private logger: winston.Logger;
  private clusterService: ElasticsearchClusterService;
  private analyticsIndex: string;
  private eventBuffer: SearchEvent[] = [];
  private bufferSize: number = 100;
  private flushInterval: number = 30000; // 30 seconds
  private flushTimer?: NodeJS.Timeout;

  constructor(clusterService: ElasticsearchClusterService, analyticsIndex: string = 'search-analytics') {
    this.clusterService = clusterService;
    this.client = clusterService.getClient();
    this.analyticsIndex = analyticsIndex;
    
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { service: 'search-analytics' },
      transports: [
        new winston.transports.File({ filename: 'logs/search-analytics-error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/search-analytics-combined.log' }),
        new winston.transports.Console({ format: winston.format.simple() })
      ]
    });

    this.initializeAnalyticsIndex();
    this.startBufferFlush();
  }

  private async initializeAnalyticsIndex(): Promise<void> {
    try {
      const indexExists = await this.client.indices.exists({ index: this.analyticsIndex });
      
      if (!indexExists.body) {
        await this.client.indices.create({
          index: this.analyticsIndex,
          body: {
            mappings: {
              properties: {
                eventId: { type: 'keyword' },
                eventType: { type: 'keyword' },
                timestamp: { type: 'date' },
                sessionId: { type: 'keyword' },
                userId: { type: 'keyword' },
                query: { 
                  type: 'text', 
                  analyzer: 'standard',
                  fields: { keyword: { type: 'keyword' } }
                },
                filters: { type: 'object', dynamic: true },
                sort: { type: 'object', dynamic: true },
                pagination: {
                  properties: {
                    page: { type: 'integer' },
                    size: { type: 'integer' }
                  }
                },
                results: {
                  properties: {
                    totalHits: { type: 'long' },
                    tookMs: { type: 'integer' },
                    maxScore: { type: 'float' }
                  }
                },
                clickedResult: {
                  properties: {
                    documentId: { type: 'keyword' },
                    position: { type: 'integer' },
                    score: { type: 'float' }
                  }
                },
                userAgent: { type: 'text' },
                ipAddress: { type: 'ip' },
                referrer: { type: 'keyword' },
                location: {
                  properties: {
                    country: { type: 'keyword' },
                    city: { type: 'keyword' },
                    coordinates: { type: 'geo_point' }
                  }
                }
              }
            },
            settings: {
              number_of_shards: 3,
              number_of_replicas: 1,
              refresh_interval: '30s'
            }
          }
        });
        
        this.logger.info(`Analytics index created: ${this.analyticsIndex}`);
      }
    } catch (error) {
      this.logger.error('Failed to initialize analytics index:', error);
      throw error;
    }
  }

  private startBufferFlush(): void {
    this.flushTimer = setInterval(() => {
      this.flushEventBuffer();
    }, this.flushInterval);
  }

  async trackSearchEvent(event: Partial<SearchEvent>): Promise<void> {
    const searchEvent: SearchEvent = {
      eventId: this.generateEventId(),
      timestamp: new Date(),
      ...event
    } as SearchEvent;

    this.eventBuffer.push(searchEvent);

    if (this.eventBuffer.length >= this.bufferSize) {
      await this.flushEventBuffer();
    }
  }

  private async flushEventBuffer(): Promise<void> {
    if (this.eventBuffer.length === 0) return;

    try {
      const bulkBody: any[] = [];
      
      for (const event of this.eventBuffer) {
        bulkBody.push({ index: { _index: this.analyticsIndex } });
        bulkBody.push(event);
      }

      await this.client.bulk({ body: bulkBody });
      this.eventBuffer = [];
      
      this.logger.debug(`Flushed ${bulkBody.length / 2} analytics events`);
    } catch (error) {
      this.logger.error('Failed to flush event buffer:', error);
    }
  }

  async getSearchMetrics(timeRange: { from: Date; to: Date }): Promise<SearchMetrics> {
    try {
      const response = await this.client.search({
        index: this.analyticsIndex,
        body: {
          size: 0,
          query: {
            bool: {
              filter: [
                { range: { timestamp: { gte: timeRange.from, lte: timeRange.to } } }
              ]
            }
          },
          aggs: {
            total_searches: {
              filter: { term: { eventType: 'search' } }
            },
            unique_users: {
              cardinality: { field: 'userId' }
            },
            avg_response_time: {
              avg: { field: 'results.tookMs' }
            },
            popular_queries: {
              filter: { term: { eventType: 'search' } },
              aggs: {
                queries: {
                  terms: {
                    field: 'query.keyword',
                    size: 20
                  },
                  aggs: {
                    avg_response_time: {
                      avg: { field: 'results.tookMs' }
                    }
                  }
                }
              }
            },
            search_trends: {
              date_histogram: {
                field: 'timestamp',
                interval: 'day'
              },
              aggs: {
                searches: {
                  filter: { term: { eventType: 'search' } }
                },
                unique_users: {
                  cardinality: { field: 'userId' }
                }
              }
            },
            clicks: {
              filter: { term: { eventType: 'click' } }
            },
            conversions: {
              filter: { term: { eventType: 'conversion' } }
            },
            response_time_percentiles: {
              percentiles: {
                field: 'results.tookMs',
                percents: [50, 95, 99]
              }
            }
          }
        }
      });

      const aggs = response.body.aggregations;
      const totalSearches = aggs.total_searches.doc_count;
      const totalClicks = aggs.clicks.doc_count;
      const totalConversions = aggs.conversions.doc_count;

      return {
        totalSearches,
        uniqueUsers: aggs.unique_users.value,
        averageResponseTime: aggs.avg_response_time.value || 0,
        clickThroughRate: totalSearches > 0 ? totalClicks / totalSearches : 0,
        bounceRate: this.calculateBounceRate(aggs),
        conversionRate: totalSearches > 0 ? totalConversions / totalSearches : 0,
        popularQueries: aggs.popular_queries.queries.buckets.map((bucket: any) => ({
          query: bucket.key,
          count: bucket.doc_count,
          avgResponseTime: bucket.avg_response_time.value || 0
        })),
        failedQueries: [], // To be implemented separately
        searchTrends: aggs.search_trends.buckets.map((bucket: any) => ({
          date: bucket.key_as_string,
          searchCount: bucket.searches.doc_count,
          uniqueUsers: bucket.unique_users.value
        })),
        performanceMetrics: {
          p50ResponseTime: aggs.response_time_percentiles.values['50.0'] || 0,
          p95ResponseTime: aggs.response_time_percentiles.values['95.0'] || 0,
          p99ResponseTime: aggs.response_time_percentiles.values['99.0'] || 0,
          errorRate: 0 // To be calculated from error events
        }
      };
    } catch (error) {
      this.logger.error('Failed to get search metrics:', error);
      throw error;
    }
  }

  private calculateBounceRate(aggs: any): number {
    // Bounce rate calculation would require session analysis
    // This is a simplified version
    return 0.25; // Placeholder
  }

  async getUserBehaviorAnalytics(userId: string): Promise<UserBehaviorAnalytics | null> {
    try {
      const response = await this.client.search({
        index: this.analyticsIndex,
        body: {
          size: 0,
          query: {
            term: { userId }
          },
          aggs: {
            session_count: {
              cardinality: { field: 'sessionId' }
            },
            total_searches: {
              filter: { term: { eventType: 'search' } }
            },
            search_patterns: {
              filter: { term: { eventType: 'search' } },
              aggs: {
                queries: {
                  terms: {
                    field: 'query.keyword',
                    size: 10
                  }
                }
              }
            },
            clicks: {
              filter: { term: { eventType: 'click' } }
            },
            conversions: {
              filter: { term: { eventType: 'conversion' } }
            },
            last_activity: {
              max: { field: 'timestamp' }
            },
            preferred_filters: {
              filter: { exists: { field: 'filters' } },
              aggs: {
                filter_usage: {
                  terms: {
                    script: {
                      source: "def filters = params._source.filters; def result = []; for (key in filters.keySet()) { result.add(key + ':' + filters[key]); } return result;",
                      lang: 'painless'
                    }
                  }
                }
              }
            }
          }
        }
      });

      if (response.body.hits.total.value === 0) return null;

      const aggs = response.body.aggregations;
      const totalSearches = aggs.total_searches.doc_count;
      const totalClicks = aggs.clicks.doc_count;
      const totalConversions = aggs.conversions.doc_count;

      return {
        userId,
        sessionCount: aggs.session_count.value,
        totalSearches,
        averageSessionDuration: 0, // Would require session duration calculation
        searchPatterns: aggs.search_patterns.queries.buckets.map((bucket: any) => bucket.key),
        preferredFilters: {}, // Would be processed from filter_usage aggregation
        clickThroughRate: totalSearches > 0 ? totalClicks / totalSearches : 0,
        conversionRate: totalSearches > 0 ? totalConversions / totalSearches : 0,
        lastActivity: new Date(aggs.last_activity.value),
        deviceInfo: {
          mobile: false, // Would be extracted from user agent
          browser: 'unknown',
          os: 'unknown'
        }
      };
    } catch (error) {
      this.logger.error('Failed to get user behavior analytics:', error);
      throw error;
    }
  }

  async getQueryAnalytics(query: string, timeRange?: { from: Date; to: Date }): Promise<QueryAnalytics> {
    try {
      const queryFilter: any = {
        bool: {
          must: [
            { term: { 'query.keyword': query } }
          ]
        }
      };

      if (timeRange) {
        queryFilter.bool.must.push({
          range: { timestamp: { gte: timeRange.from, lte: timeRange.to } }
        });
      }

      const response = await this.client.search({
        index: this.analyticsIndex,
        body: {
          size: 0,
          query: queryFilter,
          aggs: {
            total_searches: {
              filter: { term: { eventType: 'search' } }
            },
            unique_users: {
              cardinality: { field: 'userId' }
            },
            avg_response_time: {
              avg: { field: 'results.tookMs' }
            },
            clicks: {
              filter: { term: { eventType: 'click' } }
            },
            conversions: {
              filter: { term: { eventType: 'conversion' } }
            },
            zero_results: {
              filter: {
                bool: {
                  must: [
                    { term: { eventType: 'search' } },
                    { term: { 'results.totalHits': 0 } }
                  ]
                }
              }
            },
            low_results: {
              filter: {
                bool: {
                  must: [
                    { term: { eventType: 'search' } },
                    { range: { 'results.totalHits': { gt: 0, lte: 3 } } }
                  ]
                }
              }
            },
            avg_relevance_score: {
              avg: { field: 'results.maxScore' }
            },
            trends: {
              date_histogram: {
                field: 'timestamp',
                interval: 'day'
              },
              aggs: {
                searches: {
                  filter: { term: { eventType: 'search' } }
                }
              }
            }
          }
        }
      });

      const aggs = response.body.aggregations;
      const totalSearches = aggs.total_searches.doc_count;
      const totalClicks = aggs.clicks.doc_count;
      const totalConversions = aggs.conversions.doc_count;
      const zeroResults = aggs.zero_results.doc_count;
      const lowResults = aggs.low_results.doc_count;

      return {
        query,
        totalSearches,
        uniqueUsers: aggs.unique_users.value,
        averageResponseTime: aggs.avg_response_time.value || 0,
        successRate: totalSearches > 0 ? (totalSearches - zeroResults) / totalSearches : 0,
        clickThroughRate: totalSearches > 0 ? totalClicks / totalSearches : 0,
        conversionRate: totalSearches > 0 ? totalConversions / totalSearches : 0,
        abandonmentRate: totalSearches > 0 ? zeroResults / totalSearches : 0,
        popularFilters: [], // Would require filter analysis
        resultQuality: {
          averageRelevanceScore: aggs.avg_relevance_score.value || 0,
          zeroResultsRate: totalSearches > 0 ? zeroResults / totalSearches : 0,
          lowResultsRate: totalSearches > 0 ? lowResults / totalSearches : 0
        },
        trends: aggs.trends.buckets.map((bucket: any) => ({
          date: bucket.key_as_string,
          searchCount: bucket.searches.doc_count
        }))
      };
    } catch (error) {
      this.logger.error('Failed to get query analytics:', error);
      throw error;
    }
  }

  async getSearchFunnel(timeRange: { from: Date; to: Date }): Promise<SearchFunnel[]> {
    try {
      // This would require more complex session analysis
      // Simplified version here
      const stages = [
        { stage: 'Search', users: 1000, dropoffRate: 0, averageTime: 0 },
        { stage: 'Results View', users: 800, dropoffRate: 0.2, averageTime: 5000 },
        { stage: 'Click Through', users: 400, dropoffRate: 0.5, averageTime: 10000 },
        { stage: 'Conversion', users: 80, dropoffRate: 0.8, averageTime: 120000 }
      ];

      return stages;
    } catch (error) {
      this.logger.error('Failed to get search funnel:', error);
      throw error;
    }
  }

  async getABTestResults(testId: string): Promise<any> {
    try {
      const response = await this.client.search({
        index: this.analyticsIndex,
        body: {
          size: 0,
          query: {
            exists: { field: 'abTestVariant' }
          },
          aggs: {
            variants: {
              terms: { field: 'abTestVariant' },
              aggs: {
                searches: {
                  filter: { term: { eventType: 'search' } }
                },
                clicks: {
                  filter: { term: { eventType: 'click' } }
                },
                conversions: {
                  filter: { term: { eventType: 'conversion' } }
                },
                avg_response_time: {
                  avg: { field: 'results.tookMs' }
                }
              }
            }
          }
        }
      });

      return response.body.aggregations.variants.buckets.map((bucket: any) => ({
        variant: bucket.key,
        searches: bucket.searches.doc_count,
        clicks: bucket.clicks.doc_count,
        conversions: bucket.conversions.doc_count,
        clickThroughRate: bucket.searches.doc_count > 0 ? bucket.clicks.doc_count / bucket.searches.doc_count : 0,
        conversionRate: bucket.searches.doc_count > 0 ? bucket.conversions.doc_count / bucket.searches.doc_count : 0,
        averageResponseTime: bucket.avg_response_time.value || 0
      }));
    } catch (error) {
      this.logger.error('Failed to get A/B test results:', error);
      throw error;
    }
  }

  private generateEventId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  async exportAnalytics(format: 'json' | 'csv', timeRange: { from: Date; to: Date }): Promise<any> {
    try {
      const metrics = await this.getSearchMetrics(timeRange);
      
      if (format === 'csv') {
        // Convert to CSV format
        const csvData = this.convertToCSV(metrics);
        return csvData;
      }
      
      return metrics;
    } catch (error) {
      this.logger.error('Failed to export analytics:', error);
      throw error;
    }
  }

  private convertToCSV(data: any): string {
    // Simplified CSV conversion
    const headers = Object.keys(data).join(',');
    const values = Object.values(data).map(v => 
      typeof v === 'object' ? JSON.stringify(v) : v
    ).join(',');
    
    return `${headers}\n${values}`;
  }

  async cleanup(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    await this.flushEventBuffer();
    this.logger.info('Search analytics service cleanup completed');
  }
}
