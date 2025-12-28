export function formatDuration(ms: number): string {
  if (ms < 1) return '<1ms';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 10000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms / 1000)}s`;
}

export function formatTimeRange(startMs: number, endMs: number, baseMs: number): string {
  const start = Math.round(startMs - baseMs);
  const end = Math.round(endMs - baseMs);
  return `[${start}ms-${end}ms]`;
}

export function formatRelativeTime(timestampMs: number): string {
  const now = Date.now();
  const diff = now - timestampMs;

  if (diff < 60_000) return 'just now';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)} hours ago`;
  return `${Math.floor(diff / 86400_000)} days ago`;
}

export function formatMinutesRange(oldestMs: number | null, newestMs: number | null): string {
  if (!oldestMs || !newestMs) return 'no data';
  const rangeMinutes = Math.ceil((newestMs - oldestMs) / 60_000);
  if (rangeMinutes < 1) return 'less than a minute';
  if (rangeMinutes === 1) return '1 minute';
  return `${rangeMinutes} minutes`;
}
