/**
 * The daily lock: which game the home screen offers right now.
 *
 * - A game belongs to the local date it started on.
 * - Yesterday's unfinished game can be finished until local midnight today,
 *   and must be finished (or forfeited) before today's puzzle unlocks.
 * - Anything unfinished from before yesterday is recorded as a loss.
 */
import {addDays, puzzleNumber} from './daily';
import type {GameRecord, SaveData} from './storage';

export type HomeState =
  | {kind: 'resume'; date: string; record: GameRecord; fromYesterday: boolean}
  | {kind: 'play'; date: string; puzzleNumber: number}
  | {kind: 'done'; date: string; record: GameRecord}
  | {kind: 'before-launch'; date: string};

/** Marks games abandoned past their grace day as losses. Returns a new save if anything changed. */
export function expireAbandoned(save: SaveData, today: string, now: Date): SaveData | null {
  const yesterday = addDays(today, -1);
  let changed = false;
  const games = {...save.games};
  for (const [date, rec] of Object.entries(games)) {
    if (rec.status === 'in_progress' && date < yesterday) {
      games[date] = {...rec, status: 'lost', abandoned: true, finishedAt: now.toISOString()};
      changed = true;
    }
  }
  return changed ? {...save, games} : null;
}

export function homeState(save: SaveData, today: string): HomeState {
  const yesterday = addDays(today, -1);
  const y = save.games[yesterday];
  if (y?.status === 'in_progress') return {kind: 'resume', date: yesterday, record: y, fromYesterday: true};
  const t = save.games[today];
  if (t?.status === 'in_progress') return {kind: 'resume', date: today, record: t, fromYesterday: false};
  if (t) return {kind: 'done', date: today, record: t};
  const n = puzzleNumber(today);
  return n === null ? {kind: 'before-launch', date: today} : {kind: 'play', date: today, puzzleNumber: n};
}
