/**
 * Everything the game remembers, under one localStorage key. Stats are always
 * computed from `games`, never stored. All storage access is wrapped so a
 * private window or blocked storage degrades to "nothing saved".
 */
import type {BattleResult} from '@/engine/view';

export const STORAGE_KEY = 'showdol:v1';
export const SCHEMA_VERSION = 1;

export type GameStatus = 'in_progress' | 'won' | 'lost';

export interface GameRecord {
  puzzleNumber: number;
  status: GameStatus;
  /** Fixed at game start: damage rolls, crits, misses. */
  battleSeed: string;
  /** Base seed for the AI's per-decision randomness. */
  aiSeed: string;
  /** Every choice, both sides, as `>p1 move 1` lines. */
  inputLog: string[];
  /** Current turn while in progress; final turn count once finished. */
  turns?: number;
  /** In team order, for the share squares. */
  myFainted?: boolean[];
  /** Opposing Pokémon left at the end. */
  aiRemaining?: number;
  /** The AI's full team, saved at the end for the result screen. */
  aiTeam?: string[];
  forfeited?: boolean;
  /** Left unfinished past the next day's midnight; counted as a loss. */
  abandoned?: boolean;
  startedAt: string;
  finishedAt?: string;
}

export interface Settings {
  animations: boolean;
  logExpanded: boolean;
  theme: 'system' | 'light' | 'dark';
}

export interface SaveData {
  schemaVersion: typeof SCHEMA_VERSION;
  settings: Settings;
  games: Record<string, GameRecord>;
}

export const DEFAULT_SETTINGS: Settings = {animations: true, logExpanded: true, theme: 'system'};

export function emptySave(): SaveData {
  return {schemaVersion: SCHEMA_VERSION, settings: {...DEFAULT_SETTINGS}, games: {}};
}

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

function isRecord(r: unknown): r is GameRecord {
  if (!r || typeof r !== 'object') return false;
  const g = r as GameRecord;
  return (
    typeof g.puzzleNumber === 'number' &&
    (g.status === 'in_progress' || g.status === 'won' || g.status === 'lost') &&
    typeof g.battleSeed === 'string' &&
    typeof g.aiSeed === 'string' &&
    Array.isArray(g.inputLog) &&
    g.inputLog.every(l => typeof l === 'string') &&
    typeof g.startedAt === 'string'
  );
}

/** Parses stored JSON, dropping anything malformed rather than failing. */
export function parseSave(raw: string | null): SaveData {
  if (!raw) return emptySave();
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return emptySave();
  }
  if (!data || typeof data !== 'object') return emptySave();
  const d = data as Partial<SaveData>;
  // Future schema versions add migrations here, keyed on d.schemaVersion.
  if (d.schemaVersion !== SCHEMA_VERSION) return emptySave();
  const games: Record<string, GameRecord> = {};
  for (const [key, rec] of Object.entries(d.games ?? {})) {
    if (DATE_KEY.test(key) && isRecord(rec)) games[key] = rec;
  }
  return {
    schemaVersion: SCHEMA_VERSION,
    settings: {...DEFAULT_SETTINGS, ...(typeof d.settings === 'object' ? d.settings : {})},
    games,
  };
}

export function loadSave(): SaveData {
  try {
    return parseSave(localStorage.getItem(STORAGE_KEY));
  } catch {
    return emptySave();
  }
}

/** Returns false if the browser refused the write. */
export function writeSave(data: SaveData): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function finishRecord(rec: GameRecord, result: BattleResult, inputLog: string[], now: Date): GameRecord {
  return {
    ...rec,
    inputLog,
    // A tie (only possible at the turn-1000 limit) counts as a loss.
    status: result.winner === 'player' ? 'won' : 'lost',
    turns: result.turns,
    myFainted: result.myFainted,
    aiRemaining: result.aiRemaining,
    aiTeam: result.aiTeam,
    forfeited: result.forfeited,
    finishedAt: now.toISOString(),
  };
}
