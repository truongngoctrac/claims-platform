import { Request, Response, RequestHandler } from 'express';
import { performance } from 'perf_hooks';

// Health check status interface
interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  services: {
    [key: string]: {
      status: 'up' | 'down' | 'degraded';
      responseTime?: number;
      lastCheck: string;
      details?: any;
    };
  };
  metrics: {
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
    cpu: {
      usage: number;
      loadAverage: number[];
    };
    requests: {
      total: number;
      errors: number;
      averageResponseTime: number;
    };
  };
}

// Request metrics storage
let requestMetrics = {
  total: 0,
  errors: 0,
  responseTimes: [] as number[],
  lastReset: Date.now()
};

// Middleware to track request metrics
export const requestMetricsMiddleware: RequestHandler = (req, res, next) => {
  const startTime = performance.now();
  
  requestMetrics.total++;
  
  res.on('finish', () => {
    const endTime = performance.now();
    const responseTime = endTime - startTime;
    
    requestMetrics.responseTimes.push(responseTime);
    
    // Keep only last 1000 response times
    if (requestMetrics.responseTimes.length > 1000) {
      requestMetrics.responseTimes = requestMetrics.responseTimes.slice(-1000);
    }
    
    if (res.statusCode >= 400) {
      requestMetrics.errors++;
    }
    
    // Reset metrics every hour
    if (Date.now() - requestMetrics.lastReset > 3600000) {
      requestMetrics = {
        total: 0,
        errors: 0,
        responseTimes: [],
        lastReset: Date.now()
      };
    }
  });
  
  next();
};

// Check database connectivity
async function checkDatabase(): Promise<{ status: 'up' | 'down'; responseTime: number; details?: any }> {
  const startTime = performance.now();
  
  try {
    // Mock database check - replace with actual database connection check
    // For MongoDB: await mongoose.connection.db.admin().ping()
    const isConnected = true; // Replace with actual check
    
    const responseTime = performance.now() - startTime;
    
    if (isConnected) {
      return {
        status: 'up',
        responseTime: Math.round(responseTime),
        details: { connection: 'active' }
      };
    } else {
      return {
        status: 'down',
        responseTime: Math.round(responseTime),
        details: { error: 'No connection' }
      };
    }
  } catch (error) {
    const responseTime = performance.now() - startTime;
    return {
      status: 'down',
      responseTime: Math.round(responseTime),
      details: { error: error instanceof Error ? error.message : 'Unknown error' }
    };
  }
}

// Check Redis connectivity
async function checkRedis(): Promise<{ status: 'up' | 'down'; responseTime: number; details?: any }> {
  const startTime = performance.now();
  
  try {
    // Mock Redis check - replace with actual Redis connection check
    // For Redis: await redisClient.ping()
    const isConnected = true; // Replace with actual check
    
    const responseTime = performance.now() - startTime;
    
    if (isConnected) {
      return {
        status: 'up',
        responseTime: Math.round(responseTime),
        details: { connection: 'active' }
      };
    } else {
      return {
        status: 'down',
        responseTime: Math.round(responseTime),
        details: { error: 'No connection' }
      };
    }
  } catch (error) {
    const responseTime = performance.now() - startTime;
    return {
      status: 'down',
      responseTime: Math.round(responseTime),
      details: { error: error instanceof Error ? error.message : 'Unknown error' }
    };
  }
}

// Check external API connectivity
async function checkExternalAPIs(): Promise<{ status: 'up' | 'down' | 'degraded'; responseTime: number; details?: any }> {
  const startTime = performance.now();
  
  try {
    // Mock external API checks
    const apiChecks = [
      { name: 'claims-service', url: process.env.CLAIMS_SERVICE_URL || 'http://localhost:5001' },
      { name: 'policy-service', url: process.env.POLICY_SERVICE_URL || 'http://localhost:5002' },
      { name: 'user-service', url: process.env.USER_SERVICE_URL || 'http://localhost:5003' }
    ];
    
    const results = await Promise.allSettled(
      apiChecks.map(async (api) => {
        try {
          const response = await fetch(`${api.url}/health`, { 
            signal: AbortSignal.timeout(5000) // 5 second timeout
          });
          return { name: api.name, status: response.ok ? 'up' : 'down' };
        } catch {
          return { name: api.name, status: 'down' };
        }
      })
    );
    
    const responseTime = performance.now() - startTime;
    const services = results.map((result, index) => ({
      name: apiChecks[index].name,
      status: result.status === 'fulfilled' ? result.value.status : 'down'
    }));
    
    const allUp = services.every(s => s.status === 'up');
    const allDown = services.every(s => s.status === 'down');
    
    return {
      status: allUp ? 'up' : allDown ? 'down' : 'degraded',
      responseTime: Math.round(responseTime),
      details: { services }
    };
  } catch (error) {
    const responseTime = performance.now() - startTime;
    return {
      status: 'down',
      responseTime: Math.round(responseTime),
      details: { error: error instanceof Error ? error.message : 'Unknown error' }
    };
  }
}

// Get system metrics
function getSystemMetrics() {
  const memUsage = process.memoryUsage();
  const cpuUsage = process.cpuUsage();
  
  return {
    memory: {
      used: memUsage.heapUsed,
      total: memUsage.heapTotal,
      percentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100)
    },
    cpu: {
      usage: Math.round((cpuUsage.user + cpuUsage.system) / 1000000), // Convert to ms
      loadAverage: process.platform !== 'win32' ? require('os').loadavg() : [0, 0, 0]
    },
    requests: {
      total: requestMetrics.total,
      errors: requestMetrics.errors,
      averageResponseTime: requestMetrics.responseTimes.length > 0 
        ? Math.round(requestMetrics.responseTimes.reduce((a, b) => a + b, 0) / requestMetrics.responseTimes.length)
        : 0
    }
  };
}

// Basic health check endpoint
export const handleHealthCheck: RequestHandler = async (req: Request, res: Response) => {
  try {
    const healthData: HealthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      services: {},
      metrics: getSystemMetrics()
    };
    
    // Quick health check - just return basic status
    res.status(200).json(healthData);
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Detailed health check endpoint
export const handleDetailedHealthCheck: RequestHandler = async (req: Request, res: Response) => {
  try {
    const [dbCheck, redisCheck, apiCheck] = await Promise.allSettled([
      checkDatabase(),
      checkRedis(),
      checkExternalAPIs()
    ]);
    
    const services = {
      database: {
        status: dbCheck.status === 'fulfilled' ? dbCheck.value.status : 'down',
        responseTime: dbCheck.status === 'fulfilled' ? dbCheck.value.responseTime : undefined,
        lastCheck: new Date().toISOString(),
        details: dbCheck.status === 'fulfilled' ? dbCheck.value.details : { error: 'Check failed' }
      },
      redis: {
        status: redisCheck.status === 'fulfilled' ? redisCheck.value.status : 'down',
        responseTime: redisCheck.status === 'fulfilled' ? redisCheck.value.responseTime : undefined,
        lastCheck: new Date().toISOString(),
        details: redisCheck.status === 'fulfilled' ? redisCheck.value.details : { error: 'Check failed' }
      },
      externalAPIs: {
        status: apiCheck.status === 'fulfilled' ? apiCheck.value.status : 'down',
        responseTime: apiCheck.status === 'fulfilled' ? apiCheck.value.responseTime : undefined,
        lastCheck: new Date().toISOString(),
        details: apiCheck.status === 'fulfilled' ? apiCheck.value.details : { error: 'Check failed' }
      }
    };
    
    // Determine overall status
    let overallStatus: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
    
    const serviceStatuses = Object.values(services).map(s => s.status);
    if (serviceStatuses.includes('down')) {
      overallStatus = serviceStatuses.every(s => s === 'down') ? 'unhealthy' : 'degraded';
    }
    
    const healthData: HealthStatus = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      services,
      metrics: getSystemMetrics()
    };
    
    const statusCode = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503;
    res.status(statusCode).json(healthData);
    
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      services: {},
      metrics: getSystemMetrics()
    });
  }
};

// Readiness probe endpoint
export const handleReadinessCheck: RequestHandler = async (req: Request, res: Response) => {
  try {
    // Check if application is ready to receive traffic
    const isReady = process.uptime() > 10; // App needs to be running for at least 10 seconds
    
    if (isReady) {
      res.status(200).json({
        status: 'ready',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime())
      });
    } else {
      res.status(503).json({
        status: 'not-ready',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
        reason: 'Application still starting up'
      });
    }
  } catch (error) {
    res.status(503).json({
      status: 'not-ready',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Liveness probe endpoint
export const handleLivenessCheck: RequestHandler = (req: Request, res: Response) => {
  try {
    // Simple check to ensure the application is running
    res.status(200).json({
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      pid: process.pid
    });
  } catch (error) {
    res.status(503).json({
      status: 'dead',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Metrics endpoint for Prometheus
export const handleMetrics: RequestHandler = (req: Request, res: Response) => {
  try {
    const metrics = getSystemMetrics();
    
    // Convert to Prometheus format
    const prometheusMetrics = `
# HELP healthcare_claims_uptime_seconds Application uptime in seconds
# TYPE healthcare_claims_uptime_seconds counter
healthcare_claims_uptime_seconds ${Math.floor(process.uptime())}

# HELP healthcare_claims_memory_usage_bytes Memory usage in bytes
# TYPE healthcare_claims_memory_usage_bytes gauge
healthcare_claims_memory_usage_bytes ${metrics.memory.used}

# HELP healthcare_claims_memory_total_bytes Total memory in bytes
# TYPE healthcare_claims_memory_total_bytes gauge
healthcare_claims_memory_total_bytes ${metrics.memory.total}

# HELP healthcare_claims_requests_total Total number of requests
# TYPE healthcare_claims_requests_total counter
healthcare_claims_requests_total ${metrics.requests.total}

# HELP healthcare_claims_request_errors_total Total number of request errors
# TYPE healthcare_claims_request_errors_total counter
healthcare_claims_request_errors_total ${metrics.requests.errors}

# HELP healthcare_claims_request_duration_ms Average request duration in milliseconds
# TYPE healthcare_claims_request_duration_ms gauge
healthcare_claims_request_duration_ms ${metrics.requests.averageResponseTime}

# HELP healthcare_claims_cpu_usage_ms CPU usage in milliseconds
# TYPE healthcare_claims_cpu_usage_ms gauge
healthcare_claims_cpu_usage_ms ${metrics.cpu.usage}
`.trim();
    
    res.set('Content-Type', 'text/plain');
    res.status(200).send(prometheusMetrics);
  } catch (error) {
    res.status(500).send('Error generating metrics');
  }
};

// Vietnamese healthcare specific health checks
export const handleHealthcareSpecificChecks: RequestHandler = async (req: Request, res: Response) => {
  try {
    const healthcareChecks = {
      patientDataAccess: {
        status: 'up', // Mock - replace with actual check
        lastCheck: new Date().toISOString(),
        details: { encrypted: true, compliant: true }
      },
      claimProcessing: {
        status: 'up', // Mock - replace with actual check
        lastCheck: new Date().toISOString(),
        details: { queueSize: 0, processingTime: '< 1min' }
      },
      auditLogging: {
        status: 'up', // Mock - replace with actual check
        lastCheck: new Date().toISOString(),
        details: { enabled: true, retention: '7 years' }
      },
      dataCompliance: {
        status: 'up', // Mock - replace with actual check
        lastCheck: new Date().toISOString(),
        details: { gdpr: true, vietnamese_law: true }
      }
    };
    
    res.status(200).json({
      status: 'compliant',
      timestamp: new Date().toISOString(),
      healthcare_specific_checks: healthcareChecks
    });
  } catch (error) {
    res.status(503).json({
      status: 'non-compliant',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
