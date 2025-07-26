import { RequestHandler } from 'express';
import { AdvancedCacheSingleton } from '../services/advanced-caching/AdvancedCacheService';

// Cache Operations
export const getCacheValue: RequestHandler = async (req, res) => {
  try {
    const { key } = req.params;
    const { level, partition } = req.query;
    
    const cacheService = AdvancedCacheSingleton.getInstance();
    if (!cacheService) {
      return res.status(503).json({ error: 'Cache service not initialized' });
    }

    const value = await cacheService.get(key, {
      level: level as any,
      partition: partition as string,
    });

    res.json({ key, value, found: value !== null });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const setCacheValue: RequestHandler = async (req, res) => {
  try {
    const { key } = req.params;
    const { value, ttl, level, compression, partition, tags, dependencies } = req.body;
    
    const cacheService = AdvancedCacheSingleton.getInstance();
    if (!cacheService) {
      return res.status(503).json({ error: 'Cache service not initialized' });
    }

    await cacheService.set(key, value, {
      ttl,
      level,
      compression,
      partition,
      tags,
      dependencies,
    });

    res.json({ success: true, message: 'Value cached successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteCacheValue: RequestHandler = async (req, res) => {
  try {
    const { key } = req.params;
    const { level, partition } = req.query;
    
    const cacheService = AdvancedCacheSingleton.getInstance();
    if (!cacheService) {
      return res.status(503).json({ error: 'Cache service not initialized' });
    }

    const deleted = await cacheService.delete(key, {
      level: level as any,
      partition: partition as string,
    });

    res.json({ success: true, deleted });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const checkCacheExists: RequestHandler = async (req, res) => {
  try {
    const { key } = req.params;
    
    const cacheService = AdvancedCacheSingleton.getInstance();
    if (!cacheService) {
      return res.status(503).json({ error: 'Cache service not initialized' });
    }

    const exists = await cacheService.exists(key);

    res.json({ key, exists });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Invalidation Operations
export const invalidateByPattern: RequestHandler = async (req, res) => {
  try {
    const { pattern } = req.body;
    const { level } = req.query;
    
    const cacheService = AdvancedCacheSingleton.getInstance();
    if (!cacheService) {
      return res.status(503).json({ error: 'Cache service not initialized' });
    }

    const count = await cacheService.invalidateByPattern(pattern, level as any);

    res.json({ success: true, invalidatedCount: count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const invalidateByTag: RequestHandler = async (req, res) => {
  try {
    const { tag } = req.params;
    const { level } = req.query;
    
    const cacheService = AdvancedCacheSingleton.getInstance();
    if (!cacheService) {
      return res.status(503).json({ error: 'Cache service not initialized' });
    }

    const count = await cacheService.invalidateByTag(tag, level as any);

    res.json({ success: true, invalidatedCount: count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const invalidateByDependency: RequestHandler = async (req, res) => {
  try {
    const { dependency } = req.params;
    const { level } = req.query;
    
    const cacheService = AdvancedCacheSingleton.getInstance();
    if (!cacheService) {
      return res.status(503).json({ error: 'Cache service not initialized' });
    }

    const count = await cacheService.invalidateByDependency(dependency, level as any);

    res.json({ success: true, invalidatedCount: count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Warming Operations
export const warmCacheKeys: RequestHandler = async (req, res) => {
  try {
    const { keys, level } = req.body;
    
    const cacheService = AdvancedCacheSingleton.getInstance();
    if (!cacheService) {
      return res.status(503).json({ error: 'Cache service not initialized' });
    }

    await cacheService.warmCache(keys, level);

    res.json({ success: true, message: 'Cache warming initiated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const predictiveWarmCache: RequestHandler = async (req, res) => {
  try {
    const cacheService = AdvancedCacheSingleton.getInstance();
    if (!cacheService) {
      return res.status(503).json({ error: 'Cache service not initialized' });
    }

    await cacheService.predictiveWarming();

    res.json({ success: true, message: 'Predictive cache warming initiated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Analytics Operations
export const getCurrentCacheStats: RequestHandler = async (req, res) => {
  try {
    const cacheService = AdvancedCacheSingleton.getInstance();
    if (!cacheService) {
      return res.status(503).json({ error: 'Cache service not initialized' });
    }

    const stats = cacheService.getCurrentStats();

    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getCacheMetrics: RequestHandler = async (req, res) => {
  try {
    const { start, end } = req.query;
    
    const cacheService = AdvancedCacheSingleton.getInstance();
    if (!cacheService) {
      return res.status(503).json({ error: 'Cache service not initialized' });
    }

    const startDate = start ? new Date(start as string) : new Date(Date.now() - 24 * 60 * 60 * 1000);
    const endDate = end ? new Date(end as string) : new Date();

    const metrics = cacheService.getMetricsForTimeRange(startDate, endDate);

    res.json({ metrics, timeRange: { start: startDate, end: endDate } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getHotspotAnalysis: RequestHandler = async (req, res) => {
  try {
    const { hours = 24 } = req.query;
    
    const cacheService = AdvancedCacheSingleton.getInstance();
    if (!cacheService) {
      return res.status(503).json({ error: 'Cache service not initialized' });
    }

    const analysis = cacheService.generateHotspotAnalysis(Number(hours));

    res.json(analysis);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Backup Operations
export const createCacheBackup: RequestHandler = async (req, res) => {
  try {
    const { configId } = req.body;
    
    const cacheService = AdvancedCacheSingleton.getInstance();
    if (!cacheService) {
      return res.status(503).json({ error: 'Cache service not initialized' });
    }

    const jobId = await cacheService.createBackup(configId);

    res.json({ success: true, jobId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const restoreCacheBackup: RequestHandler = async (req, res) => {
  try {
    const { backupJobId, options } = req.body;
    
    const cacheService = AdvancedCacheSingleton.getInstance();
    if (!cacheService) {
      return res.status(503).json({ error: 'Cache service not initialized' });
    }

    const restoreJobId = await cacheService.restoreFromBackup(backupJobId, options);

    res.json({ success: true, restoreJobId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Performance Operations
export const getOptimizationRecommendations: RequestHandler = async (req, res) => {
  try {
    const cacheService = AdvancedCacheSingleton.getInstance();
    if (!cacheService) {
      return res.status(503).json({ error: 'Cache service not initialized' });
    }

    const recommendations = cacheService.getOptimizationRecommendations();

    res.json({ recommendations });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const runPerformanceBenchmark: RequestHandler = async (req, res) => {
  try {
    const { name, configurations, scenario } = req.body;
    
    const cacheService = AdvancedCacheSingleton.getInstance();
    if (!cacheService) {
      return res.status(503).json({ error: 'Cache service not initialized' });
    }

    const benchmarkId = await cacheService.runPerformanceBenchmark(name, configurations, scenario);

    res.json({ success: true, benchmarkId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Health and Monitoring
export const getCacheHealth: RequestHandler = async (req, res) => {
  try {
    const cacheService = AdvancedCacheSingleton.getInstance();
    if (!cacheService) {
      return res.status(503).json({ error: 'Cache service not initialized' });
    }

    const health = await cacheService.getHealth();

    res.json(health);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getCacheServiceInfo: RequestHandler = async (req, res) => {
  try {
    const cacheService = AdvancedCacheSingleton.getInstance();
    if (!cacheService) {
      return res.status(503).json({ error: 'Cache service not initialized' });
    }

    const info = cacheService.getServiceInfo();

    res.json(info);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Configuration Management
export const getCacheConfig: RequestHandler = async (req, res) => {
  try {
    const cacheService = AdvancedCacheSingleton.getInstance();
    if (!cacheService) {
      return res.status(503).json({ error: 'Cache service not initialized' });
    }

    const config = cacheService.getConfig();

    res.json(config);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateCacheConfig: RequestHandler = async (req, res) => {
  try {
    const updates = req.body;
    
    const cacheService = AdvancedCacheSingleton.getInstance();
    if (!cacheService) {
      return res.status(503).json({ error: 'Cache service not initialized' });
    }

    cacheService.updateConfig(updates);

    res.json({ success: true, message: 'Configuration updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const exportCacheConfig: RequestHandler = async (req, res) => {
  try {
    const cacheService = AdvancedCacheSingleton.getInstance();
    if (!cacheService) {
      return res.status(503).json({ error: 'Cache service not initialized' });
    }

    const configJson = cacheService.exportConfiguration();

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="cache-config.json"');
    res.send(configJson);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const importCacheConfig: RequestHandler = async (req, res) => {
  try {
    const { configJson } = req.body;
    
    const cacheService = AdvancedCacheSingleton.getInstance();
    if (!cacheService) {
      return res.status(503).json({ error: 'Cache service not initialized' });
    }

    await cacheService.importConfiguration(configJson);

    res.json({ success: true, message: 'Configuration imported successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Batch Operations
export const batchCacheOperations: RequestHandler = async (req, res) => {
  try {
    const { operations } = req.body;
    
    const cacheService = AdvancedCacheSingleton.getInstance();
    if (!cacheService) {
      return res.status(503).json({ error: 'Cache service not initialized' });
    }

    const results = [];

    for (const operation of operations) {
      try {
        let result;
        switch (operation.type) {
          case 'get':
            result = await cacheService.get(operation.key, operation.options);
            break;
          case 'set':
            await cacheService.set(operation.key, operation.value, operation.options);
            result = { success: true };
            break;
          case 'delete':
            result = { deleted: await cacheService.delete(operation.key, operation.options) };
            break;
          case 'exists':
            result = { exists: await cacheService.exists(operation.key) };
            break;
          default:
            result = { error: 'Unknown operation type' };
        }
        
        results.push({ operation: operation.type, key: operation.key, result });
      } catch (error) {
        results.push({ operation: operation.type, key: operation.key, error: error.message });
      }
    }

    res.json({ results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Cache Statistics Dashboard Data
export const getCacheDashboardData: RequestHandler = async (req, res) => {
  try {
    const cacheService = AdvancedCacheSingleton.getInstance();
    if (!cacheService) {
      return res.status(503).json({ error: 'Cache service not initialized' });
    }

    const [health, stats, recommendations] = await Promise.all([
      cacheService.getHealth(),
      cacheService.getCurrentStats(),
      cacheService.getOptimizationRecommendations(),
    ]);

    const hotspotAnalysis = cacheService.generateHotspotAnalysis(24);

    res.json({
      health,
      stats,
      recommendations,
      hotspotAnalysis,
      timestamp: new Date(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
