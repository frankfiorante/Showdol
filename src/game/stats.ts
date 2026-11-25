/**
 * Stats are always computed from the saved records, never stored, so they
 * can't drift from the games themselves.
 */
import {addDays} from './daily';
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
}

/** Pokémon still standing at the end, from the share squares. */
export function pokemonLeft(rec: Pick<GameRecord, 'myFainted'>): number | undefined {
  return rec.myFainted ? rec.myFainted.filter(f => !f).length : undefined;
}

export function computeStats(save: SaveData, today: string): Stats {
  const finished = Object.entries(save.games)
    .filter(([, g]) => g.status !== 'in_progress')
    .sort(([a], [b]) => a.localeCompare(b));
  const won = (date: string) => save.games[date]?.status === 'won';

  const winsByLeft = [0, 0, 0, 0, 0, 0, 0];
  let wins = 0, losses = 0, bestStreak = 0, run = 0;
  let prev: string | null = null;
  for (const [date, g] of finished) {
    if (g.status === 'won') {
      wins++;
      // A win with every Pokémon fainted (both last ones went down together) counts in the 1-left row.
      winsByLeft[Math.max(1, pokemonLeft(g) ?? 1)]++;
      run = prev !== null && addDays(prev, 1) === date && won(prev) ? run + 1 : 1;
      bestStreak = Math.max(bestStreak, run);
    } else {
      losses++;
      run = 0;
    }
    prev = date;
  }

  // Today's game doesn't break the streak until today is over.
  let currentStreak = 0;
  const todayDone = save.games[today] && save.games[today].status !== 'in_progress';
  for (let d = todayDone ? today : addDays(today, -1); won(d); d = addDays(d, -1)) currentStreak++;

  const played = finished.length;
  return {
    played,
    wins,
    winPct: played ? Math.round((100 * wins) / played) : 0,
    currentStreak,
    bestStreak,
    winsByLeft,
    losses,
  };
}
