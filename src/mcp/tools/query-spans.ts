import type { TraceStore } from '../../store/trace-store.ts';
import { formatDuration } from '../../format/duration.ts';
import { formatTable, truncate } from '../../format/table.ts';

export interface QuerySpansParams {
  name?: string;
  service?: string;
  min_duration_ms?: number;
  has_error?: boolean;
  attribute?: string;
  since_minutes?: number;
  limit?: number;
}

export function querySpans(store: TraceStore, params: QuerySpansParams): string {
  const result = store.querySpans({
    name: params.name,
    service: params.service,
    minDurationMs: params.min_duration_ms,
    hasError: params.has_error,
    attribute: params.attribute,
    sinceMinutes: params.since_minutes ?? 30,
    limit: params.limit,
  });

  if (result.spans.length === 0) {
    return 'No spans found matching criteria.';
  }

  const filters: string[] = [];
  if (params.name) filters.push(`name contains "${params.name}"`);
  if (params.service) filters.push(`service="${params.service}"`);
  if (params.min_duration_ms) filters.push(`min_duration_ms=${params.min_duration_ms}`);
  if (params.has_error) filters.push('has_error=true');
  if (params.attribute) filters.push(`attribute="${params.attribute}"`);

  const header = filters.length > 0
    ? `Spans matching: ${filters.join(', ')}`
    : 'All spans';

  const columns = [
    { header: 'SPAN NAME', width: 32 },
    { header: 'SERVICE', width: 14 },
    { header: 'DURATION', width: 10, align: 'right' as const },
    { header: 'TRACE ID', width: 16 },
  ];

  const rows = result.spans.map(span => [
    truncate(span.name, 32),
    span.serviceName,
    formatDuration(span.duration),
    truncate(span.traceId, 16),
  ]);

  const table = formatTable(columns, rows);
  const summary = `\n${result.spans.length} spans across ${result.traceCount} traces`;

  return `${header}\n\n${table}${summary}`;
}
