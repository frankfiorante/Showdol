/**
 * Prints a compact log of one heuristic-AI vs heuristic-AI battle on a day's
 * matchup: moves, switches, faints, Tera and status. Handy for spotting bad
 * AI habits (e.g. switching back and forth).
 *
 *   pnpm ai:watch 2026-11-26 [seedLabel]
 */
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {heuristicOpponent} from '@/ai/heuristic';
import {runBattle} from '@/engine/run-battle';

const [date, label = 'watch'] = process.argv.slice(2);
if (!date) {
  console.error('usage: pnpm ai:watch YYYY-MM-DD [seedLabel]');
  process.exit(1);
}
const pz = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'public', 'puzzles', `${date}.json`), 'utf8'));
const seed = (s: string) => `sodium,${createHash('sha256').update(s).digest('hex').slice(0, 32)}`;
const ai = heuristicOpponent();
const r = runBattle({
  p1Team: pz.player, p2Team: pz.ai, p1: ai, p2: ai,
  battleSeed: seed(`${label}:battle`), botSeed: seed(`${label}:bots`),
});
const keep = /^\|(move|switch|drag|faint|turn|-terastallize|win|-status|cant)\|/;
let secret = false;
for (const line of r.log) {
  if (line.startsWith('|split|')) { secret = true; continue; }
  if (secret) { secret = false; continue; } // skip the exact-HP copy, keep the public one
  if (keep.test(line)) console.log(line.replace(/\|\[from\].*$/, ''));
}
