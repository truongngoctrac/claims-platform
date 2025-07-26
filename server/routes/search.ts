import { RequestHandler } from 'express';
import { createSearchService, defaultSearchConfig } from '../services/search-service/SearchService';
import { z } from 'zod';

// Lazy initialization of search service
let searchService: any = null;
let searchServiceError: string | null = null;

function getSearchService() {
  if (searchService) return searchService;
  if (searchServiceError) throw new Error(searchServiceError);

  try {
    searchService = createSearchService(defaultSearchConfig);
    return searchService;
  } catch (error) {
    searchServiceError = `Search service unavailable: ${error instanceof Error ? error.message : 'Unknown error'}`;
    throw new Error(searchServiceError);
  }
}

// Validation schemas
const SearchRequestSchema = z.object({
  query: z.string().min(1),
  index: z.string().min(1),
  from: z.number().optional().default(0),
  size: z.number().optional().default(20),
  filters: z.array(z.any()).optional().default([]),
  facets: z.record(z.any()).optional(),
  sort: z.array(z.any()).optional(),
  highlight: z.any().optional(),
  language: z.string().optional(),
  autoComplete: z.boolean().optional().default(false),
  suggestions: z.boolean().optional().default(false),
  analytics: z.object({
    trackSearch: z.boolean().optional().default(true),
    userId: z.string().optional(),
    sessionId: z.string().optional()
  }).optional().default({ trackSearch: true })
});

const CreateIndexSchema = z.object({
  indexName: z.string().min(1),
  settings: z.object({
    numberOfShards: z.number().min(1),
    numberOfReplicas: z.number().min(0),
    refreshInterval: z.string().optional(),
    maxResultWindow: z.number().optional()
  }),
  mappings: z.object({
    properties: z.record(z.any())
  })
});

const ScoringModelSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  version: z.string(),
  fields: z.array(z.object({
    field: z.string(),
    type: z.enum(['text', 'keyword', 'number', 'date', 'boolean']),
    weight: z.number(),
    boost: z.number().optional()
  })),
  boosts: z.array(z.object({
    field: z.string(),
    boost: z.number(),
    condition: z.any().optional()
  })).optional().default([]),
  functions: z.array(z.any()).optional().default([]),
  isActive: z.boolean().optional().default(false)
});

// Search endpoints
export const handleSearch: RequestHandler = async (req, res) => {
  try {
    const service = getSearchService();
    const validatedRequest = SearchRequestSchema.parse(req.body);
    const result = await service.search(validatedRequest);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const statusCode = errorMessage.includes('Search service unavailable') ? 503 : 400;
    res.status(statusCode).json({
      success: false,
      error: errorMessage
    });
  }
};

export const handleAutoComplete: RequestHandler = async (req, res) => {
  try {
    const { query, index, size = 10 } = req.query;
    
    if (!query || !index) {
      return res.status(400).json({
        success: false,
        error: 'Query and index parameters are required'
      });
    }

    const searchRequest = {
      query: query as string,
      index: index as string,
      size: Number(size),
      autoComplete: true,
      analytics: { trackSearch: false }
    };

    const service = getSearchService();
    const result = await service.search(searchRequest);

    res.json({
      success: true,
      data: {
        suggestions: result.autoComplete || [],
        took: result.took
      }
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({
      success: false,
      error: errorMessage
    });
  }
};

export const handleSuggestions: RequestHandler = async (req, res) => {
  try {
    const { query, index, size = 10 } = req.query;
    
    if (!query || !index) {
      return res.status(400).json({
        success: false,
        error: 'Query and index parameters are required'
      });
    }

    const searchRequest = {
      query: query as string,
      index: index as string,
      size: Number(size),
      suggestions: true,
      analytics: { trackSearch: false }
    };

    const service = getSearchService();
    const result = await service.search(searchRequest);

    res.json({
      success: true,
      data: {
        suggestions: result.suggestions || [],
        took: result.took
      }
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({
      success: false,
      error: errorMessage
    });
  }
};

// Index management endpoints
export const handleCreateIndex: RequestHandler = async (req, res) => {
  try {
    const { indexName, settings, mappings } = CreateIndexSchema.parse(req.body);
    const service = getSearchService();
    const result = await service.createIndex(indexName, settings, mappings);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(400).json({
      success: false,
      error: errorMessage
    });
  }
};

export const handleDeleteIndex: RequestHandler = async (req, res) => {
  try {
    const { indexName } = req.params;
    
    if (!indexName) {
      return res.status(400).json({
        success: false,
        error: 'Index name is required'
      });
    }

    const service = getSearchService();
    const result = await service.deleteIndex(indexName);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({
      success: false,
      error: errorMessage
    });
  }
};

export const handleGetIndexStats: RequestHandler = async (req, res) => {
  try {
    const { indexName } = req.params;
    const service = getSearchService();
    const result = await service.getIndexStats(indexName);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({
      success: false,
      error: errorMessage
    });
  }
};

export const handleOptimizeIndex: RequestHandler = async (req, res) => {
  try {
    const { indexName } = req.params;
    const { maxSegments = 1 } = req.body;
    
    if (!indexName) {
      return res.status(400).json({
        success: false,
        error: 'Index name is required'
      });
    }

    const service = getSearchService();
    const result = await service.optimizeIndex(indexName, maxSegments);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({
      success: false,
      error: errorMessage
    });
  }
};

// Cluster management endpoints
export const handleGetClusterHealth: RequestHandler = async (req, res) => {
  try {
    const service = getSearchService();
    const result = await service.getClusterHealth();
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({
      success: false,
      error: errorMessage
    });
  }
};

// Analytics endpoints
export const handleGetSearchMetrics: RequestHandler = async (req, res) => {
  try {
    const { from, to } = req.query;
    
    if (!from || !to) {
      return res.status(400).json({
        success: false,
        error: 'From and to date parameters are required'
      });
    }

    const timeRange = {
      from: new Date(from as string),
      to: new Date(to as string)
    };

    const service = getSearchService();
    const result = await service.getSearchMetrics(timeRange);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({
      success: false,
      error: errorMessage
    });
  }
};

// Performance monitoring endpoints
export const handleGetPerformanceReport: RequestHandler = async (req, res) => {
  try {
    const { period = 'day' } = req.query;
    
    if (!['hour', 'day', 'week', 'month'].includes(period as string)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid period. Must be one of: hour, day, week, month'
      });
    }

    const service = getSearchService();
    const result = await service.getPerformanceReport(period as any);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({
      success: false,
      error: errorMessage
    });
  }
};

export const handleGetActiveAlerts: RequestHandler = async (req, res) => {
  try {
    const service = getSearchService();
    const result = await service.getActiveAlerts();
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({
      success: false,
      error: errorMessage
    });
  }
};

export const handleResolveAlert: RequestHandler = async (req, res) => {
  try {
    const { alertId } = req.params;
    
    if (!alertId) {
      return res.status(400).json({
        success: false,
        error: 'Alert ID is required'
      });
    }

    const service = getSearchService();
    await service.resolveAlert(alertId);
    
    res.json({
      success: true,
      message: 'Alert resolved successfully'
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({
      success: false,
      error: errorMessage
    });
  }
};

// Relevance scoring endpoints
export const handleCreateScoringModel: RequestHandler = async (req, res) => {
  try {
    const validatedModel = ScoringModelSchema.parse(req.body);
    const service = getSearchService();
    const result = await service.createScoringModel(validatedModel);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(400).json({
      success: false,
      error: errorMessage
    });
  }
};

export const handleGetScoringModels: RequestHandler = async (req, res) => {
  try {
    const service = getSearchService();
    const result = await service.getScoringModels();
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({
      success: false,
      error: errorMessage
    });
  }
};

export const handleSetActiveScoringModel: RequestHandler = async (req, res) => {
  try {
    const { modelId } = req.params;
    
    if (!modelId) {
      return res.status(400).json({
        success: false,
        error: 'Model ID is required'
      });
    }

    const service = getSearchService();
    await service.setActiveScoringModel(modelId);
    
    res.json({
      success: true,
      message: 'Active scoring model updated successfully'
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({
      success: false,
      error: errorMessage
    });
  }
};

// Multi-language endpoints
export const handleSetupLanguageAnalyzers: RequestHandler = async (req, res) => {
  try {
    const { indexName } = req.params;
    
    if (!indexName) {
      return res.status(400).json({
        success: false,
        error: 'Index name is required'
      });
    }

    const service = getSearchService();
    await service.setupLanguageAnalyzers(indexName);
    
    res.json({
      success: true,
      message: 'Language analyzers configured successfully'
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({
      success: false,
      error: errorMessage
    });
  }
};

export const handleGetSupportedLanguages: RequestHandler = async (req, res) => {
  try {
    const service = getSearchService();
    const result = await service.getSupportedLanguages();
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({
      success: false,
      error: errorMessage
    });
  }
};

// Auto-complete management endpoints
export const handleBuildAutoCompleteIndex: RequestHandler = async (req, res) => {
  try {
    const { sourceIndex, completionIndex, config } = req.body;
    
    if (!sourceIndex || !completionIndex || !config) {
      return res.status(400).json({
        success: false,
        error: 'Source index, completion index, and config are required'
      });
    }

    const service = getSearchService();
    await service.buildAutoCompleteIndex(sourceIndex, completionIndex, config);
    
    res.json({
      success: true,
      message: 'Auto-complete index built successfully'
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({
      success: false,
      error: errorMessage
    });
  }
};

export const handleUpdatePopularQueries: RequestHandler = async (req, res) => {
  try {
    const { queries } = req.body;
    
    if (!Array.isArray(queries)) {
      return res.status(400).json({
        success: false,
        error: 'Queries must be an array'
      });
    }

    const service = getSearchService();
    await service.updatePopularQueries(queries);
    
    res.json({
      success: true,
      message: 'Popular queries updated successfully'
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({
      success: false,
      error: errorMessage
    });
  }
};

// Health check endpoint
export const handleHealthCheck: RequestHandler = async (req, res) => {
  try {
    let elasticsearchStatus = 'unavailable';
    try {
      const service = getSearchService();
      const clusterHealth = await service.getClusterHealth();
      elasticsearchStatus = clusterHealth.status;
    } catch (error) {
      // Elasticsearch not available, but that's ok in development
      elasticsearchStatus = 'not_connected';
    }

    res.json({
      success: true,
      status: 'healthy',
      services: {
        elasticsearch: elasticsearchStatus,
        analytics: defaultSearchConfig.analytics.enabled,
        performance: defaultSearchConfig.performance.monitoring,
        multiLanguage: defaultSearchConfig.multiLanguage.enabled
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.json({
      success: true,
      status: 'partial',
      services: {
        elasticsearch: 'unavailable',
        analytics: false,
        performance: false,
        multiLanguage: false
      },
      error: errorMessage,
      timestamp: new Date().toISOString()
    });
  }
};
