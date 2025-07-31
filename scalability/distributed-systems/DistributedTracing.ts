/**
 * Distributed Tracing Implementation
 * Healthcare Claims Processing System - Distributed Systems
 */

export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  flags: number;
  baggage: Record<string, string>;
}

export interface Span {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operationName: string;
  serviceName: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  tags: Record<string, any>;
  logs: LogEntry[];
  status: 'ok' | 'error' | 'timeout';
  references: SpanReference[];
}

export interface LogEntry {
  timestamp: number;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  fields: Record<string, any>;
}

export interface SpanReference {
  type: 'child_of' | 'follows_from';
  traceId: string;
  spanId: string;
}

export interface TracingConfig {
  serviceName: string;
  samplingRate: number;
  maxSpanCount: number;
  exporterType: 'jaeger' | 'zipkin' | 'otlp';
  exporterEndpoint: string;
  batchSize: number;
  flushInterval: number;
}

export class DistributedTracer {
  private config: TracingConfig;
  private activeSpans: Map<string, Span> = new Map();
  private completedSpans: Span[] = [];
  private traceIdGenerator: () => string;
  private spanIdGenerator: () => string;

  constructor(config: TracingConfig) {
    this.config = config;
    this.traceIdGenerator = () => this.generateId(16);
    this.spanIdGenerator = () => this.generateId(8);
    
    this.startBatchExporter();
  }

  private generateId(length: number): string {
    const chars = '0123456789abcdef';
    let result = '';
    for (let i = 0; i < length * 2; i++) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
  }

  startSpan(operationName: string, parentContext?: TraceContext): Span {
    const shouldSample = Math.random() < this.config.samplingRate;
    if (!shouldSample && !parentContext) {
      return this.createNoOpSpan();
    }

    const traceId = parentContext?.traceId || this.traceIdGenerator();
    const spanId = this.spanIdGenerator();
    const parentSpanId = parentContext?.spanId;

    const span: Span = {
      traceId,
      spanId,
      parentSpanId,
      operationName,
      serviceName: this.config.serviceName,
      startTime: Date.now(),
      tags: {},
      logs: [],
      status: 'ok',
      references: parentSpanId ? [{
        type: 'child_of',
        traceId,
        spanId: parentSpanId,
      }] : [],
    };

    this.activeSpans.set(spanId, span);
    return span;
  }

  finishSpan(span: Span): void {
    if (!span.spanId) return; // No-op span

    span.endTime = Date.now();
    span.duration = span.endTime - span.startTime;

    this.activeSpans.delete(span.spanId);
    this.completedSpans.push(span);

    if (this.completedSpans.length >= this.config.batchSize) {
      this.exportSpans();
    }
  }

  setTag(span: Span, key: string, value: any): void {
    if (span.spanId) {
      span.tags[key] = value;
    }
  }

  setTags(span: Span, tags: Record<string, any>): void {
    if (span.spanId) {
      Object.assign(span.tags, tags);
    }
  }

  log(span: Span, level: LogEntry['level'], message: string, fields: Record<string, any> = {}): void {
    if (span.spanId) {
      span.logs.push({
        timestamp: Date.now(),
        level,
        message,
        fields,
      });
    }
  }

  setStatus(span: Span, status: Span['status']): void {
    if (span.spanId) {
      span.status = status;
    }
  }

  extractContext(headers: Record<string, string>): TraceContext | null {
    const traceId = headers['x-trace-id'] || headers['uber-trace-id'];
    const spanId = headers['x-span-id'];
    const parentSpanId = headers['x-parent-span-id'];
    const flags = parseInt(headers['x-trace-flags'] || '0', 10);

    if (!traceId || !spanId) {
      return null;
    }

    return {
      traceId,
      spanId,
      parentSpanId,
      flags,
      baggage: this.extractBaggage(headers),
    };
  }

  injectContext(context: TraceContext, headers: Record<string, string>): void {
    headers['x-trace-id'] = context.traceId;
    headers['x-span-id'] = context.spanId;
    if (context.parentSpanId) {
      headers['x-parent-span-id'] = context.parentSpanId;
    }
    headers['x-trace-flags'] = context.flags.toString();
    
    // Inject baggage
    Object.entries(context.baggage).forEach(([key, value]) => {
      headers[`x-baggage-${key}`] = value;
    });
  }

  private extractBaggage(headers: Record<string, string>): Record<string, string> {
    const baggage: Record<string, string> = {};
    
    Object.entries(headers).forEach(([key, value]) => {
      if (key.startsWith('x-baggage-')) {
        const baggageKey = key.replace('x-baggage-', '');
        baggage[baggageKey] = value;
      }
    });
    
    return baggage;
  }

  private createNoOpSpan(): Span {
    return {
      traceId: '',
      spanId: '',
      operationName: '',
      serviceName: this.config.serviceName,
      startTime: 0,
      tags: {},
      logs: [],
      status: 'ok',
      references: [],
    };
  }

  private startBatchExporter(): void {
    setInterval(() => {
      if (this.completedSpans.length > 0) {
        this.exportSpans();
      }
    }, this.config.flushInterval);
  }

  private async exportSpans(): Promise<void> {
    const spansToExport = this.completedSpans.splice(0, this.config.batchSize);
    
    try {
      switch (this.config.exporterType) {
        case 'jaeger':
          await this.exportToJaeger(spansToExport);
          break;
        case 'zipkin':
          await this.exportToZipkin(spansToExport);
          break;
        case 'otlp':
          await this.exportToOTLP(spansToExport);
          break;
      }
      
      console.log(`📤 Exported ${spansToExport.length} spans to ${this.config.exporterType}`);
    } catch (error) {
      console.error('❌ Failed to export spans:', error);
      // Could implement retry logic
    }
  }

  private async exportToJaeger(spans: Span[]): Promise<void> {
    const jaegerSpans = spans.map(span => ({
      traceID: span.traceId,
      spanID: span.spanId,
      parentSpanID: span.parentSpanId,
      operationName: span.operationName,
      startTime: span.startTime * 1000, // microseconds
      duration: (span.duration || 0) * 1000, // microseconds
      tags: Object.entries(span.tags).map(([key, value]) => ({
        key,
        type: typeof value === 'string' ? 'string' : 'number',
        value: value.toString(),
      })),
      logs: span.logs.map(log => ({
        timestamp: log.timestamp * 1000,
        fields: [
          { key: 'level', value: log.level },
          { key: 'message', value: log.message },
          ...Object.entries(log.fields).map(([key, value]) => ({
            key,
            value: value.toString(),
          })),
        ],
      })),
      process: {
        serviceName: this.config.serviceName,
        tags: [],
      },
    }));

    const payload = {
      data: [{
        traceID: spans[0]?.traceId,
        spans: jaegerSpans,
      }],
    };

    await fetch(`${this.config.exporterEndpoint}/api/traces`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  private async exportToZipkin(spans: Span[]): Promise<void> {
    const zipkinSpans = spans.map(span => ({
      traceId: span.traceId,
      id: span.spanId,
      parentId: span.parentSpanId,
      name: span.operationName,
      timestamp: span.startTime * 1000, // microseconds
      duration: (span.duration || 0) * 1000, // microseconds
      localEndpoint: {
        serviceName: this.config.serviceName,
      },
      tags: span.tags,
      annotations: span.logs.map(log => ({
        timestamp: log.timestamp * 1000,
        value: `${log.level}: ${log.message}`,
      })),
    }));

    await fetch(`${this.config.exporterEndpoint}/api/v2/spans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(zipkinSpans),
    });
  }

  private async exportToOTLP(spans: Span[]): Promise<void> {
    // OTLP (OpenTelemetry Protocol) implementation
    const otlpSpans = {
      resourceSpans: [{
        resource: {
          attributes: [{
            key: 'service.name',
            value: { stringValue: this.config.serviceName },
          }],
        },
        instrumentationLibrarySpans: [{
          spans: spans.map(span => ({
            traceId: Buffer.from(span.traceId, 'hex').toString('base64'),
            spanId: Buffer.from(span.spanId, 'hex').toString('base64'),
            parentSpanId: span.parentSpanId ? Buffer.from(span.parentSpanId, 'hex').toString('base64') : undefined,
            name: span.operationName,
            startTimeUnixNano: span.startTime * 1000000,
            endTimeUnixNano: (span.endTime || span.startTime) * 1000000,
            attributes: Object.entries(span.tags).map(([key, value]) => ({
              key,
              value: { stringValue: value.toString() },
            })),
            status: {
              code: span.status === 'ok' ? 1 : 2,
            },
          })),
        }],
      }],
    };

    await fetch(`${this.config.exporterEndpoint}/v1/traces`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(otlpSpans),
    });
  }
}

export class TraceableRequestHandler {
  private tracer: DistributedTracer;

  constructor(tracer: DistributedTracer) {
    this.tracer = tracer;
  }

  traceRequest(operationName: string) {
    return (req: any, res: any, next: any) => {
      const context = this.tracer.extractContext(req.headers);
      const span = this.tracer.startSpan(operationName, context || undefined);

      this.tracer.setTags(span, {
        'http.method': req.method,
        'http.url': req.url,
        'http.user_agent': req.headers['user-agent'],
        'component': 'http-server',
      });

      req.span = span;
      req.traceContext = {
        traceId: span.traceId,
        spanId: span.spanId,
        parentSpanId: span.parentSpanId,
        flags: 1,
        baggage: {},
      };

      const originalSend = res.send;
      res.send = function(data: any) {
        span.tags['http.status_code'] = res.statusCode;
        
        if (res.statusCode >= 400) {
          tracer.setStatus(span, 'error');
        }
        
        tracer.finishSpan(span);
        return originalSend.call(this, data);
      };

      next();
    };
  }

  async traceAsyncOperation<T>(
    operationName: string,
    operation: (span: Span) => Promise<T>,
    parentContext?: TraceContext
  ): Promise<T> {
    const span = this.tracer.startSpan(operationName, parentContext);
    
    try {
      const result = await operation(span);
      this.tracer.setStatus(span, 'ok');
      return result;
    } catch (error) {
      this.tracer.setStatus(span, 'error');
      this.tracer.log(span, 'error', 'Operation failed', { error: error.message });
      throw error;
    } finally {
      this.tracer.finishSpan(span);
    }
  }
}
