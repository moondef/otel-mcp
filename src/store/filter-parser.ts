import type { Span } from './types.ts';

type Operator = '=' | '!=' | '>' | '<' | '>=' | '<=';

interface Condition {
  field: string;
  operator: Operator;
  value: string | number;
}

export interface ParsedFilter {
  conditions: Condition[];
}

const OPERATORS: Operator[] = ['>=', '<=', '!=', '=', '>', '<'];

function parseCondition(expr: string): Condition | null {
  const trimmed = expr.trim();
  if (!trimmed) return null;

  for (const op of OPERATORS) {
    const idx = trimmed.indexOf(op);
    if (idx === -1) continue;

    const field = trimmed.slice(0, idx).trim();
    const rawValue = trimmed.slice(idx + op.length).trim();

    if (!field || !rawValue) continue;

    const numValue = Number(rawValue);
    const value = Number.isNaN(numValue) ? rawValue : numValue;

    return { field, operator: op, value };
  }

  return null;
}

export function parseFilter(expression: string): ParsedFilter | { error: string } {
  const parts = expression.split(/\s+AND\s*/i).filter((p) => p.trim());
  const conditions: Condition[] = [];

  for (const part of parts) {
    const condition = parseCondition(part);
    if (!condition) {
      return { error: `Invalid condition: "${part}"` };
    }
    conditions.push(condition);
  }

  if (conditions.length === 0) {
    return { error: 'No valid conditions found' };
  }

  return { conditions };
}

function getFieldValue(span: Span, field: string): string | number | boolean | undefined {
  switch (field) {
    case 'duration':
      return span.duration;
    case 'status':
      return span.status;
    case 'name':
      return span.name;
    case 'service':
      return span.serviceName;
    case 'kind':
      return span.kind;
  }

  if (field in span.attributes) {
    return span.attributes[field];
  }

  if (field in span.resourceAttributes) {
    return span.resourceAttributes[field];
  }

  return undefined;
}

function compareValues(
  actual: string | number | boolean | undefined,
  operator: Operator,
  expected: string | number,
): boolean {
  if (actual === undefined) return false;

  const actualNum = typeof actual === 'number' ? actual : Number(actual);
  const expectedNum = typeof expected === 'number' ? expected : Number(expected);

  if (!Number.isNaN(actualNum) && !Number.isNaN(expectedNum)) {
    switch (operator) {
      case '=':
        return actualNum === expectedNum;
      case '!=':
        return actualNum !== expectedNum;
      case '>':
        return actualNum > expectedNum;
      case '<':
        return actualNum < expectedNum;
      case '>=':
        return actualNum >= expectedNum;
      case '<=':
        return actualNum <= expectedNum;
    }
  }

  const actualStr = String(actual);
  const expectedStr = String(expected);

  switch (operator) {
    case '=':
      return actualStr === expectedStr;
    case '!=':
      return actualStr !== expectedStr;
    case '>':
      return actualStr > expectedStr;
    case '<':
      return actualStr < expectedStr;
    case '>=':
      return actualStr >= expectedStr;
    case '<=':
      return actualStr <= expectedStr;
  }
}

export function matchesFilter(span: Span, filter: ParsedFilter): boolean {
  for (const condition of filter.conditions) {
    const actual = getFieldValue(span, condition.field);
    if (!compareValues(actual, condition.operator, condition.value)) {
      return false;
    }
  }
  return true;
}
