# otel-mcp

Give AI coding agents visibility into your application's runtime behavior.

## Why

When debugging with AI agents like Claude or Cursor, you end up copy-pasting logs, errors, and stack traces into chat. The agent can't see what your app is actually doing at runtime.

**otel-mcp** fixes this. It collects traces from your running application and lets AI agents query them directly:

- *"Why is the checkout endpoint slow?"*
- *"Show me all database queries over 100ms"*
- *"What errors happened in the last 5 minutes?"*
- *"Trace the request that failed"*

## Setup

### 1. Add to your MCP client

**Claude Code:**
```json
{
  "mcpServers": {
    "otel": {
      "command": "npx",
      "args": ["otel-mcp"]
    }
  }
}
```

### 2. Instrument your app

Add [OpenTelemetry](https://opentelemetry.io/) to your application and point it at `http://localhost:4318/v1/traces`.

> **New to OpenTelemetry?** It's the industry standard for collecting traces, metrics, and logs from applications. A "trace" shows the journey of a request through your system - which functions ran, how long they took, and what failed. Most languages have simple setup guides:
> [Node.js](https://opentelemetry.io/docs/languages/js/getting-started/nodejs/) ·
> [Python](https://opentelemetry.io/docs/languages/python/getting-started/) ·
> [Go](https://opentelemetry.io/docs/languages/go/getting-started/) ·
> [Java](https://opentelemetry.io/docs/languages/java/getting-started/)

**Node.js:**
```javascript
const { NodeSDK } = require('@opentelemetry/sdk-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter({
    url: 'http://localhost:4318/v1/traces'
  })
});
sdk.start();
```

**Python:**
```python
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
exporter = OTLPSpanExporter(endpoint="http://localhost:4318/v1/traces")
```

Many frameworks have automatic instrumentation - see the [OpenTelemetry Registry](https://opentelemetry.io/ecosystem/registry/).

### 3. Ask your AI agent

Once traces are flowing, just ask naturally:

- "Show me recent traces"
- "What's causing the slowdown?"
- "Find all failed requests"
- "Show me the trace for that error"

## Configuration

```bash
OTEL_MCP_PORT=4318           # Receiver port (default: 4318)
OTEL_MCP_MAX_TRACES=1000     # Max traces to keep (default: 1000)
OTEL_MCP_MAX_SPANS=10000     # Max spans to keep (default: 10000)
```

## License

MIT
