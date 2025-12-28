export interface Column {
  header: string;
  width: number;
  align?: 'left' | 'right';
}

export function formatTable(columns: Column[], rows: string[][]): string {
  const separator = columns.map(c => '-'.repeat(c.width)).join('  ');
  const header = columns.map(c => padColumn(c.header, c.width, c.align)).join('  ');

  const formattedRows = rows.map(row =>
    columns.map((col, i) => padColumn(row[i] ?? '', col.width, col.align)).join('  ')
  );

  return [header, separator, ...formattedRows].join('\n');
}

function padColumn(value: string, width: number, align: 'left' | 'right' = 'left'): string {
  const truncated = value.length > width ? value.slice(0, width - 3) + '...' : value;
  return align === 'right' ? truncated.padStart(width) : truncated.padEnd(width);
}

export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + '...';
}
