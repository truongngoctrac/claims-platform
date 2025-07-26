import { RequestHandler } from 'express';
import { getAPIManagementService } from '../services/api-management';
import { Logger } from 'winston';

// Initialize logger (you would get this from your app's logger)
const logger = {
  info: console.log,
  error: console.error,
  warn: console.warn,
  debug: console.debug
} as Logger;

const apiManagement = getAPIManagementService(logger);

// External API Management Endpoints

export const getExternalAPIs: RequestHandler = async (req, res) => {
  try {
    const status = apiManagement.getExternalAPIStatus();
    res.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
};

export const callExternalAPI: RequestHandler = async (req, res) => {
  try {
    const { apiName, endpoint, method = 'GET', headers, body, params } = req.body;
    
    if (!apiName || !endpoint) {
      return res.status(400).json({
        success: false,
        error: 'API name and endpoint are required',
        timestamp: new Date().toISOString()
      });
    }

    const result = await apiManagement.callExternalAPI(apiName, endpoint, {
      method,
      headers,
      body,
      params,
      metadata: {
        userId: req.body.userId || req.headers['x-user-id'],
        clientId: req.headers['x-client-id'],
        sessionId: req.headers['x-session-id']
      }
    });

    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'External API call failed',
      timestamp: new Date().toISOString()
    });
  }
};

export const getCircuitBreakerStatus: RequestHandler = async (req, res) => {
  try {
    const { apiName } = req.params;
    const status = apiManagement.getCircuitBreakerStatus(apiName);
    
    res.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
};

export const resetCircuitBreaker: RequestHandler = async (req, res) => {
  try {
    const { apiName } = req.params;
    const success = apiManagement.resetCircuitBreaker(apiName);
    
    if (success) {
      res.json({
        success: true,
        message: `Circuit breaker reset for ${apiName}`,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(404).json({
        success: false,
        error: `API ${apiName} not found`,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
};

// API Version Management Endpoints

export const getVersionInfo: RequestHandler = async (req, res) => {
  try {
    const versionInfo = apiManagement.getVersionInfo();
    res.json({
      success: true,
      data: versionInfo,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
};

export const validateAPIVersion: RequestHandler = async (req, res) => {
  try {
    const { version, endpoint, method, data } = req.body;
    
    if (!version || !endpoint || !method) {
      return res.status(400).json({
        success: false,
        error: 'Version, endpoint, and method are required',
        timestamp: new Date().toISOString()
      });
    }

    const validation = apiManagement.validateAPIRequest(version, endpoint, method, data);
    
    res.json({
      success: true,
      data: validation,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Validation failed',
      timestamp: new Date().toISOString()
    });
  }
};

// API Key Management Endpoints

export const createAPIKey: RequestHandler = async (req, res) => {
  try {
    const {
      name,
      environment = 'development',
      type = 'test',
      userId,
      organizationId,
      scopes = ['claims:read'],
      permissions = [],
      expiresIn,
      description,
      tags = []
    } = req.body;

    if (!name || !userId || !organizationId) {
      return res.status(400).json({
        success: false,
        error: 'Name, userId, and organizationId are required',
        timestamp: new Date().toISOString()
      });
    }

    const apiKey = apiManagement.createAPIKey({
      name,
      environment,
      type,
      userId,
      organizationId,
      scopes,
      permissions,
      expiresIn,
      description,
      tags
    });

    // Don't return the actual key in the response for security
    const { key, hashedKey, ...safeKey } = apiKey;
    
    res.status(201).json({
      success: true,
      data: {
        ...safeKey,
        key: key // Only return key once during creation
      },
      message: 'API key created successfully. Save the key securely as it cannot be retrieved again.',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'API key creation failed',
      timestamp: new Date().toISOString()
    });
  }
};

export const getAPIKeyInfo: RequestHandler = async (req, res) => {
  try {
    const { keyId } = req.params;
    const keyInfo = apiManagement.getAPIKeyInfo(keyId);
    
    if (!keyInfo) {
      return res.status(404).json({
        success: false,
        error: 'API key not found',
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      data: keyInfo,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
};

export const validateAPIKey: RequestHandler = async (req, res) => {
  try {
    const { key } = req.body;
    
    if (!key) {
      return res.status(400).json({
        success: false,
        error: 'API key is required',
        timestamp: new Date().toISOString()
      });
    }

    const validation = apiManagement.validateAPIKey(key);
    
    res.json({
      success: true,
      data: validation,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'API key validation failed',
      timestamp: new Date().toISOString()
    });
  }
};

export const checkRateLimit: RequestHandler = async (req, res) => {
  try {
    const { keyId, endpoint } = req.params;
    const rateLimitStatus = apiManagement.checkRateLimit(keyId, endpoint);
    
    res.json({
      success: true,
      data: rateLimitStatus,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Rate limit check failed',
      timestamp: new Date().toISOString()
    });
  }
};

// Documentation Endpoints

export const getAPIDocumentation: RequestHandler = async (req, res) => {
  try {
    const { version } = req.params;
    const { format = 'yaml' } = req.query;
    
    if (format === 'json' || format === 'yaml') {
      const documentation = await apiManagement.generateDocumentation(version, format);
      
      res.setHeader('Content-Type', format === 'yaml' ? 'text/yaml' : 'application/json');
      res.send(documentation);
    } else {
      const docData = apiManagement.getAPIDocumentation(version);
      res.json({
        success: true,
        data: docData,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Documentation generation failed',
      timestamp: new Date().toISOString()
    });
  }
};

export const getAPIExamples: RequestHandler = async (req, res) => {
  try {
    const { version } = req.params;
    const { language } = req.query;
    
    const docData = apiManagement.getAPIDocumentation(version);
    const examples = docData.examples;
    
    if (language) {
      // Generate SDK examples for specific language
      const sdkExamples = examples.map((example: any) => ({
        ...example,
        sdkExample: example.sdkExamples?.[language as string] || 'Example not available for this language'
      }));
      
      res.json({
        success: true,
        data: sdkExamples,
        language,
        timestamp: new Date().toISOString()
      });
    } else {
      res.json({
        success: true,
        data: examples,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Examples retrieval failed',
      timestamp: new Date().toISOString()
    });
  }
};

// Monitoring and Analytics Endpoints

export const getAnalytics: RequestHandler = async (req, res) => {
  try {
    const { 
      endpoint, 
      method, 
      startDate, 
      endDate, 
      limit = '100' 
    } = req.query;
    
    const filters: any = {};
    if (endpoint) filters.endpoint = endpoint;
    if (method) filters.method = method;
    if (startDate) filters.startDate = new Date(startDate as string);
    if (endDate) filters.endDate = new Date(endDate as string);
    if (limit) filters.limit = parseInt(limit as string);
    
    const analytics = apiManagement.getAnalytics(filters);
    
    res.json({
      success: true,
      data: analytics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Analytics retrieval failed',
      timestamp: new Date().toISOString()
    });
  }
};

export const getDashboard: RequestHandler = async (req, res) => {
  try {
    const analytics = apiManagement.getAnalytics();
    const systemHealth = apiManagement.getSystemHealth();
    const versionInfo = apiManagement.getVersionInfo();
    const externalAPIStatus = apiManagement.getExternalAPIStatus();
    
    res.json({
      success: true,
      data: {
        analytics: analytics.dashboard,
        systemHealth,
        versionInfo,
        externalAPIStatus,
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Dashboard data retrieval failed',
      timestamp: new Date().toISOString()
    });
  }
};

export const getSystemHealth: RequestHandler = async (req, res) => {
  try {
    const health = apiManagement.getSystemHealth();
    
    // Set appropriate HTTP status based on health
    const statusCode = health.overall === 'healthy' ? 200 :
                      health.overall === 'degraded' ? 200 : 503;
    
    res.status(statusCode).json({
      success: true,
      data: health,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      error: error instanceof Error ? error.message : 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
};

export const recordMetric: RequestHandler = async (req, res) => {
  try {
    const metric = req.body;
    
    // Add request metadata
    const enrichedMetric = {
      ...metric,
      ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
      userAgent: req.get('User-Agent') || 'unknown',
      timestamp: new Date()
    };
    
    apiManagement.recordAPIMetric(enrichedMetric);
    
    res.json({
      success: true,
      message: 'Metric recorded successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Metric recording failed',
      timestamp: new Date().toISOString()
    });
  }
};

// Configuration Endpoints

export const getConfiguration: RequestHandler = async (req, res) => {
  try {
    const config = apiManagement.getConfiguration();
    
    res.json({
      success: true,
      data: config,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Configuration retrieval failed',
      timestamp: new Date().toISOString()
    });
  }
};

export const updateConfiguration: RequestHandler = async (req, res) => {
  try {
    const updates = req.body;
    
    apiManagement.updateConfiguration(updates);
    
    res.json({
      success: true,
      message: 'Configuration updated successfully',
      data: apiManagement.getConfiguration(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Configuration update failed',
      timestamp: new Date().toISOString()
    });
  }
};

// Status and Info Endpoints

export const getStatus: RequestHandler = async (req, res) => {
  try {
    const status = apiManagement.getStatus();
    
    res.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Status retrieval failed',
      timestamp: new Date().toISOString()
    });
  }
};

export const ping: RequestHandler = async (req, res) => {
  try {
    const health = apiManagement.getSystemHealth();
    
    res.json({
      success: true,
      message: 'API Management service is running',
      health: health.overall,
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Ping failed',
      timestamp: new Date().toISOString()
    });
  }
};

// Middleware for request/response logging and metrics
export const apiManagementMiddleware: RequestHandler = (req, res, next) => {
  const startTime = Date.now();
  
  // Capture original send method
  const originalSend = res.send;
  
  res.send = function(body) {
    const responseTime = Date.now() - startTime;
    const requestSize = JSON.stringify(req.body || {}).length;
    const responseSize = typeof body === 'string' ? body.length : JSON.stringify(body || {}).length;
    
    // Record metric
    apiManagement.recordAPIMetric({
      endpoint: req.path,
      method: req.method,
      statusCode: res.statusCode,
      responseTime,
      requestSize,
      responseSize,
      apiKey: req.headers['x-api-key'] as string,
      userId: req.headers['x-user-id'] as string,
      userAgent: req.get('User-Agent') || 'unknown',
      ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
      version: req.headers['x-api-version'] as string || req.headers['api-version'] as string || '2.0.0',
      metadata: {
        path: req.path,
        query: req.query,
        clientId: req.headers['x-client-id'],
        sessionId: req.headers['x-session-id']
      }
    });
    
    return originalSend.call(this, body);
  };
  
  next();
};

// Error handling middleware for API management routes
export const apiManagementErrorHandler: RequestHandler = (err, req, res, next) => {
  logger.error('API Management error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    query: req.query,
    body: req.body
  });
  
  res.status(500).json({
    success: false,
    error: 'Internal server error in API management',
    timestamp: new Date().toISOString(),
    requestId: req.headers['x-request-id'] || 'unknown'
  });
};
