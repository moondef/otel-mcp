import { describe, expect, it } from 'vitest';
import { matchesFilter, parseFilter } from '../store/filter-parser.ts';
import type { Span } from '../store/types.ts';

const createSpan = (overrides: Partial<Span> = {}): Span => ({
  traceId: 'trace-1',
  spanId: 'span-1',
  parentSpanId: null,
  name: 'test-span',
  kind: 'internal',
  startTime: Date.now(),
  endTime: Date.now() + 100,
  duration: 100,
  status: 'ok',
  statusMessage: null,
  attributes: {},
  serviceName: 'test-service',
  resourceAttributes: {},
  ...overrides,
});

describe('parseFilter', () => {
  it('parses simple equality', () => {
    const result = parseFilter('status = error');
    expect(result).toEqual({
      conditions: [{ field: 'status', operator: '=', value: 'error' }],
    });
  });

  it('parses numeric comparison', () => {
    const result = parseFilter('duration > 100');
    expect(result).toEqual({
      conditions: [{ field: 'duration', operator: '>', value: 100 }],
    });
  });

  it('parses greater than or equal', () => {
    const result = parseFilter('http.status_code >= 400');
    expect(result).toEqual({
      conditions: [{ field: 'http.status_code', operator: '>=', value: 400 }],
    });
  });

  it('parses AND conditions', () => {
    const result = parseFilter('duration > 50 AND status = error');
    expect(result).toEqual({
      conditions: [
        { field: 'duration', operator: '>', value: 50 },
        { field: 'status', operator: '=', value: 'error' },
      ],
    });
  });

  it('parses case-insensitive AND', () => {
    const result = parseFilter('duration > 50 and status = error');
    expect(result).toEqual({
      conditions: [
        { field: 'duration', operator: '>', value: 50 },
        { field: 'status', operator: '=', value: 'error' },
      ],
    });
  });

  it('returns error for invalid expression', () => {
    const result = parseFilter('invalid');
    expect(result).toHaveProperty('error');
  });

  it('ignores trailing AND with empty part', () => {
    const result = parseFilter('duration > 100 AND');
    expect(result).toEqual({
      conditions: [{ field: 'duration', operator: '>', value: 100 }],
    });
  });
});

describe('matchesFilter', () => {
  it('matches duration comparison', () => {
    const span = createSpan({ duration: 150 });
    const filter = parseFilter('duration > 100');
    if ('error' in filter) throw new Error('Parse failed');
    expect(matchesFilter(span, filter)).toBe(true);
  });

  it('rejects when duration does not match', () => {
    const span = createSpan({ duration: 50 });
    const filter = parseFilter('duration > 100');
    if ('error' in filter) throw new Error('Parse failed');
    expect(matchesFilter(span, filter)).toBe(false);
  });

  it('matches status equality', () => {
    const span = createSpan({ status: 'error' });
    const filter = parseFilter('status = error');
    if ('error' in filter) throw new Error('Parse failed');
    expect(matchesFilter(span, filter)).toBe(true);
  });

  it('matches span attributes', () => {
    const span = createSpan({ attributes: { 'http.status_code': 500 } });
    const filter = parseFilter('http.status_code >= 400');
    if ('error' in filter) throw new Error('Parse failed');
    expect(matchesFilter(span, filter)).toBe(true);
  });

  it('matches multiple conditions with AND', () => {
    const span = createSpan({ duration: 150, status: 'error' });
    const filter = parseFilter('duration > 100 AND status = error');
    if ('error' in filter) throw new Error('Parse failed');
    expect(matchesFilter(span, filter)).toBe(true);
  });

  it('rejects when one AND condition fails', () => {
    const span = createSpan({ duration: 150, status: 'ok' });
    const filter = parseFilter('duration > 100 AND status = error');
    if ('error' in filter) throw new Error('Parse failed');
    expect(matchesFilter(span, filter)).toBe(false);
  });

  it('returns false for missing attribute', () => {
    const span = createSpan({ attributes: {} });
    const filter = parseFilter('http.status_code >= 400');
    if ('error' in filter) throw new Error('Parse failed');
    expect(matchesFilter(span, filter)).toBe(false);
  });

  it('matches resource attributes', () => {
    const span = createSpan({ resourceAttributes: { 'k8s.pod.name': 'my-pod' } });
    const filter = parseFilter('k8s.pod.name = my-pod');
    if ('error' in filter) throw new Error('Parse failed');
    expect(matchesFilter(span, filter)).toBe(true);
  });

  it('matches inequality', () => {
    const span = createSpan({ status: 'ok' });
    const filter = parseFilter('status != error');
    if ('error' in filter) throw new Error('Parse failed');
    expect(matchesFilter(span, filter)).toBe(true);
  });
});
