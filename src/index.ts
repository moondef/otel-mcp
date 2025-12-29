import { createClientMcpServer, createPrimaryMcpServer, startMcpServer } from './mcp/server.ts';
import { OtlpReceiver } from './receiver/server.ts';
import { TraceStore } from './store/trace-store.ts';

interface Config {
  port: number;
  host: string;
  maxTraces: number;
  maxSpans: number;
}

function parseArgs(): Config {
  const config: Config = {
    port: parseInt(process.env.OTEL_MCP_PORT ?? '4318', 10),
    host: process.env.OTEL_MCP_HOST ?? 'localhost',
    maxTraces: parseInt(process.env.OTEL_MCP_MAX_TRACES ?? '1000', 10),
    maxSpans: parseInt(process.env.OTEL_MCP_MAX_SPANS ?? '10000', 10),
  };

  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    if ((arg === '--port' || arg === '-p') && next) {
      config.port = parseInt(next, 10);
      i++;
    } else if ((arg === '--host' || arg === '-h') && next) {
      config.host = next;
      i++;
    } else if (arg === '--max-traces' && next) {
      config.maxTraces = parseInt(next, 10);
      i++;
    } else if (arg === '--max-spans' && next) {
      config.maxSpans = parseInt(next, 10);
      i++;
    } else if (arg === '--help') {
      console.log(`
otel-mcp - OpenTelemetry collector for AI coding agents

Usage: otel-mcp [options]

Options:
  -p, --port <port>       OTLP receiver port (default: 4318)
  -h, --host <host>       Bind address (default: localhost)
  --max-traces <n>        Max traces to keep (default: 1000)
  --max-spans <n>         Max total spans (default: 10000)
  --help                  Show this help

Environment Variables:
  OTEL_MCP_PORT           Same as --port
  OTEL_MCP_HOST           Same as --host
  OTEL_MCP_MAX_TRACES     Same as --max-traces
  OTEL_MCP_MAX_SPANS      Same as --max-spans

Send OTLP traces to http://<host>:<port>/v1/traces
`);
      process.exit(0);
    }
  }

  return config;
}

async function checkExistingInstance(host: string, port: number): Promise<boolean> {
  try {
    const response = await fetch(`http://${host}:${port}/health`, {
      signal: AbortSignal.timeout(1000),
    });
    if (!response.ok) return false;
    const data = (await response.json()) as { service?: string };
    return data.service === 'otel-mcp';
  } catch {
    return false;
  }
}

async function runAsPrimary(config: Config): Promise<void> {
  const store = new TraceStore({
    maxTraces: config.maxTraces,
    maxSpans: config.maxSpans,
  });

  const receiver = new OtlpReceiver(store, {
    port: config.port,
    host: config.host,
  });

  await receiver.start();
  console.error(`Primary mode: OTLP receiver on ${receiver.address}/v1/traces`);

  const mcpServer = createPrimaryMcpServer(store);

  let shuttingDown = false;
  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.error('\nShutting down...');
    await receiver.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  process.stdin.on('close', shutdown);
  process.stdin.on('end', shutdown);

  await startMcpServer(mcpServer);
}

async function runAsClient(config: Config): Promise<void> {
  const baseUrl = `http://${config.host}:${config.port}`;

  console.error(`Client mode: connecting to primary at ${baseUrl}`);

  const mcpServer = createClientMcpServer(baseUrl);

  let shuttingDown = false;
  const shutdown = () => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.error('\nShutting down...');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  process.stdin.on('close', shutdown);
  process.stdin.on('end', shutdown);

  await startMcpServer(mcpServer);
}

async function main(): Promise<void> {
  const config = parseArgs();

  const existingInstance = await checkExistingInstance(config.host, config.port);

  if (existingInstance) {
    await runAsClient(config);
  } else {
    await runAsPrimary(config);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
