import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import type { TraceStore } from '../store/trace-store.ts';
import { VERSION } from '../version.ts';
import { getSummary } from './tools/get-summary.ts';
import { getTrace } from './tools/get-trace.ts';
import { listTraces } from './tools/list-traces.ts';
import { querySpans } from './tools/query-spans.ts';

const SERVER_DESCRIPTION = `OpenTelemetry trace collector for AI coding agents.

Use this server to inspect runtime behavior of applications:
- Find slow operations and performance bottlenecks
- Debug errors and exceptions
- Trace request flows across services
- Analyze database queries and external API calls

The server collects traces from OpenTelemetry-instrumented applications running locally.`;

export function createMcpServer(store: TraceStore): McpServer {
  const server = new McpServer({
    name: 'otel-mcp',
    version: VERSION,
    description: SERVER_DESCRIPTION,
  });

  server.registerTool(
    'list_traces',
    {
      title: 'List Traces',
      description:
        'List recent traces from the application. Use this to get an overview of recent requests, find errors, or identify slow operations. Returns a table of traces with their duration, span count, and error count.',
      inputSchema: {
        service: z.string().optional().describe('Filter by service name'),
        has_errors: z.boolean().optional().describe('Only traces with errors'),
        min_duration_ms: z.number().optional().describe('Minimum duration in milliseconds'),
        since_minutes: z
          .number()
          .optional()
          .describe('Only traces from last N minutes (default: 30)'),
        limit: z.number().optional().describe('Max results (default: 20, max: 100)'),
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      const result = listTraces(store, params);
      return { content: [{ type: 'text', text: result }] };
    },
  );

  server.registerTool(
    'get_trace',
    {
      title: 'Get Trace Details',
      description:
        'Get the detailed span tree for a specific trace. Shows the hierarchy of operations, their timing, and optionally their attributes. Use this to understand the full request flow and identify where time is spent.',
      inputSchema: {
        trace_id: z.string().describe('Full or prefix trace ID (min 6 chars)'),
        show_attributes: z
          .boolean()
          .optional()
          .describe('Include span attributes (default: false)'),
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      const result = getTrace(store, params);
      return { content: [{ type: 'text', text: result }] };
    },
  );

  server.registerTool(
    'query_spans',
    {
      title: 'Query Spans',
      description:
        'Search for specific spans across all traces. Use this to find patterns like slow database queries, failed HTTP calls, or specific operations by name. More targeted than list_traces when looking for specific operation types.',
      inputSchema: {
        name: z.string().optional().describe('Span name contains (case-insensitive)'),
        service: z.string().optional().describe('Service name'),
        min_duration_ms: z.number().optional().describe('Minimum duration in milliseconds'),
        has_error: z.boolean().optional().describe('Only error spans'),
        attribute: z
          .string()
          .optional()
          .describe('Attribute filter: "key=value" or "key" (exists)'),
        since_minutes: z.number().optional().describe('Time filter (default: 30)'),
        limit: z.number().optional().describe('Max results (default: 50, max: 200)'),
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      const result = querySpans(store, params);
      return { content: [{ type: 'text', text: result }] };
    },
  );

  server.registerTool(
    'get_summary',
    {
      title: 'Get Summary',
      description:
        'Get an overview of all collected trace data. Shows total traces and spans, list of services, and recent errors. Good starting point to understand what data is available.',
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      const result = getSummary(store);
      return { content: [{ type: 'text', text: result }] };
    },
  );

  return server;
}

export async function startMcpServer(server: McpServer): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
