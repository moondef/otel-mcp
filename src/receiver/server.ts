import { type ServerType, serve } from '@hono/node-server';
import { Hono } from 'hono';
import { getSummary } from '../mcp/tools/get-summary.ts';
import { getTrace } from '../mcp/tools/get-trace.ts';
import { listTraces } from '../mcp/tools/list-traces.ts';
import { querySpans } from '../mcp/tools/query-spans.ts';
import type { TraceStore } from '../store/trace-store.ts';
import { parseOtlpRequest } from './otlp.ts';

export interface ReceiverConfig {
  port: number;
  host: string;
}

export class OtlpReceiver {
  private server: ServerType | null = null;
  private store: TraceStore;
  private config: ReceiverConfig;

  constructor(store: TraceStore, config: Partial<ReceiverConfig> = {}) {
    this.store = store;
    this.config = {
      port: config.port ?? 4318,
      host: config.host ?? 'localhost',
    };
  }

  start(): Promise<void> {
    const app = new Hono();

    app.get('/health', (c) => c.json({ status: 'ok', service: 'otel-mcp' }));

    // OTLP trace ingestion
    app.post('/v1/traces', async (c) => {
      const contentType = c.req.header('content-type') ?? '';

      if (!contentType.includes('application/json')) {
        return c.text('Unsupported content type. Use application/json', 415);
      }

      try {
        const data = await c.req.json();
        const spans = parseOtlpRequest(data);
        this.store.addSpans(spans);
        return c.json({});
      } catch {
        return c.text('Invalid JSON', 400);
      }
    });

    // MCP tool endpoints - return formatted text for client mode
    app.get('/mcp/list_traces', (c) => {
      const result = listTraces(this.store, {
        service: c.req.query('service'),
        has_errors: c.req.query('has_errors') === 'true' ? true : undefined,
        min_duration_ms: c.req.query('min_duration_ms')
          ? Number(c.req.query('min_duration_ms'))
          : undefined,
        since_minutes: c.req.query('since_minutes')
          ? Number(c.req.query('since_minutes'))
          : undefined,
        since: c.req.query('since'),
        limit: c.req.query('limit') ? Number(c.req.query('limit')) : undefined,
      });
      return c.text(result);
    });

    app.get('/mcp/get_trace', (c) => {
      const traceId = c.req.query('trace_id');
      if (!traceId) {
        return c.text('Error: trace_id is required', 400);
      }
      const result = getTrace(this.store, {
        trace_id: traceId,
        show_attributes: c.req.query('show_attributes') === 'true',
      });
      return c.text(result);
    });

    app.get('/mcp/query_spans', (c) => {
      const result = querySpans(this.store, {
        name: c.req.query('name'),
        service: c.req.query('service'),
        min_duration_ms: c.req.query('min_duration_ms')
          ? Number(c.req.query('min_duration_ms'))
          : undefined,
        has_error: c.req.query('has_error') === 'true' ? true : undefined,
        attribute: c.req.query('attribute'),
        where: c.req.query('where'),
        since_minutes: c.req.query('since_minutes')
          ? Number(c.req.query('since_minutes'))
          : undefined,
        limit: c.req.query('limit') ? Number(c.req.query('limit')) : undefined,
      });
      return c.text(result);
    });

    app.get('/mcp/get_summary', (c) => {
      const result = getSummary(this.store);
      return c.text(result);
    });

    app.post('/mcp/clear_traces', (c) => {
      const summary = this.store.getSummary();
      const { traceCount, spanCount } = summary;
      this.store.clear();
      return c.text(`Cleared ${traceCount} traces (${spanCount} spans).`);
    });

    return new Promise((resolve) => {
      this.server = serve(
        {
          fetch: app.fetch,
          port: this.config.port,
          hostname: this.config.host,
        },
        () => resolve(),
      );
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }

  get address(): string {
    return `http://${this.config.host}:${this.config.port}`;
  }
}
