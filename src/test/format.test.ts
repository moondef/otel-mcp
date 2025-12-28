import { describe, expect, it } from 'vitest';
import { formatDuration, formatRelativeTime, formatTimeRange } from '../format/duration.ts';
import { formatTable, truncate } from '../format/table.ts';
import { formatSpanTree } from '../format/tree.ts';
import type { Span } from '../store/types.ts';

describe('Duration Formatter', () => {
  it('should format milliseconds', () => {
    expect(formatDuration(0)).toBe('<1ms');
    expect(formatDuration(50)).toBe('50ms');
    expect(formatDuration(999)).toBe('999ms');
  });

  it('should format seconds', () => {
    expect(formatDuration(1000)).toBe('1.0s');
    expect(formatDuration(1500)).toBe('1.5s');
    expect(formatDuration(9999)).toBe('10.0s');
    expect(formatDuration(15000)).toBe('15s');
  });

  it('should format time range', () => {
    expect(formatTimeRange(1000, 1100, 1000)).toBe('[0ms-100ms]');
    expect(formatTimeRange(1050, 1200, 1000)).toBe('[50ms-200ms]');
  });

  it('should format relative time', () => {
    const now = Date.now();
    expect(formatRelativeTime(now)).toBe('just now');
    expect(formatRelativeTime(now - 120000)).toBe('2 min ago');
    expect(formatRelativeTime(now - 7200000)).toBe('2 hours ago');
  });
});

describe('Table Formatter', () => {
  it('should format basic table', () => {
    const columns = [
      { header: 'NAME', width: 10 },
      { header: 'VALUE', width: 8, align: 'right' as const },
    ];
    const rows = [
      ['foo', '123'],
      ['bar', '456'],
    ];

    const result = formatTable(columns, rows);
    expect(result).toContain('NAME');
    expect(result).toContain('VALUE');
    expect(result).toContain('foo');
    expect(result).toContain('123');
  });

  it('should truncate long values', () => {
    expect(truncate('short', 10)).toBe('short');
    expect(truncate('this is a very long string', 10)).toBe('this is...');
  });
});

describe('Tree Formatter', () => {
  function createSpan(overrides: Partial<Span>): Span {
    return {
      traceId: 'trace1',
      spanId: 'span1',
      parentSpanId: null,
      name: 'test',
      kind: 'server',
      startTime: 1000,
      endTime: 1100,
      duration: 100,
      status: 'ok',
      statusMessage: null,
      attributes: {},
      serviceName: 'test',
      resourceAttributes: {},
      ...overrides,
    };
  }

  it('should format single span', () => {
    const spans = [createSpan({ name: 'GET /users' })];
    const result = formatSpanTree(spans, false);

    expect(result).toContain('GET /users');
    expect(result).toContain('[0ms-100ms]');
    expect(result).toContain('(server)');
  });

  it('should format parent-child relationship', () => {
    const spans = [
      createSpan({ spanId: 'root', name: 'root' }),
      createSpan({ spanId: 'child', parentSpanId: 'root', name: 'child', startTime: 1010 }),
    ];
    const result = formatSpanTree(spans, false);

    expect(result).toContain('root');
    expect(result).toContain('child');
  });

  it('should show error indicator', () => {
    const spans = [createSpan({ status: 'error' })];
    const result = formatSpanTree(spans, false);

    expect(result).toContain('[ERROR]');
  });

  it('should show attributes when requested', () => {
    const spans = [
      createSpan({
        attributes: { 'http.method': 'GET', 'http.url': '/users' },
      }),
    ];
    const result = formatSpanTree(spans, true);

    expect(result).toContain('http.method: GET');
    expect(result).toContain('http.url: /users');
  });
});
