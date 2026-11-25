/**
 * Writes src/data/randbats-hints.json: the public facts about each Gen 9
 * Random Battle species that the opponent tooltip shows before anything is
 * revealed (like Showdown's tooltips): the abilities its sets can have, and
 * whether its sets run full Speed, zero Speed (Trick Room / Gyro Ball), or both.
 *
 *   pnpm hints:gen
 *
 * Rerun after upgrading @pkmn/randoms.
 */
import {writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {toID} from '@pkmn/sim';
import {TeamGenerators} from '@pkmn/randoms';
import {FORMAT} from '@/engine/puzzle';

interface RandomSet { movepool: string[]; abilities: string[] }
const generator = TeamGenerators.getTeamGenerator(FORMAT) as unknown as {
  randomSets: Record<string, {level: number; sets: RandomSet[]}>;
};

/**
 * `spe`: 'normal' = 85 EVs / 31 IVs; 'slow' = 0 / 0 (the generator zeroes Speed
 * for sets that get Trick Room or Gyro Ball); 'both' = could be either.
 * A movepool is what the generator picks four moves from, so Trick Room in the
 * pool only guarantees a slow set when the pool has four moves or fewer.
 */
export type SpeedSpread = 'normal' | 'slow' | 'both';
const out: Record<string, {abilities: string[]; spe: SpeedSpread}> = {};

for (const [id, {sets}] of Object.entries(generator.randomSets).sort(([a], [b]) => a.localeCompare(b))) {
  const abilities = [...new Set(sets.flatMap(s => s.abilities))].sort();
  const hasSlowMove = (s: RandomSet) => s.movepool.some(m => ['trickroom', 'gyroball'].includes(toID(m)));
  const alwaysSlow = sets.every(s => hasSlowMove(s) && s.movepool.length <= 4);
  const maybeSlow = sets.some(hasSlowMove);
  const spe: SpeedSpread = alwaysSlow ? 'slow' : maybeSlow ? 'both' : 'normal';
  out[id] = {abilities, spe};
}

const file = join(import.meta.dirname, '..', 'src', 'data', 'randbats-hints.json');
writeFileSync(file, JSON.stringify(out) + '\n');
const counts = Object.values(out).reduce<Record<string, number>>((acc, h) => ((acc[h.spe] = (acc[h.spe] ?? 0) + 1), acc), {});
console.log(`${Object.keys(out).length} species → ${file.split('/Showdol/')[1]} (${(JSON.stringify(out).length / 1024).toFixed(0)} KB); speed: ${JSON.stringify(counts)}`);
