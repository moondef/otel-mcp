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

function isValidSpan(span: unknown): span is OtlpSpan {
  if (!span || typeof span !== 'object') return false;

  const s = span as Record<string, unknown>;

  if (typeof s.traceId !== 'string' || s.traceId.length === 0) return false;
  if (typeof s.spanId !== 'string' || s.spanId.length === 0) return false;
  if (typeof s.name !== 'string') return false;
  if (typeof s.startTimeUnixNano !== 'string') return false;
  if (typeof s.endTimeUnixNano !== 'string') return false;

  return true;
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
  if (value.intValue !== undefined) return Number.parseInt(value.intValue, 10);
  if (value.doubleValue !== undefined) return value.doubleValue;
  if (value.boolValue !== undefined) return value.boolValue;
  if (value.arrayValue !== undefined) {
    return value.arrayValue.values.map((v) => parseOtlpValue(v)).join(', ');
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
  return Math.floor(Number.parseInt(nano, 10) / 1_000_000);
}

function getServiceName(resourceAttrs: Record<string, string | number | boolean>): string {
  const name = resourceAttrs['service.name'];
  return typeof name === 'string' ? name : 'unknown';
}

export function parseOtlpRequest(request: unknown): Span[] {
  if (!request || typeof request !== 'object') {
    return [];
  }

  const req = request as Record<string, unknown>;
  const resourceSpans = req.resourceSpans;

  if (!Array.isArray(resourceSpans)) {
    return [];
  }

  const spans: Span[] = [];

  for (const resourceSpan of resourceSpans as OtlpResourceSpans[]) {
    const resourceAttributes = parseAttributes(resourceSpan.resource?.attributes);
    const serviceName = getServiceName(resourceAttributes);

    for (const scopeSpans of resourceSpan.scopeSpans ?? []) {
      if (!Array.isArray(scopeSpans.spans)) continue;

      for (const rawSpan of scopeSpans.spans) {
        if (!isValidSpan(rawSpan)) continue;

        const startTime = nanoToMs(rawSpan.startTimeUnixNano);
        const endTime = nanoToMs(rawSpan.endTimeUnixNano);

        spans.push({
          traceId: rawSpan.traceId,
          spanId: rawSpan.spanId,
          parentSpanId: rawSpan.parentSpanId || null,
          name: rawSpan.name,
          kind: SPAN_KIND_MAP[rawSpan.kind ?? 0] ?? 'unspecified',
          startTime,
          endTime,
          duration: endTime - startTime,
          status: STATUS_MAP[rawSpan.status?.code ?? 0] ?? 'unset',
          statusMessage: rawSpan.status?.message ?? null,
          attributes: parseAttributes(rawSpan.attributes),
          serviceName,
          resourceAttributes,
        });
      }
    }
  }

  return spans;
}
