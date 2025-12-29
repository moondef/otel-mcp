import { formatDuration } from '../../format/duration.ts';
import { formatTable, truncate } from '../../format/table.ts';
import type { TraceStore } from '../../store/trace-store.ts';

export interface ListTracesParams {
  service?: string;
  has_errors?: boolean;
  min_duration_ms?: number;
  since_minutes?: number;
  since?: string;
  limit?: number;
}

export function listTraces(store: TraceStore, params: ListTracesParams): string {
  let sinceTimestamp: number | undefined;
  if (params.since) {
    const parsed = Date.parse(params.since);
    if (!Number.isNaN(parsed)) {
      sinceTimestamp = parsed;
    }
  }

  const traces = store.listTraces({
    service: params.service,
    hasErrors: params.has_errors,
    minDurationMs: params.min_duration_ms,
    sinceMinutes: sinceTimestamp ? undefined : (params.since_minutes ?? 30),
    sinceTimestamp,
    limit: params.limit,
  });

  if (traces.length === 0) {
    return 'No traces found.\n\nTry adjusting filters or check that your app is sending traces to http://localhost:4318/v1/traces';
  }

  const summary = store.getSummary();
  const header = `Recent Traces (${traces.length} of ${summary.traceCount})`;

  const columns = [
    { header: 'TRACE ID', width: 16 },
    { header: 'SERVICE', width: 14 },
    { header: 'DURATION', width: 10, align: 'right' as const },
    { header: 'SPANS', width: 6, align: 'right' as const },
    { header: 'ERRORS', width: 6, align: 'right' as const },
    { header: 'ROOT', width: 24 },
  ];

  const rows = traces.map((trace) => [
    truncate(trace.traceId, 16),
    trace.services[0] ?? 'unknown',
    formatDuration(trace.duration),
    String(trace.spanCount),
    String(trace.errorCount),
    truncate(trace.rootSpan?.name ?? '-', 24),
  ]);

  const table = formatTable(columns, rows);

  return `${header}\n\n${table}\n\nUse get_trace for full span tree.`;
}
