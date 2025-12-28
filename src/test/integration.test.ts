import { describe, it, expect, setDefaultTimeout } from 'bun:test';

setDefaultTimeout(30000);
import { TraceStore } from '../store/trace-store.ts';
import { OtlpReceiver } from '../receiver/server.ts';
import { listTraces } from '../mcp/tools/list-traces.ts';
import { getTrace } from '../mcp/tools/get-trace.ts';
import { querySpans } from '../mcp/tools/query-spans.ts';
import { getSummary } from '../mcp/tools/get-summary.ts';

async function waitForServer(port: number, maxRetries = 20): Promise<void> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(`http://localhost:${port}/health`);
      if (response.ok) return;
    } catch {
      await Bun.sleep(100);
    }
  }
  throw new Error(`Server not ready on port ${port}`);
}

describe('Integration', () => {
  it('should handle complete OTLP flow', async () => {
    const port = 14318 + Math.floor(Math.random() * 1000);
    const store = new TraceStore();
    const receiver = new OtlpReceiver(store, { port });

    try {
      receiver.start();
      await waitForServer(port);

      const healthResponse = await fetch(`http://localhost:${port}/health`);
      expect(healthResponse.status).toBe(200);

      const otlpRequest = {
        resourceSpans: [
          {
            resource: {
              attributes: [
                { key: 'service.name', value: { stringValue: 'test-svc' } },
              ],
            },
            scopeSpans: [
              {
                spans: [
                  {
                    traceId: 'abc123def456',
                    spanId: 'span001',
                    name: 'GET /users',
                    kind: 2,
                    startTimeUnixNano: String(Date.now() * 1_000_000),
                    endTimeUnixNano: String((Date.now() + 150) * 1_000_000),
                    attributes: [
                      { key: 'http.method', value: { stringValue: 'GET' } },
                    ],
                    status: { code: 1 },
                  },
                ],
              },
            ],
          },
        ],
      };

      const traceResponse = await fetch(`http://localhost:${port}/v1/traces`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(otlpRequest),
      });
      expect(traceResponse.status).toBe(200);

      const trace = store.getTrace('abc123def456');
      expect(trace).not.toBeNull();
      expect(trace!.spans[0]!.name).toBe('GET /users');

      const listOutput = listTraces(store, {});
      expect(listOutput).toContain('Recent Traces');
      expect(listOutput).toContain('GET /users');

      const getOutput = getTrace(store, { trace_id: 'abc123' });
      expect(getOutput).toContain('Trace abc123def456');
      expect(getOutput).toContain('SPAN TREE');

      const queryOutput = querySpans(store, { name: 'GET' });
      expect(queryOutput).toContain('GET /users');

      const summaryOutput = getSummary(store);
      expect(summaryOutput).toContain('otel-mcp Summary');
      expect(summaryOutput).toContain('test-svc');

      const notFoundOutput = getTrace(store, { trace_id: 'nonexistent123456' });
      expect(notFoundOutput).toContain('Trace not found');

      const badContentType = await fetch(`http://localhost:${port}/v1/traces`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-protobuf' },
        body: 'binary',
      });
      expect(badContentType.status).toBe(415);
    } finally {
      receiver.stop();
    }
  });
});
