import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import type { TraceStore } from '../store/trace-store.ts';
import { VERSION } from '../version.ts';
import { getSummary } from './tools/get-summary.ts';
import { getTrace } from './tools/get-trace.ts';
import { listTraces } from './tools/list-traces.ts';
import { querySpans } from './tools/query-spans.ts';

export function createMcpServer(store: TraceStore): McpServer {
  const server = new McpServer(
    { name: 'otel-mcp', version: VERSION },
    { capabilities: { tools: {} } },
  );

  server.tool(
    'list_traces',
    'List recent traces with optional filters',
    {
      service: z.string().optional().describe('Filter by service name'),
      has_errors: z.boolean().optional().describe('Only traces with errors'),
      min_duration_ms: z.number().optional().describe('Minimum duration in milliseconds'),
      since_minutes: z
        .number()
        .optional()
        .describe('Only traces from last N minutes (default: 30)'),
      limit: z.number().optional().describe('Max results (default: 20, max: 100)'),
    },
    async (params) => {
      const result = listTraces(store, params);
      return { content: [{ type: 'text', text: result }] };
    },
  );

  server.tool(
    'get_trace',
    'Get detailed span tree for a single trace',
    {
      trace_id: z.string().describe('Full or prefix trace ID (min 6 chars)'),
      show_attributes: z.boolean().optional().describe('Include span attributes (default: false)'),
    },
    async (params) => {
      const result = getTrace(store, params);
      return { content: [{ type: 'text', text: result }] };
    },
  );

  server.tool(
    'query_spans',
    'Query spans across all traces',
    {
      name: z.string().optional().describe('Span name contains (case-insensitive)'),
      service: z.string().optional().describe('Service name'),
      min_duration_ms: z.number().optional().describe('Minimum duration in milliseconds'),
      has_error: z.boolean().optional().describe('Only error spans'),
      attribute: z.string().optional().describe('Attribute filter: "key=value" or "key" (exists)'),
      since_minutes: z.number().optional().describe('Time filter (default: 30)'),
      limit: z.number().optional().describe('Max results (default: 50, max: 200)'),
    },
    async (params) => {
      const result = querySpans(store, params);
      return { content: [{ type: 'text', text: result }] };
    },
  );

  server.tool('get_summary', 'Get a summary of stored traces and services', {}, async () => {
    const result = getSummary(store);
    return { content: [{ type: 'text', text: result }] };
  });

  return server;
}

export async function startMcpServer(server: McpServer): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
