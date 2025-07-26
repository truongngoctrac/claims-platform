import { Client } from '@elastic/elasticsearch';
import winston from 'winston';
import { ElasticsearchClusterService } from './ElasticsearchClusterService';

interface IndexSettings {
  numberOfShards: number;
  numberOfReplicas: number;
  refreshInterval: string;
  maxResultWindow: number;
  analysis?: {
    analyzer?: Record<string, any>;
    tokenizer?: Record<string, any>;
    filter?: Record<string, any>;
    normalizer?: Record<string, any>;
  };
  codec?: string;
  routing?: {
    allocation?: {
      include?: Record<string, string>;
      exclude?: Record<string, string>;
      require?: Record<string, string>;
    };
  };
  translog?: {
    sync_interval?: string;
    durability?: 'request' | 'async';
  };
  merge?: {
    policy?: {
      max_merge_at_once?: number;
      segments_per_tier?: number;
    };
  };
}

interface IndexMapping {
  properties: Record<string, any>;
  dynamic?: boolean | 'strict';
  dynamic_templates?: Array<Record<string, any>>;
  meta?: Record<string, any>;
}

interface IndexTemplate {
  name: string;
  index_patterns: string[];
  template: {
    settings: IndexSettings;
    mappings: IndexMapping;
    aliases?: Record<string, any>;
  };
  priority?: number;
  version?: number;
  composed_of?: string[];
}

interface IndexStats {
  indexName: string;
  health: 'green' | 'yellow' | 'red';
  status: 'open' | 'close';
  primaryShards: number;
  replicaShards: number;
  docsCount: number;
  docsDeleted: number;
  storeSize: string;
  primaryStoreSize: string;
}

interface OptimizationMetrics {
  indexName: string;
  segmentCount: number;
  memoryUsage: number;
  searchLatency: number;
  indexingLatency: number;
  cacheHitRatio: number;
  recommendedActions: string[];
}

export class IndexManagementService {
  private client: Client;
  private logger: winston.Logger;
  private clusterService: ElasticsearchClusterService;

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
      defaultMeta: { service: 'index-management' },
      transports: [
        new winston.transports.File({ filename: 'logs/index-management-error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/index-management-combined.log' }),
        new winston.transports.Console({ format: winston.format.simple() })
      ]
    });
  }

  async createIndex(indexName: string, settings: IndexSettings, mappings: IndexMapping): Promise<any> {
    try {
      const indexExists = await this.indexExists(indexName);
      if (indexExists) {
        throw new Error(`Index ${indexName} already exists`);
      }

      const response = await this.client.indices.create({
        index: indexName,
        body: {
          settings,
          mappings
        }
      });

      this.logger.info(`Index created successfully: ${indexName}`);
      return response.body;
    } catch (error) {
      this.logger.error(`Failed to create index ${indexName}:`, error);
      throw error;
    }
  }

  async deleteIndex(indexName: string): Promise<any> {
    try {
      const response = await this.client.indices.delete({
        index: indexName,
        ignore_unavailable: true
      });

      this.logger.info(`Index deleted successfully: ${indexName}`);
      return response.body;
    } catch (error) {
      this.logger.error(`Failed to delete index ${indexName}:`, error);
      throw error;
    }
  }

  async indexExists(indexName: string): Promise<boolean> {
    try {
      const response = await this.client.indices.exists({
        index: indexName
      });
      return response.body;
    } catch (error) {
      this.logger.error(`Failed to check if index exists ${indexName}:`, error);
      return false;
    }
  }

  async updateIndexSettings(indexName: string, settings: Partial<IndexSettings>): Promise<any> {
    try {
      const response = await this.client.indices.putSettings({
        index: indexName,
        body: {
          settings
        }
      });

      this.logger.info(`Index settings updated successfully: ${indexName}`);
      return response.body;
    } catch (error) {
      this.logger.error(`Failed to update index settings ${indexName}:`, error);
      throw error;
    }
  }

  async updateIndexMapping(indexName: string, mappings: Partial<IndexMapping>): Promise<any> {
    try {
      const response = await this.client.indices.putMapping({
        index: indexName,
        body: mappings
      });

      this.logger.info(`Index mapping updated successfully: ${indexName}`);
      return response.body;
    } catch (error) {
      this.logger.error(`Failed to update index mapping ${indexName}:`, error);
      throw error;
    }
  }

  async createIndexTemplate(template: IndexTemplate): Promise<any> {
    try {
      const response = await this.client.indices.putIndexTemplate({
        name: template.name,
        body: {
          index_patterns: template.index_patterns,
          template: template.template,
          priority: template.priority || 100,
          version: template.version || 1,
          composed_of: template.composed_of || []
        }
      });

      this.logger.info(`Index template created successfully: ${template.name}`);
      return response.body;
    } catch (error) {
      this.logger.error(`Failed to create index template ${template.name}:`, error);
      throw error;
    }
  }

  async getIndexStats(indexName?: string): Promise<IndexStats[]> {
    try {
      const response = await this.client.indices.stats({
        index: indexName || '*',
        metric: ['docs', 'store']
      });

      const indices = response.body.indices;
      const healthResponse = await this.client.cluster.health({
        index: indexName || '*',
        level: 'indices'
      });

      const healthData = healthResponse.body.indices;

      return Object.keys(indices).map(name => ({
        indexName: name,
        health: healthData[name]?.status || 'unknown' as any,
        status: indices[name].status || 'unknown' as any,
        primaryShards: indices[name].primaries?.docs?.count || 0,
        replicaShards: indices[name].total?.docs?.count - indices[name].primaries?.docs?.count || 0,
        docsCount: indices[name].total?.docs?.count || 0,
        docsDeleted: indices[name].total?.docs?.deleted || 0,
        storeSize: this.formatBytes(indices[name].total?.store?.size_in_bytes || 0),
        primaryStoreSize: this.formatBytes(indices[name].primaries?.store?.size_in_bytes || 0)
      }));
    } catch (error) {
      this.logger.error('Failed to get index stats:', error);
      throw error;
    }
  }

  async optimizeIndex(indexName: string, maxSegments: number = 1): Promise<any> {
    try {
      const response = await this.client.indices.forcemerge({
        index: indexName,
        max_num_segments: maxSegments,
        only_expunge_deletes: false,
        flush: true
      });

      this.logger.info(`Index optimization completed: ${indexName}`);
      return response.body;
    } catch (error) {
      this.logger.error(`Failed to optimize index ${indexName}:`, error);
      throw error;
    }
  }

  async refreshIndex(indexName: string): Promise<any> {
    try {
      const response = await this.client.indices.refresh({
        index: indexName
      });

      this.logger.info(`Index refreshed successfully: ${indexName}`);
      return response.body;
    } catch (error) {
      this.logger.error(`Failed to refresh index ${indexName}:`, error);
      throw error;
    }
  }

  async flushIndex(indexName: string): Promise<any> {
    try {
      const response = await this.client.indices.flush({
        index: indexName,
        force: false,
        wait_if_ongoing: true
      });

      this.logger.info(`Index flushed successfully: ${indexName}`);
      return response.body;
    } catch (error) {
      this.logger.error(`Failed to flush index ${indexName}:`, error);
      throw error;
    }
  }

  async clearCache(indexName: string, cacheTypes: string[] = ['query', 'fielddata', 'request']): Promise<any> {
    try {
      const response = await this.client.indices.clearCache({
        index: indexName,
        query: cacheTypes.includes('query'),
        fielddata: cacheTypes.includes('fielddata'),
        request: cacheTypes.includes('request')
      });

      this.logger.info(`Cache cleared successfully for index: ${indexName}`);
      return response.body;
    } catch (error) {
      this.logger.error(`Failed to clear cache for index ${indexName}:`, error);
      throw error;
    }
  }

  async reindexData(sourceIndex: string, destIndex: string, query?: any): Promise<any> {
    try {
      const response = await this.client.reindex({
        body: {
          source: {
            index: sourceIndex,
            query: query || { match_all: {} }
          },
          dest: {
            index: destIndex
          }
        },
        wait_for_completion: false,
        requests_per_second: 1000
      });

      this.logger.info(`Reindexing started from ${sourceIndex} to ${destIndex}`);
      return response.body;
    } catch (error) {
      this.logger.error(`Failed to reindex from ${sourceIndex} to ${destIndex}:`, error);
      throw error;
    }
  }

  async getOptimizationMetrics(indexName: string): Promise<OptimizationMetrics> {
    try {
      const [statsResponse, segmentsResponse] = await Promise.all([
        this.client.indices.stats({ index: indexName }),
        this.client.indices.segments({ index: indexName })
      ]);

      const stats = statsResponse.body.indices[indexName];
      const segments = segmentsResponse.body.indices[indexName];

      const segmentCount = Object.values(segments.shards).flat().length;
      const memoryUsage = stats.total.segments.memory_in_bytes || 0;
      const searchLatency = stats.total.search.query_time_in_millis / Math.max(stats.total.search.query_total, 1);
      const indexingLatency = stats.total.indexing.index_time_in_millis / Math.max(stats.total.indexing.index_total, 1);
      const cacheHitRatio = stats.total.query_cache.hit_count / Math.max(stats.total.query_cache.hit_count + stats.total.query_cache.miss_count, 1);

      const recommendedActions = this.generateOptimizationRecommendations({
        segmentCount,
        memoryUsage,
        searchLatency,
        indexingLatency,
        cacheHitRatio
      });

      return {
        indexName,
        segmentCount,
        memoryUsage,
        searchLatency,
        indexingLatency,
        cacheHitRatio,
        recommendedActions
      };
    } catch (error) {
      this.logger.error(`Failed to get optimization metrics for ${indexName}:`, error);
      throw error;
    }
  }

  private generateOptimizationRecommendations(metrics: {
    segmentCount: number;
    memoryUsage: number;
    searchLatency: number;
    indexingLatency: number;
    cacheHitRatio: number;
  }): string[] {
    const recommendations: string[] = [];

    if (metrics.segmentCount > 100) {
      recommendations.push('Consider force merging to reduce segment count');
    }

    if (metrics.memoryUsage > 1000000000) { // 1GB
      recommendations.push('High memory usage detected, consider optimizing field mappings');
    }

    if (metrics.searchLatency > 100) {
      recommendations.push('High search latency, consider adding more replicas or optimizing queries');
    }

    if (metrics.indexingLatency > 50) {
      recommendations.push('High indexing latency, consider adjusting refresh interval');
    }

    if (metrics.cacheHitRatio < 0.8) {
      recommendations.push('Low cache hit ratio, consider warming up caches or optimizing queries');
    }

    return recommendations;
  }

  async createAlias(indexName: string, aliasName: string): Promise<any> {
    try {
      const response = await this.client.indices.putAlias({
        index: indexName,
        name: aliasName
      });

      this.logger.info(`Alias created: ${aliasName} -> ${indexName}`);
      return response.body;
    } catch (error) {
      this.logger.error(`Failed to create alias ${aliasName}:`, error);
      throw error;
    }
  }

  async deleteAlias(indexName: string, aliasName: string): Promise<any> {
    try {
      const response = await this.client.indices.deleteAlias({
        index: indexName,
        name: aliasName
      });

      this.logger.info(`Alias deleted: ${aliasName}`);
      return response.body;
    } catch (error) {
      this.logger.error(`Failed to delete alias ${aliasName}:`, error);
      throw error;
    }
  }

  async atomicAliasSwitch(oldIndex: string, newIndex: string, aliasName: string): Promise<any> {
    try {
      const response = await this.client.indices.updateAliases({
        body: {
          actions: [
            { remove: { index: oldIndex, alias: aliasName } },
            { add: { index: newIndex, alias: aliasName } }
          ]
        }
      });

      this.logger.info(`Atomic alias switch completed: ${aliasName} from ${oldIndex} to ${newIndex}`);
      return response.body;
    } catch (error) {
      this.logger.error(`Failed to perform atomic alias switch:`, error);
      throw error;
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// Default index configurations for different data types
export const defaultIndexConfigs = {
  documents: {
    settings: {
      numberOfShards: 3,
      numberOfReplicas: 1,
      refreshInterval: '1s',
      maxResultWindow: 10000,
      analysis: {
        analyzer: {
          standard_html: {
            type: 'standard',
            char_filter: ['html_strip'],
            tokenizer: 'standard',
            filter: ['lowercase', 'stop']
          }
        }
      }
    },
    mappings: {
      properties: {
        title: { type: 'text', analyzer: 'standard_html' },
        content: { type: 'text', analyzer: 'standard_html' },
        created_at: { type: 'date' },
        updated_at: { type: 'date' },
        tags: { type: 'keyword' },
        category: { type: 'keyword' }
      }
    }
  },
  logs: {
    settings: {
      numberOfShards: 5,
      numberOfReplicas: 0,
      refreshInterval: '30s',
      maxResultWindow: 50000
    },
    mappings: {
      properties: {
        timestamp: { type: 'date' },
        level: { type: 'keyword' },
        message: { type: 'text' },
        source: { type: 'keyword' },
        metadata: { type: 'object', dynamic: true }
      }
    }
  }
};
