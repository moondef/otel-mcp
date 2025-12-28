export type SpanKind = 'unspecified' | 'internal' | 'server' | 'client' | 'producer' | 'consumer';
export type SpanStatus = 'ok' | 'error' | 'unset';

export interface Span {
  traceId: string;
  spanId: string;
  parentSpanId: string | null;
  name: string;
  kind: SpanKind;
  startTime: number;
  endTime: number;
  duration: number;
  status: SpanStatus;
  statusMessage: string | null;
  attributes: Record<string, string | number | boolean>;
  serviceName: string;
  resourceAttributes: Record<string, string | number | boolean>;
}

export interface Trace {
  traceId: string;
  rootSpan: Span | null;
  spans: Span[];
  services: string[];
  startTime: number;
  endTime: number;
  duration: number;
  spanCount: number;
  errorCount: number;
}
