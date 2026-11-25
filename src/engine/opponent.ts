import type {Battle, PRNG, PRNGSeed} from '@pkmn/sim';
import {chooseRandom, type BotRequest} from './random-bot';

/**
 * Picks a side's choice for a request. `rng` is seeded per decision (see
 * `decisionSeed`), so the same decision gets the same randomness whether or
 * not the page was reloaded in between.
 */
export interface Opponent {
  choose(request: BotRequest, battle: Battle, rng: PRNG): string;
}

export const randomOpponent: Opponent = {
  choose: (req, _battle, rng) => chooseRandom(req, n => rng.random(n)),
};

/**
 * Seed for the n-th decision. A sodium seed has 32 bytes of key and our seeds
 * only use the first 16, so the decision number goes in the other 16.
 */
export function decisionSeed(seed: string, n: number): PRNGSeed {
  const hex = seed.split(',')[1].slice(0, 32).padEnd(32, '0');
  return `sodium,${hex}${n.toString(16).padStart(32, '0')}`;
}
