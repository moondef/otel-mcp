import { describe, it, expect } from 'bun:test';
import { parseOtlpRequest } from '../receiver/otlp.ts';

describe('OTLP Parser', () => {
  it('should parse basic OTLP request', () => {
    const request = {
      resourceSpans: [
        {
          resource: {
            attributes: [
              { key: 'service.name', value: { stringValue: 'my-service' } },
            ],
          },
          scopeSpans: [
            {
              spans: [
                {
                  traceId: 'abc123',
                  spanId: 'span001',
                  name: 'GET /users',
                  kind: 2,
                  startTimeUnixNano: '1700000000000000000',
                  endTimeUnixNano: '1700000000100000000',
                  attributes: [
                    { key: 'http.method', value: { stringValue: 'GET' } },
                    { key: 'http.status_code', value: { intValue: '200' } },
                  ],
                  status: { code: 1 },
                },
              ],
            },
          ],
        },
      ],
    };

    const spans = parseOtlpRequest(request);

    expect(spans).toHaveLength(1);
    expect(spans[0]!.traceId).toBe('abc123');
    expect(spans[0]!.name).toBe('GET /users');
    expect(spans[0]!.kind).toBe('server');
    expect(spans[0]!.status).toBe('ok');
    expect(spans[0]!.serviceName).toBe('my-service');
    expect(spans[0]!.attributes['http.method']).toBe('GET');
    expect(spans[0]!.attributes['http.status_code']).toBe(200);
    expect(spans[0]!.duration).toBe(100);
  });

  it('should handle error status', () => {
    const request = {
      resourceSpans: [
        {
          resource: { attributes: [] },
          scopeSpans: [
            {
              spans: [
                {
                  traceId: 'abc123',
                  spanId: 'span001',
                  name: 'failing-operation',
                  startTimeUnixNano: '1700000000000000000',
                  endTimeUnixNano: '1700000000100000000',
                  status: { code: 2, message: 'Something went wrong' },
                },
              ],
            },
          ],
        },
      ],
    };

    const spans = parseOtlpRequest(request);

    expect(spans[0]!.status).toBe('error');
    expect(spans[0]!.statusMessage).toBe('Something went wrong');
  });

  it('should handle parent span ID', () => {
    const request = {
      resourceSpans: [
        {
          resource: { attributes: [] },
          scopeSpans: [
            {
              spans: [
                {
                  traceId: 'abc123',
                  spanId: 'child',
                  parentSpanId: 'parent',
                  name: 'child-span',
                  startTimeUnixNano: '1700000000000000000',
                  endTimeUnixNano: '1700000000100000000',
                },
              ],
            },
          ],
        },
      ],
    };

    const spans = parseOtlpRequest(request);
    expect(spans[0]!.parentSpanId).toBe('parent');
  });

  it('should handle empty request', () => {
    const spans = parseOtlpRequest({});
    expect(spans).toHaveLength(0);
  });
});
