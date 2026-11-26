/**
 * Stats are always computed from the saved records, never stored, so they
 * can't drift from the games themselves.
 */
import {addDays} from './daily';
import {parVerdict} from './par';
import type {GameRecord, SaveData} from './storage';

export interface Stats {
  played: number;
  wins: number;
  /** 0-100, rounded. */
  winPct: number;
  /** Consecutive days won, ending today (or yesterday if today isn't finished). */
  currentStreak: number;
  bestStreak: number;
  /** Wins by Pokémon left: index 1-6 (index 0 unused). */
  winsByLeft: number[];
  losses: number;
  /** Wins that matched or beat the day's par. */
  madePar: number;
  /** 0-100, rounded, out of games played. */
  parPct: number;
  /** Consecutive days at par or better, by the same rules as the win streak. */
  currentParStreak: number;
  bestParStreak: number;
}

/** Pokémon still standing at the end, from the share squares. */
export function pokemonLeft(rec: Pick<GameRecord, 'myFainted'>): number | undefined {
  return rec.myFainted ? rec.myFainted.filter(f => !f).length : undefined;
}

/** A win that matched or beat par. False when the day's par isn't known. */
export function madePar(rec: GameRecord): boolean {
  const left = pokemonLeft(rec);
  if (rec.status !== 'won' || !rec.par || left === undefined || rec.turns === undefined) return false;
  return parVerdict({left, turns: rec.turns}, rec.par) !== 'missed';
}

/** Best run of consecutive days where `ok` holds, and the run ending today (or yesterday). */
function streaks(save: SaveData, today: string, ok: (g: GameRecord) => boolean) {
  const hit = (date: string) => {
    const g = save.games[date];
    return !!g && g.status !== 'in_progress' && ok(g);
  };
  const dates = Object.keys(save.games).filter(d => save.games[d].status !== 'in_progress').sort();
  let best = 0, run = 0;
  let prev: string | null = null;
  for (const date of dates) {
    run = hit(date) ? (prev !== null && addDays(prev, 1) === date && hit(prev) ? run + 1 : 1) : 0;
    best = Math.max(best, run);
    prev = date;
  }
  // Today's game doesn't break the streak until today is over.
  let current = 0;
  const todayDone = save.games[today] && save.games[today].status !== 'in_progress';
  for (let d = todayDone ? today : addDays(today, -1); hit(d); d = addDays(d, -1)) current++;
  return {current, best};
}

export function computeStats(save: SaveData, today: string): Stats {
  const finished = Object.entries(save.games).filter(([, g]) => g.status !== 'in_progress');

  const winsByLeft = [0, 0, 0, 0, 0, 0, 0];
  let wins = 0, losses = 0, pars = 0;
  for (const [, g] of finished) {
    if (g.status === 'won') {
      wins++;
      // A win with every Pokémon fainted (both last ones went down together) counts in the 1-left row.
      winsByLeft[Math.max(1, pokemonLeft(g) ?? 1)]++;
      if (madePar(g)) pars++;
    } else {
      losses++;
    }
  }
  const winStreak = streaks(save, today, g => g.status === 'won');
  const parStreak = streaks(save, today, madePar);

  const played = finished.length;
  return {
    played,
    wins,
    winPct: played ? Math.round((100 * wins) / played) : 0,
    currentStreak: winStreak.current,
    bestStreak: winStreak.best,
    winsByLeft,
    losses,
    madePar: pars,
    parPct: played ? Math.round((100 * pars) / played) : 0,
    currentParStreak: parStreak.current,
    bestParStreak: parStreak.best,
  };
}
