/**
 * Everything the game remembers, under one localStorage key. Stats are always
 * computed from `games`, never stored. All storage access is wrapped so a
 * private window or blocked storage degrades to "nothing saved".
 */
import type {BattleResult} from '@/engine/view';
import {readPar, type Par} from '@/game/par';

export const STORAGE_KEY = 'showdol:v1';
/** Unreadable saves are copied here (plus a timestamp) before anything overwrites them. */
export const BACKUP_KEY_PREFIX = 'showdol:v1:backup:';
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
  /** Per aiTeam entry: seen during the battle. A loss only shows these. */
  aiSeen?: boolean[];
  forfeited?: boolean;
  /** Left unfinished past the next day's midnight; counted as a loss. */
  abandoned?: boolean;
  /** The day's par, copied from the puzzle file so stats don't need to fetch it. */
  par?: Par;
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

// The last turn is always shown above the controls, so the full log starts collapsed.
export const DEFAULT_SETTINGS: Settings = {animations: true, logExpanded: false, theme: 'system'};

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
  // Anything else reads as empty, and writeSave keeps it from being overwritten.
  if (d.schemaVersion !== SCHEMA_VERSION) return emptySave();
  const games: Record<string, GameRecord> = {};
  for (const [key, rec] of Object.entries(d.games ?? {})) {
    if (!DATE_KEY.test(key) || !isRecord(rec)) continue;
    // A malformed par is dropped rather than the whole game.
    const {par, ...rest} = rec;
    const valid = readPar(par);
    games[key] = valid ? {...rest, par: valid} : rest;
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

/**
 * What a stored save (or an export code's JSON) holds: nothing, a save this
 * code reads, a save from a newer version of Showdol, or something unreadable.
 */
export type SaveKind = 'empty' | 'current' | 'newer' | 'unreadable';

export function classifySave(raw: string | null): SaveKind {
  if (!raw) return 'empty';
  const v = schemaVersionOf(raw);
  if (v === SCHEMA_VERSION) return 'current';
  return Number.isInteger(v) && (v as number) > SCHEMA_VERSION ? 'newer' : 'unreadable';
}

function schemaVersionOf(raw: string): unknown {
  // Saves are written with schemaVersion as the first key, so most checks skip a full parse.
  const m = /^\{"schemaVersion":(\d+)[,}]/.exec(raw);
  if (m) return Number(m[1]);
  try {
    const d: unknown = JSON.parse(raw);
    return d && typeof d === 'object' && !Array.isArray(d) ? (d as {schemaVersion?: unknown}).schemaVersion : undefined;
  } catch {
    return undefined;
  }
}

/** True if a newer version of Showdol (another tab, or before a rollback) saved here. */
export function newerSaveStored(): boolean {
  try {
    return classifySave(localStorage.getItem(STORAGE_KEY)) === 'newer';
  } catch {
    return false;
  }
}

/**
 * `ok`, `blocked` (the browser refused the write) or `newer` (refused so a
 * newer version's save isn't lost).
 */
export type SaveWrite = 'ok' | 'blocked' | 'newer';

/**
 * Never destroys a save it can't read. A newer version's save is left alone
 * and the write is refused. Anything else unreadable is copied to a backup key
 * first, and if that copy fails, the write is refused too.
 */
export function writeSave(data: SaveData): SaveWrite {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const kind = classifySave(stored);
    if (kind === 'newer') return 'newer';
    if (kind === 'unreadable') localStorage.setItem(`${BACKUP_KEY_PREFIX}${new Date().toISOString()}`, stored!);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return 'ok';
  } catch {
    return 'blocked';
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
    aiSeen: result.aiSeen,
    forfeited: result.forfeited,
    finishedAt: now.toISOString(),
  };
}
