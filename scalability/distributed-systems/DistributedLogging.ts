/**
 * Distributed Logging Implementation
 * Healthcare Claims Processing System - Distributed Systems
 */

export interface LogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  message: string;
  serviceName: string;
  traceId?: string;
  spanId?: string;
  userId?: string;
  sessionId?: string;
  correlationId?: string;
  metadata: Record<string, any>;
  source: {
    file?: string;
    line?: number;
    function?: string;
  };
  tags: string[];
}

export interface LoggerConfig {
  serviceName: string;
  environment: string;
  version: string;
  logLevel: LogEntry['level'];
  outputs: LogOutput[];
  format: 'json' | 'text' | 'structured';
  enableCorrelation: boolean;
  enableSampling: boolean;
  samplingRate: number;
  bufferSize: number;
  flushInterval: number;
}

export interface LogOutput {
  type: 'console' | 'file' | 'elasticsearch' | 'loki' | 'datadog' | 'cloudwatch';
  config: Record<string, any>;
}

export interface LogContext {
  traceId?: string;
  spanId?: string;
  userId?: string;
  sessionId?: string;
  correlationId?: string;
  metadata?: Record<string, any>;
}

export class DistributedLogger {
  private config: LoggerConfig;
  private logBuffer: LogEntry[] = [];
  private outputs: LogOutputHandler[] = [];
  private context: LogContext = {};

  constructor(config: LoggerConfig) {
    this.config = config;
    this.initializeOutputs();
    this.startBufferFlush();
  }

  private initializeOutputs(): void {
    this.outputs = this.config.outputs.map(output => {
      switch (output.type) {
        case 'console':
          return new ConsoleLogOutput(output.config);
        case 'file':
          return new FileLogOutput(output.config);
        case 'elasticsearch':
          return new ElasticsearchLogOutput(output.config);
        case 'loki':
          return new LokiLogOutput(output.config);
        case 'datadog':
          return new DatadogLogOutput(output.config);
        case 'cloudwatch':
          return new CloudWatchLogOutput(output.config);
        default:
          throw new Error(`Unsupported log output type: ${output.type}`);
      }
    });
  }

  setContext(context: Partial<LogContext>): void {
    this.context = { ...this.context, ...context };
  }

  clearContext(): void {
    this.context = {};
  }

  debug(message: string, metadata: Record<string, any> = {}, tags: string[] = []): void {
    this.log('debug', message, metadata, tags);
  }

  info(message: string, metadata: Record<string, any> = {}, tags: string[] = []): void {
    this.log('info', message, metadata, tags);
  }

  warn(message: string, metadata: Record<string, any> = {}, tags: string[] = []): void {
    this.log('warn', message, metadata, tags);
  }

  error(message: string, metadata: Record<string, any> = {}, tags: string[] = []): void {
    this.log('error', message, metadata, tags);
  }

  fatal(message: string, metadata: Record<string, any> = {}, tags: string[] = []): void {
    this.log('fatal', message, metadata, tags);
  }

  private log(level: LogEntry['level'], message: string, metadata: Record<string, any>, tags: string[]): void {
    if (!this.shouldLog(level)) {
      return;
    }

    if (this.config.enableSampling && Math.random() > this.config.samplingRate) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      serviceName: this.config.serviceName,
      traceId: this.context.traceId,
      spanId: this.context.spanId,
      userId: this.context.userId,
      sessionId: this.context.sessionId,
      correlationId: this.context.correlationId || this.generateCorrelationId(),
      metadata: {
        ...this.context.metadata,
        ...metadata,
        environment: this.config.environment,
        version: this.config.version,
      },
      source: this.captureSource(),
      tags: [...tags, level, this.config.serviceName],
    };

    this.logBuffer.push(entry);

    if (this.logBuffer.length >= this.config.bufferSize) {
      this.flushBuffer();
    }

    // Immediate output for fatal errors
    if (level === 'fatal') {
      this.flushBuffer();
    }
  }

  private shouldLog(level: LogEntry['level']): boolean {
    const levels = ['debug', 'info', 'warn', 'error', 'fatal'];
    const currentLevelIndex = levels.indexOf(this.config.logLevel);
    const requestedLevelIndex = levels.indexOf(level);
    return requestedLevelIndex >= currentLevelIndex;
  }

  private generateCorrelationId(): string {
    return 'corr_' + Math.random().toString(36).substr(2, 9);
  }

  private captureSource(): LogEntry['source'] {
    const stack = new Error().stack;
    if (!stack) return {};

    const stackLines = stack.split('\n');
    const callerLine = stackLines[4]; // Skip this function and log level functions
    
    if (!callerLine) return {};

    const match = callerLine.match(/at\s+(.+)\s+\((.+):(\d+):(\d+)\)/);
    if (match) {
      return {
        function: match[1],
        file: match[2],
        line: parseInt(match[3], 10),
      };
    }

    return {};
  }

  private startBufferFlush(): void {
    setInterval(() => {
      if (this.logBuffer.length > 0) {
        this.flushBuffer();
      }
    }, this.config.flushInterval);
  }

  private async flushBuffer(): Promise<void> {
    const entries = this.logBuffer.splice(0);
    
    if (entries.length === 0) return;

    const promises = this.outputs.map(output => 
      output.write(entries).catch(error => 
        console.error('Failed to write to log output:', error)
      )
    );

    await Promise.all(promises);
  }

  async flush(): Promise<void> {
    await this.flushBuffer();
  }
}

export abstract class LogOutputHandler {
  protected config: Record<string, any>;

  constructor(config: Record<string, any>) {
    this.config = config;
  }

  abstract write(entries: LogEntry[]): Promise<void>;
}

export class ConsoleLogOutput extends LogOutputHandler {
  async write(entries: LogEntry[]): Promise<void> {
    entries.forEach(entry => {
      const formatted = this.formatEntry(entry);
      console.log(formatted);
    });
  }

  private formatEntry(entry: LogEntry): string {
    if (this.config.format === 'json') {
      return JSON.stringify(entry);
    }
    
    const timestamp = entry.timestamp;
    const level = entry.level.toUpperCase().padEnd(5);
    const service = entry.serviceName;
    const traceInfo = entry.traceId ? ` [${entry.traceId}/${entry.spanId}]` : '';
    
    return `${timestamp} ${level} ${service}${traceInfo}: ${entry.message}`;
  }
}

export class FileLogOutput extends LogOutputHandler {
  private writeStream: any;

  constructor(config: Record<string, any>) {
    super(config);
    const fs = require('fs');
    this.writeStream = fs.createWriteStream(config.filename, { flags: 'a' });
  }

  async write(entries: LogEntry[]): Promise<void> {
    const lines = entries.map(entry => JSON.stringify(entry) + '\n');
    
    return new Promise((resolve, reject) => {
      this.writeStream.write(lines.join(''), (error: Error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
}

export class ElasticsearchLogOutput extends LogOutputHandler {
  async write(entries: LogEntry[]): Promise<void> {
    const bulkBody: any[] = [];
    
    entries.forEach(entry => {
      bulkBody.push({
        index: {
          _index: this.config.index || 'logs',
          _type: '_doc',
        }
      });
      bulkBody.push(entry);
    });

    await fetch(`${this.config.host}/_bulk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.auth && { 'Authorization': this.config.auth }),
      },
      body: bulkBody.map(item => JSON.stringify(item)).join('\n') + '\n',
    });
  }
}

export class LokiLogOutput extends LogOutputHandler {
  async write(entries: LogEntry[]): Promise<void> {
    const streams = new Map<string, any[]>();

    entries.forEach(entry => {
      const labels = {
        service: entry.serviceName,
        level: entry.level,
        environment: entry.metadata.environment,
      };
      
      const labelString = Object.entries(labels)
        .map(([key, value]) => `${key}="${value}"`)
        .join(',');

      if (!streams.has(labelString)) {
        streams.set(labelString, []);
      }

      streams.get(labelString)!.push([
        (new Date(entry.timestamp).getTime() * 1000000).toString(), // nanoseconds
        JSON.stringify({
          message: entry.message,
          traceId: entry.traceId,
          spanId: entry.spanId,
          metadata: entry.metadata,
        }),
      ]);
    });

    const payload = {
      streams: Array.from(streams.entries()).map(([labels, values]) => ({
        stream: this.parseLabels(labels),
        values,
      })),
    };

    await fetch(`${this.config.host}/loki/api/v1/push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.auth && { 'Authorization': this.config.auth }),
      },
      body: JSON.stringify(payload),
    });
  }

  private parseLabels(labelString: string): Record<string, string> {
    const labels: Record<string, string> = {};
    const pairs = labelString.split(',');
    
    pairs.forEach(pair => {
      const [key, value] = pair.split('=');
      labels[key] = value.replace(/"/g, '');
    });
    
    return labels;
  }
}

export class DatadogLogOutput extends LogOutputHandler {
  async write(entries: LogEntry[]): Promise<void> {
    const payload = entries.map(entry => ({
      timestamp: new Date(entry.timestamp).getTime(),
      status: entry.level,
      message: entry.message,
      service: entry.serviceName,
      source: 'nodejs',
      tags: entry.tags.join(','),
      'dd.trace_id': entry.traceId,
      'dd.span_id': entry.spanId,
      ...entry.metadata,
    }));

    await fetch('https://http-intake.logs.datadoghq.com/v1/input/' + this.config.apiKey, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  }
}

export class CloudWatchLogOutput extends LogOutputHandler {
  async write(entries: LogEntry[]): Promise<void> {
    // AWS CloudWatch Logs implementation would go here
    // This is a simplified version
    const logEvents = entries.map(entry => ({
      timestamp: new Date(entry.timestamp).getTime(),
      message: JSON.stringify(entry),
    }));

    // Would use AWS SDK to put log events
    console.log('CloudWatch logs:', logEvents);
  }
}

export class CorrelationMiddleware {
  private logger: DistributedLogger;

  constructor(logger: DistributedLogger) {
    this.logger = logger;
  }

  middleware() {
    return (req: any, res: any, next: any) => {
      const correlationId = req.headers['x-correlation-id'] || this.generateCorrelationId();
      const traceId = req.headers['x-trace-id'];
      const spanId = req.headers['x-span-id'];
      const userId = req.user?.id;
      const sessionId = req.session?.id;

      this.logger.setContext({
        correlationId,
        traceId,
        spanId,
        userId,
        sessionId,
        metadata: {
          userAgent: req.headers['user-agent'],
          ip: req.ip,
          method: req.method,
          url: req.url,
        },
      });

      res.setHeader('x-correlation-id', correlationId);
      
      next();
    };
  }

  private generateCorrelationId(): string {
    return 'corr_' + Math.random().toString(36).substr(2, 9);
  }
}

export class StructuredLogger extends DistributedLogger {
  logClaimEvent(action: string, claimId: string, metadata: Record<string, any> = {}): void {
    this.info(`Claim ${action}`, {
      event: 'claim_lifecycle',
      claimId,
      action,
      ...metadata,
    }, ['claim', action]);
  }

  logUserAction(action: string, userId: string, metadata: Record<string, any> = {}): void {
    this.info(`User ${action}`, {
      event: 'user_action',
      userId,
      action,
      ...metadata,
    }, ['user', action]);
  }

  logAPICall(method: string, endpoint: string, duration: number, statusCode: number): void {
    this.info(`API ${method} ${endpoint}`, {
      event: 'api_call',
      method,
      endpoint,
      duration,
      statusCode,
    }, ['api', method.toLowerCase()]);
  }

  logPerformanceMetric(metric: string, value: number, unit: string, metadata: Record<string, any> = {}): void {
    this.info(`Performance metric: ${metric}`, {
      event: 'performance_metric',
      metric,
      value,
      unit,
      ...metadata,
    }, ['performance', 'metric']);
  }
}
