import type { Span, SpanKind, SpanStatus } from '../store/types.ts';

interface OtlpValue {
  stringValue?: string;
  intValue?: string;
  boolValue?: boolean;
  doubleValue?: number;
  arrayValue?: { values: OtlpValue[] };
}

interface OtlpAttribute {
  key: string;
  value: OtlpValue;
}

interface OtlpSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind?: number;
  startTimeUnixNano: string;
  endTimeUnixNano: string;
  attributes?: OtlpAttribute[];
  status?: {
    code?: number;
    message?: string;
  };
}

interface OtlpScopeSpans {
  spans: OtlpSpan[];
}

interface OtlpResource {
  attributes?: OtlpAttribute[];
}

interface OtlpResourceSpans {
  resource?: OtlpResource;
  scopeSpans?: OtlpScopeSpans[];
}

export interface OtlpExportRequest {
  resourceSpans?: OtlpResourceSpans[];
}

const SPAN_KIND_MAP: Record<number, SpanKind> = {
  0: 'unspecified',
  1: 'internal',
  2: 'server',
  3: 'client',
  4: 'producer',
  5: 'consumer',
};

const STATUS_MAP: Record<number, SpanStatus> = {
  0: 'unset',
  1: 'ok',
  2: 'error',
};

function parseOtlpValue(value: OtlpValue): string | number | boolean {
  if (value.stringValue !== undefined) return value.stringValue;
  if (value.intValue !== undefined) return parseInt(value.intValue, 10);
  if (value.doubleValue !== undefined) return value.doubleValue;
  if (value.boolValue !== undefined) return value.boolValue;
  if (value.arrayValue !== undefined) {
    return value.arrayValue.values.map(v => parseOtlpValue(v)).join(', ');
  }
  return '';
}

function parseAttributes(attrs?: OtlpAttribute[]): Record<string, string | number | boolean> {
  if (!attrs) return {};
  const result: Record<string, string | number | boolean> = {};
  for (const attr of attrs) {
    result[attr.key] = parseOtlpValue(attr.value);
  }
  return result;
}

function nanoToMs(nano: string): number {
  return Math.floor(parseInt(nano, 10) / 1_000_000);
}

function getServiceName(resourceAttrs: Record<string, string | number | boolean>): string {
  const name = resourceAttrs['service.name'];
  return typeof name === 'string' ? name : 'unknown';
}

export function parseOtlpRequest(request: OtlpExportRequest): Span[] {
  const spans: Span[] = [];

  for (const resourceSpans of request.resourceSpans ?? []) {
    const resourceAttributes = parseAttributes(resourceSpans.resource?.attributes);
    const serviceName = getServiceName(resourceAttributes);

    for (const scopeSpans of resourceSpans.scopeSpans ?? []) {
      for (const otlpSpan of scopeSpans.spans) {
        const startTime = nanoToMs(otlpSpan.startTimeUnixNano);
        const endTime = nanoToMs(otlpSpan.endTimeUnixNano);

        spans.push({
          traceId: otlpSpan.traceId,
          spanId: otlpSpan.spanId,
          parentSpanId: otlpSpan.parentSpanId || null,
          name: otlpSpan.name,
          kind: SPAN_KIND_MAP[otlpSpan.kind ?? 0] ?? 'unspecified',
          startTime,
          endTime,
          duration: endTime - startTime,
          status: STATUS_MAP[otlpSpan.status?.code ?? 0] ?? 'unset',
          statusMessage: otlpSpan.status?.message ?? null,
          attributes: parseAttributes(otlpSpan.attributes),
          serviceName,
          resourceAttributes,
        });
      }
    }
  }

  return spans;
}
