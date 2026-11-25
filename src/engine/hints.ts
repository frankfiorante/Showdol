/**
 * Public, pre-reveal facts about a Random Battle species (possible abilities,
 * Speed spread), used for the opponent's tooltip. Nothing here comes from the
 * actual hidden set.
 */
import {Dex, toID} from '@pkmn/sim';
import hints from '@/data/randbats-hints.json';

type SpeedSpread = 'normal' | 'slow' | 'both';
interface Hint { abilities: string[]; spe: SpeedSpread }
const table = hints as Record<string, Hint>;

/** Looks up a species, falling back from battle-only and cosmetic formes to the set's species. */
export function hintFor(speciesName: string): Hint | undefined {
  const species = Dex.species.get(speciesName);
  const battleOnly = Array.isArray(species.battleOnly) ? species.battleOnly[0] : species.battleOnly;
  for (const name of [species.name, battleOnly, species.baseSpecies]) {
    if (name && table[toID(name)]) return table[toID(name)];
  }
  return undefined;
}

/** Gen 9 stat formula with no nature (Random Battle sets have none). */
function stat(base: number, level: number, iv: number, ev: number) {
  return Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100) + 5;
}

/**
 * Speed range before items, abilities and other modifiers: Random Battle
 * sets use 85 EVs / 31 IVs, or 0 / 0 on Trick Room and Gyro Ball sets.
 */
export function speedRange(speciesName: string, level: number): [number, number] {
  const base = Dex.species.get(speciesName).baseStats.spe;
  const fast = stat(base, level, 31, 85);
  const slow = stat(base, level, 0, 0);
  const spread = hintFor(speciesName)?.spe ?? 'normal';
  return spread === 'normal' ? [fast, fast] : spread === 'slow' ? [slow, slow] : [slow, fast];
}

export {boostMultiplier} from './boosts';
