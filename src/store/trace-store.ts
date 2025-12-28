import type { Span, Trace } from './types.ts';

export interface StoreConfig {
  maxTraces: number;
  maxSpans: number;
}

export interface TraceFilter {
  service?: string;
  hasErrors?: boolean;
  minDurationMs?: number;
  sinceMinutes?: number;
  limit?: number;
}

export interface SpanFilter {
  name?: string;
  service?: string;
  minDurationMs?: number;
  hasError?: boolean;
  attribute?: string;
  sinceMinutes?: number;
  limit?: number;
}

export class TraceStore {
  private spans = new Map<string, Span>();
  private traceIndex = new Map<string, Set<string>>();
  private serviceIndex = new Map<string, Set<string>>();
  private traceTimestamps = new Map<string, number>();
  private config: StoreConfig;

  constructor(config: Partial<StoreConfig> = {}) {
    this.config = {
      maxTraces: config.maxTraces ?? 1000,
      maxSpans: config.maxSpans ?? 10000,
    };
  }

  addSpans(newSpans: Span[]): void {
    for (const span of newSpans) {
      this.addSpan(span);
    }
    this.enforceLimit();
  }

  private addSpan(span: Span): void {
    const key = `${span.traceId}:${span.spanId}`;
    this.spans.set(key, span);

    if (!this.traceIndex.has(span.traceId)) {
      this.traceIndex.set(span.traceId, new Set());
    }
    this.traceIndex.get(span.traceId)!.add(key);

    const existingTimestamp = this.traceTimestamps.get(span.traceId);
    if (!existingTimestamp || span.startTime > existingTimestamp) {
      this.traceTimestamps.set(span.traceId, span.startTime);
    }

    if (!this.serviceIndex.has(span.serviceName)) {
      this.serviceIndex.set(span.serviceName, new Set());
    }
    this.serviceIndex.get(span.serviceName)!.add(span.traceId);
  }

  private enforceLimit(): void {
    while (this.spans.size > this.config.maxSpans || this.traceIndex.size > this.config.maxTraces) {
      const oldestTraceId = this.findOldestTrace();
      if (!oldestTraceId) break;
      this.deleteTrace(oldestTraceId);
    }
  }

  private findOldestTrace(): string | null {
    let oldestId: string | null = null;
    let oldestTime = Infinity;

    for (const [traceId, timestamp] of this.traceTimestamps) {
      if (timestamp < oldestTime) {
        oldestTime = timestamp;
        oldestId = traceId;
      }
    }

    return oldestId;
  }

  private deleteTrace(traceId: string): void {
    const spanKeys = this.traceIndex.get(traceId);
    if (!spanKeys) return;

    for (const key of spanKeys) {
      const span = this.spans.get(key);
      if (span) {
        const serviceSpans = this.serviceIndex.get(span.serviceName);
        serviceSpans?.delete(traceId);
        if (serviceSpans?.size === 0) {
          this.serviceIndex.delete(span.serviceName);
        }
      }
      this.spans.delete(key);
    }

    this.traceIndex.delete(traceId);
    this.traceTimestamps.delete(traceId);
  }

  private getSpansForTrace(traceId: string): Span[] {
    const spanKeys = this.traceIndex.get(traceId);
    if (!spanKeys) return [];

    const spans: Span[] = [];
    for (const key of spanKeys) {
      const span = this.spans.get(key);
      if (span) spans.push(span);
    }
    return spans.sort((a, b) => a.startTime - b.startTime);
  }

  private buildTrace(traceId: string): Trace | null {
    const spans = this.getSpansForTrace(traceId);
    if (spans.length === 0) return null;

    const rootSpan = spans.find((s) => !s.parentSpanId) ?? null;
    const services = [...new Set(spans.map((s) => s.serviceName))];
    const startTime = Math.min(...spans.map((s) => s.startTime));
    const endTime = Math.max(...spans.map((s) => s.endTime));
    const errorCount = spans.filter((s) => s.status === 'error').length;

    return {
      traceId,
      rootSpan,
      spans,
      services,
      startTime,
      endTime,
      duration: endTime - startTime,
      spanCount: spans.length,
      errorCount,
    };
  }

  getTrace(traceId: string): Trace | null {
    if (this.traceIndex.has(traceId)) {
      return this.buildTrace(traceId);
    }

    const matches: string[] = [];
    for (const id of this.traceIndex.keys()) {
      if (id.startsWith(traceId)) {
        matches.push(id);
      }
    }

    if (matches.length === 1) {
      return this.buildTrace(matches[0]!);
    }

    return null;
  }

  findTracesByPrefix(prefix: string): string[] {
    const matches: string[] = [];
    for (const id of this.traceIndex.keys()) {
      if (id.startsWith(prefix)) {
        matches.push(id);
      }
    }
    return matches;
  }

  listTraces(filter: TraceFilter = {}): Trace[] {
    const limit = Math.min(filter.limit ?? 20, 100);
    const sinceMs = filter.sinceMinutes ? Date.now() - filter.sinceMinutes * 60 * 1000 : 0;

    let traceIds: Set<string>;

    if (filter.service && this.serviceIndex.has(filter.service)) {
      traceIds = new Set(this.serviceIndex.get(filter.service)!);
    } else {
      traceIds = new Set(this.traceIndex.keys());
    }

    const traces: Trace[] = [];

    for (const traceId of traceIds) {
      const trace = this.buildTrace(traceId);
      if (!trace) continue;

      if (sinceMs > 0 && trace.startTime < sinceMs) continue;
      if (filter.hasErrors && trace.errorCount === 0) continue;
      if (filter.minDurationMs && trace.duration < filter.minDurationMs) continue;

      traces.push(trace);
    }

    traces.sort((a, b) => b.startTime - a.startTime);
    return traces.slice(0, limit);
  }

  querySpans(filter: SpanFilter = {}): { spans: Span[]; traceCount: number } {
    const limit = Math.min(filter.limit ?? 50, 200);
    const sinceMs = filter.sinceMinutes ? Date.now() - filter.sinceMinutes * 60 * 1000 : 0;

    const matchingSpans: Span[] = [];
    const traceIds = new Set<string>();

    for (const span of this.spans.values()) {
      if (sinceMs > 0 && span.startTime < sinceMs) continue;
      if (filter.service && span.serviceName !== filter.service) continue;
      if (filter.name && !span.name.toLowerCase().includes(filter.name.toLowerCase())) continue;
      if (filter.minDurationMs && span.duration < filter.minDurationMs) continue;
      if (filter.hasError && span.status !== 'error') continue;

      if (filter.attribute) {
        const [key, value] = filter.attribute.split('=');
        if (!key) continue;
        const attrValue = span.attributes[key];
        if (attrValue === undefined) continue;
        if (value !== undefined && String(attrValue) !== value) continue;
      }

      matchingSpans.push(span);
      traceIds.add(span.traceId);
    }

    matchingSpans.sort((a, b) => b.startTime - a.startTime);
    return {
      spans: matchingSpans.slice(0, limit),
      traceCount: traceIds.size,
    };
  }

  getSummary(): {
    traceCount: number;
    spanCount: number;
    oldestTimestamp: number | null;
    newestTimestamp: number | null;
    services: Map<string, { traceCount: number; spanCount: number; errorCount: number }>;
    recentErrors: Array<{ traceId: string; service: string; message: string }>;
  } {
    const services = new Map<
      string,
      { traceCount: number; spanCount: number; errorCount: number }
    >();
    const recentErrors: Array<{ traceId: string; service: string; message: string; time: number }> =
      [];

    let oldest: number | null = null;
    let newest: number | null = null;

    for (const span of this.spans.values()) {
      if (oldest === null || span.startTime < oldest) oldest = span.startTime;
      if (newest === null || span.startTime > newest) newest = span.startTime;

      if (!services.has(span.serviceName)) {
        services.set(span.serviceName, { traceCount: 0, spanCount: 0, errorCount: 0 });
      }
      const svc = services.get(span.serviceName)!;
      svc.spanCount++;
      if (span.status === 'error') {
        svc.errorCount++;
        recentErrors.push({
          traceId: span.traceId,
          service: span.serviceName,
          message:
            span.statusMessage || (span.attributes['exception.message'] as string) || span.name,
          time: span.startTime,
        });
      }
    }

    for (const [service, traceIds] of this.serviceIndex) {
      const svc = services.get(service);
      if (svc) {
        svc.traceCount = traceIds.size;
      }
    }

    recentErrors.sort((a, b) => b.time - a.time);

    return {
      traceCount: this.traceIndex.size,
      spanCount: this.spans.size,
      oldestTimestamp: oldest,
      newestTimestamp: newest,
      services,
      recentErrors: recentErrors.slice(0, 5).map((e) => ({
        traceId: e.traceId,
        service: e.service,
        message: e.message,
      })),
    };
  }

  clear(): void {
    this.spans.clear();
    this.traceIndex.clear();
    this.serviceIndex.clear();
    this.traceTimestamps.clear();
  }
}
