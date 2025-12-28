import type { TraceStore } from '../../store/trace-store.ts';
import { formatDuration } from '../../format/duration.ts';
import { formatSpanTree } from '../../format/tree.ts';

export interface GetTraceParams {
  trace_id: string;
  show_attributes?: boolean;
}

export function getTrace(store: TraceStore, params: GetTraceParams): string {
  const traceId = params.trace_id;

  if (traceId.length < 6) {
    return 'Error: trace_id must be at least 6 characters';
  }

  const trace = store.getTrace(traceId);

  if (!trace) {
    const matches = store.findTracesByPrefix(traceId);
    if (matches.length > 1) {
      const matchList = matches.slice(0, 5).map(id => `  ${id}`).join('\n');
      const more = matches.length > 5 ? `\n  ...and ${matches.length - 5} more` : '';
      return `Ambiguous trace ID prefix '${traceId}' matches:\n${matchList}${more}`;
    }
    return `Trace not found: ${traceId}`;
  }

  const services = trace.services.join(', ');
  const errorInfo = trace.errorCount > 0 ? `, ${trace.errorCount} errors` : '';

  const header = [
    `Trace ${trace.traceId}`,
    '',
    `Services: ${services}`,
    `Duration: ${formatDuration(trace.duration)}`,
    `Spans: ${trace.spanCount}${errorInfo}`,
  ].join('\n');

  const tree = formatSpanTree(trace.spans, params.show_attributes ?? false);
  const separator = '-'.repeat(64);

  return `${header}\n\nSPAN TREE\n${separator}\n${tree}`;
}
