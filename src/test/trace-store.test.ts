import { beforeEach, describe, expect, it } from 'vitest';
import { TraceStore } from '../store/trace-store.ts';
import type { Span } from '../store/types.ts';

function createSpan(overrides: Partial<Span> = {}): Span {
  return {
    traceId: 'abc123def456',
    spanId: 'span001',
    parentSpanId: null,
    name: 'test-span',
    kind: 'server',
    startTime: Date.now(),
    endTime: Date.now() + 100,
    duration: 100,
    status: 'ok',
    statusMessage: null,
    attributes: {},
    serviceName: 'test-service',
    resourceAttributes: {},
    ...overrides,
  };
}

describe('TraceStore', () => {
  let store: TraceStore;

  beforeEach(() => {
    store = new TraceStore({ maxTraces: 10, maxSpans: 100 });
  });

  it('should add and retrieve spans', () => {
    const span = createSpan();
    store.addSpans([span]);

    const trace = store.getTrace('abc123def456');
    expect(trace).not.toBeNull();
    expect(trace!.spans).toHaveLength(1);
    expect(trace!.traceId).toBe('abc123def456');
  });

  it('should build trace tree correctly', () => {
    const root = createSpan({ spanId: 'root', name: 'root-span' });
    const child = createSpan({
      spanId: 'child',
      parentSpanId: 'root',
      name: 'child-span',
      startTime: root.startTime + 10,
      endTime: root.endTime - 10,
    });

    store.addSpans([root, child]);

    const trace = store.getTrace('abc123def456');
    expect(trace!.rootSpan?.spanId).toBe('root');
    expect(trace!.spans).toHaveLength(2);
  });

  it('should filter by service', () => {
    store.addSpans([
      createSpan({ traceId: 'trace1', serviceName: 'api' }),
      createSpan({ traceId: 'trace2', serviceName: 'worker' }),
    ]);

    const apiTraces = store.listTraces({ service: 'api' });
    expect(apiTraces).toHaveLength(1);
    expect(apiTraces[0]!.services).toContain('api');
  });

  it('should filter by errors', () => {
    store.addSpans([
      createSpan({ traceId: 'trace1', status: 'ok' }),
      createSpan({ traceId: 'trace2', status: 'error' }),
    ]);

    const errorTraces = store.listTraces({ hasErrors: true });
    expect(errorTraces).toHaveLength(1);
    expect(errorTraces[0]!.errorCount).toBeGreaterThan(0);
  });

  it('should enforce LRU eviction', () => {
    const store = new TraceStore({ maxTraces: 2, maxSpans: 100 });

    store.addSpans([
      createSpan({ traceId: 'trace1', startTime: 1000 }),
      createSpan({ traceId: 'trace2', startTime: 2000 }),
      createSpan({ traceId: 'trace3', startTime: 3000 }),
    ]);

    expect(store.getTrace('trace1')).toBeNull();
    expect(store.getTrace('trace2')).not.toBeNull();
    expect(store.getTrace('trace3')).not.toBeNull();
  });

  it('should query spans across traces', () => {
    store.addSpans([
      createSpan({ traceId: 'trace1', name: 'pg.query', duration: 150 }),
      createSpan({ traceId: 'trace1', spanId: 'span2', name: 'redis.get', duration: 20 }),
      createSpan({ traceId: 'trace2', name: 'pg.query', duration: 200 }),
    ]);

    const result = store.querySpans({ name: 'pg.query', minDurationMs: 100 });
    expect(result.spans).toHaveLength(2);
    expect(result.traceCount).toBe(2);
  });

  it('should match trace by prefix', () => {
    store.addSpans([createSpan({ traceId: 'abc123def456789' })]);

    const trace = store.getTrace('abc123');
    expect(trace).not.toBeNull();
    expect(trace!.traceId).toBe('abc123def456789');
  });
});
