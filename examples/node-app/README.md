# Example Node.js App

A simple app that generates OpenTelemetry traces for testing otel-mcp.

## Setup

```bash
cd examples/node-app
npm install
```

## Usage

1. Start otel-mcp (from the root directory):
   ```bash
   pnpm dev
   ```

2. In another terminal, start the example app:
   ```bash
   cd examples/node-app
   npm start
   ```

3. The app will generate traces every 2 seconds, including:
   - Database queries (simulated PostgreSQL)
   - External HTTP calls (with ~20% failure rate)
   - Request processing spans

4. Use the MCP tools to inspect the traces:
   - `get_summary` - See overview of collected data
   - `list_traces` - View recent traces
   - `get_trace <id>` - See span tree for a trace
   - `query_spans` - Search for specific operations

## Example Queries

Find slow database queries:
```
query_spans with name="db.query" and min_duration_ms=100
```

Find failed requests:
```
list_traces with has_errors=true
```
