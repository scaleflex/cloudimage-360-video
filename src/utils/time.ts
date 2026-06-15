/** Format seconds as `m:ss` or `h:mm:ss` when duration crosses an hour. */
export function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00';

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Parse `m:ss` or `h:mm:ss` into seconds. Returns 0 on malformed input. */
export function parseTime(time: string): number {
  const parts = time.split(':').map(Number);
  // Any non-numeric segment makes the whole timestamp malformed → 0 (the
  // documented contract), instead of propagating NaN into seek arithmetic.
  if (parts.some((n) => !Number.isFinite(n))) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
}
