import { type ServerType, serve } from '@hono/node-server';
import { Hono } from 'hono';
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

    app.get('/health', (c) => c.json({ status: 'ok' }));

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
