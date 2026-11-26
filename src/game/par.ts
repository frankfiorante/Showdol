/**
 * Par: a typical win for the day's team. At build time the heuristic AI pilots
 * the player's team against the AI team (the curation battles); par is the
 * median of those wins.
 *
 * Results rank by Pokémon left first (more is better), then turns (fewer is
 * better). Par uses the same order: it's the middle win when the AI's wins
 * are sorted best to worst, so it's always a result that actually happened.
 */

export interface Par {
  /** Pokémon still standing at the end. */
  left: number;
  turns: number;
}

export type ParVerdict = 'beat' | 'matched' | 'missed';

/** Negative if `a` is the better result, positive if `b` is, 0 if equal. */
export function compareResults(a: Par, b: Par): number {
  return b.left - a.left || a.turns - b.turns;
}

/** The median of a set of wins under the ranking order; null if there are none. */
export function parFromWins(wins: Par[]): Par | null {
  if (!wins.length) return null;
  const sorted = [...wins].sort(compareResults);
  // With an even count, take the better of the two middle wins.
  const {left, turns} = sorted[Math.floor((sorted.length - 1) / 2)];
  return {left, turns};
}

/** How a win compares with par. Losses never beat par. */
export function parVerdict(result: Par, par: Par): ParVerdict {
  const c = compareResults(result, par);
  return c < 0 ? 'beat' : c === 0 ? 'matched' : 'missed';
}

export const VERDICT_LABEL: Record<ParVerdict, string> = {
  beat: 'Beat par ⭐',
  matched: 'Matched par',
  missed: 'Missed par',
};

export const formatPar = (p: Par) => `${p.left} Pokémon remaining, ${p.turns} ${p.turns === 1 ? 'turn' : 'turns'}`;

/** A stored par, or undefined if it's missing or malformed. */
export function readPar(v: unknown): Par | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const {left, turns} = v as Par;
  return Number.isInteger(left) && left >= 0 && left <= 6 && Number.isInteger(turns) && turns >= 0 ? {left, turns} : undefined;
}
