import type { TraceStore } from '../../store/trace-store.ts';
import { formatMinutesRange } from '../../format/duration.ts';
import { truncate } from '../../format/table.ts';

export function getSummary(store: TraceStore): string {
  const summary = store.getSummary();

  if (summary.traceCount === 0) {
    return [
      'otel-mcp Summary',
      '',
      'No traces collected yet.',
      '',
      'Send traces to http://localhost:4318/v1/traces',
    ].join('\n');
  }

  const lines: string[] = [
    'otel-mcp Summary',
    '',
    `Storage: ${summary.traceCount} traces, ${summary.spanCount} spans`,
    `Time range: ${formatMinutesRange(summary.oldestTimestamp, summary.newestTimestamp)}`,
    '',
    'Services:',
  ];

  for (const [service, stats] of summary.services) {
    const errorPart = stats.errorCount > 0 ? `  ${stats.errorCount} errors` : '';
    lines.push(`  ${service.padEnd(16)} ${String(stats.traceCount).padStart(4)} traces  ${String(stats.spanCount).padStart(5)} spans${errorPart}`);
  }

  if (summary.recentErrors.length > 0) {
    lines.push('');
    lines.push('Recent errors:');
    for (const err of summary.recentErrors) {
      const prefix = truncate(err.traceId, 8);
      lines.push(`  [${prefix}] ${err.service}: ${truncate(err.message, 50)}`);
    }
  }

  lines.push('');
  lines.push('Use list_traces, get_trace, or query_spans for details.');

  return lines.join('\n');
}
