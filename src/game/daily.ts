/**
 * Dates and puzzle numbering. Date keys are the player's *local* calendar
 * date (YYYY-MM-DD). Arithmetic on keys is done in UTC at noon, so daylight
 * saving changes can never shift a key.
 */

/** The date of puzzle #1. Open question in PLAN.md; change before launch. */
export const LAUNCH_DATE = '2026-11-24';

export function dateKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const toUtcNoon = (key: string) => Date.parse(`${key}T12:00:00Z`);

export function addDays(key: string, n: number): string {
  return new Date(toUtcNoon(key) + n * 86_400_000).toISOString().slice(0, 10);
}

/** Whole days from `a` to `b` (positive if b is later). */
export function daysBetween(a: string, b: string): number {
  return Math.round((toUtcNoon(b) - toUtcNoon(a)) / 86_400_000);
}

/** Puzzle number for a date, or null before launch. */
export function puzzleNumber(key: string, launch = LAUNCH_DATE): number | null {
  const n = daysBetween(launch, key) + 1;
  return n >= 1 ? n : null;
}

/** Milliseconds from `now` until the next local midnight. */
export function msUntilMidnight(now: Date): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return next.getTime() - now.getTime();
}

export function formatCountdown(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
}
