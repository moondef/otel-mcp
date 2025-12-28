import type { Span } from '../store/types.ts';
import { formatTimeRange } from './duration.ts';

interface SpanNode {
  span: Span;
  children: SpanNode[];
}

const PRIORITY_ATTRIBUTES = [
  'http.method',
  'http.url',
  'http.status_code',
  'http.route',
  'db.system',
  'db.statement',
  'db.operation',
  'exception.type',
  'exception.message',
  'rpc.method',
  'rpc.service',
];

const SKIP_PREFIXES = ['telemetry.', 'process.', 'host.', 'os.'];

export function formatSpanTree(spans: Span[], showAttributes: boolean): string {
  if (spans.length === 0) return 'No spans';

  const baseTime = Math.min(...spans.map((s) => s.startTime));
  const tree = buildTree(spans);
  const lines: string[] = [];

  for (const node of tree) {
    formatNode(node, '', true, baseTime, showAttributes, lines);
  }

  return lines.join('\n');
}

function buildTree(spans: Span[]): SpanNode[] {
  const spanMap = new Map<string, SpanNode>();
  const roots: SpanNode[] = [];

  for (const span of spans) {
    spanMap.set(span.spanId, { span, children: [] });
  }

  for (const span of spans) {
    const node = spanMap.get(span.spanId)!;
    if (span.parentSpanId && spanMap.has(span.parentSpanId)) {
      spanMap.get(span.parentSpanId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortChildren = (nodes: SpanNode[]) => {
    nodes.sort((a, b) => a.span.startTime - b.span.startTime);
    for (const node of nodes) {
      sortChildren(node.children);
    }
  };
  sortChildren(roots);

  return roots;
}

function formatNode(
  node: SpanNode,
  prefix: string,
  isLast: boolean,
  baseTime: number,
  showAttributes: boolean,
  lines: string[],
): void {
  const { span } = node;
  const timeRange = formatTimeRange(span.startTime, span.endTime, baseTime);
  const connector = prefix === '' ? '' : isLast ? '└── ' : '├── ';
  const statusIndicator = span.status === 'error' ? ' [ERROR]' : '';

  lines.push(`${prefix}${connector}${timeRange} ${span.name} (${span.kind})${statusIndicator}`);

  if (showAttributes) {
    const attrs = getDisplayAttributes(span);
    const attrPrefix = prefix + (prefix === '' ? '' : isLast ? '    ' : '│   ');
    for (const [key, value] of attrs) {
      const displayValue =
        typeof value === 'string' && value.length > 100 ? `${value.slice(0, 97)}...` : value;
      lines.push(`${attrPrefix}    ${key}: ${displayValue}`);
    }
  }

  const childPrefix = prefix + (prefix === '' ? '' : isLast ? '    ' : '│   ');
  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i]!;
    const childIsLast = i === node.children.length - 1;
    formatNode(child, childPrefix, childIsLast, baseTime, showAttributes, lines);
  }
}

function getDisplayAttributes(span: Span): Array<[string, string | number | boolean]> {
  const result: Array<[string, string | number | boolean]> = [];
  const seen = new Set<string>();

  for (const key of PRIORITY_ATTRIBUTES) {
    if (key in span.attributes) {
      result.push([key, span.attributes[key]!]);
      seen.add(key);
    }
  }

  let otherCount = 0;
  for (const [key, value] of Object.entries(span.attributes)) {
    if (seen.has(key)) continue;
    if (SKIP_PREFIXES.some((p) => key.startsWith(p))) continue;
    if (otherCount >= 5) break;
    result.push([key, value]);
    otherCount++;
  }

  return result;
}
