import type { TraceStore } from '../store/trace-store.ts';
import { type OtlpExportRequest, parseOtlpRequest } from './otlp.ts';

export interface ReceiverConfig {
  port: number;
  host: string;
}

export class OtlpReceiver {
  private server: ReturnType<typeof Bun.serve> | null = null;
  private store: TraceStore;
  private config: ReceiverConfig;

  constructor(store: TraceStore, config: Partial<ReceiverConfig> = {}) {
    this.store = store;
    this.config = {
      port: config.port ?? 4318,
      host: config.host ?? 'localhost',
    };
  }

  start(): void {
    this.server = Bun.serve({
      port: this.config.port,
      hostname: this.config.host,
      fetch: (req) => this.handleRequest(req),
    });
  }

  stop(): void {
    this.server?.stop();
    this.server = null;
  }

  get address(): string {
    return `http://${this.config.host}:${this.config.port}`;
  }

  private async handleRequest(req: Request): Promise<Response> {
    const url = new URL(req.url);

    if (req.method === 'GET' && url.pathname === '/health') {
      return Response.json({ status: 'ok' });
    }

    if (req.method === 'POST' && url.pathname === '/v1/traces') {
      return this.handleTraces(req);
    }

    return new Response('Not Found', { status: 404 });
  }

  private async handleTraces(req: Request): Promise<Response> {
    try {
      const contentType = req.headers.get('content-type') ?? '';

      if (!contentType.includes('application/json')) {
        return new Response('Unsupported content type. Use application/json', { status: 415 });
      }

      const body = (await req.json()) as OtlpExportRequest;
      const spans = parseOtlpRequest(body);
      this.store.addSpans(spans);

      return Response.json({});
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return new Response(`Failed to parse OTLP request: ${message}`, { status: 400 });
    }
  }
}
