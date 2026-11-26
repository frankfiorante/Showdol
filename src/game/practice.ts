/**
 * The one saved practice game, under its own localStorage key so it can never
 * touch the daily games, stats, streaks or export codes. Each write stores
 * the whole record (teams, seeds and input log together), so two tabs can
 * only ever overwrite each other with a complete, resumable game.
 */
import type {TeamSeeds} from '@/engine/practice-teams';
import type {BattleResult} from '@/engine/view';

export const PRACTICE_KEY = 'showdol:practice:v1';

export interface PracticeRecord {
  status: 'in_progress' | 'finished';
  /** What made the teams. Kept for debugging; resume uses the packed teams. */
  teamSeeds: TeamSeeds;
  /** Packed teams, saved so resuming doesn't depend on the generator staying the same. */
  playerTeam: string;
  aiTeam: string;
  battleSeed: string;
  aiSeed: string;
  inputLog: string[];
  /** Current turn while in progress. */
  turns?: number;
  result?: BattleResult;
  startedAt: string;
  finishedAt?: string;
}

const isString = (x: unknown): x is string => typeof x === 'string';

/** Parses stored JSON. Anything malformed reads as no practice game. */
export function parsePractice(raw: string | null): PracticeRecord | null {
  if (!raw) return null;
  let r: Partial<PracticeRecord>;
  try {
    r = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!r || typeof r !== 'object') return null;
  const ok =
    (r.status === 'in_progress' || (r.status === 'finished' && !!r.result && typeof r.result === 'object')) &&
    !!r.teamSeeds && isString(r.teamSeeds.player) && isString(r.teamSeeds.ai) &&
    isString(r.playerTeam) && isString(r.aiTeam) && isString(r.battleSeed) && isString(r.aiSeed) &&
    Array.isArray(r.inputLog) && r.inputLog.every(isString) && isString(r.startedAt);
  return ok ? (r as PracticeRecord) : null;
}

export function loadPractice(): PracticeRecord | null {
  try {
    return parsePractice(localStorage.getItem(PRACTICE_KEY));
  } catch {
    return null;
  }
}

/** Returns false if the browser refused the write. */
export function writePractice(rec: PracticeRecord): boolean {
  try {
    localStorage.setItem(PRACTICE_KEY, JSON.stringify(rec));
    return true;
  } catch {
    return false;
  }
}

/** The record after a step: progress while in progress, the result once finished. */
export function stepPractice(rec: PracticeRecord, result: BattleResult | null, turn: number, inputLog: string[], now: Date): PracticeRecord {
  if (!result) return {...rec, inputLog, turns: turn};
  return {...rec, inputLog, turns: result.turns, status: 'finished', result, finishedAt: now.toISOString()};
}
