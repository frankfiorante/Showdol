/**
 * Runs random-move bot vs random-move bot battles on a puzzle in Node.
 *
 *   pnpm spike:bots                     # today's puzzle, 1 battle, prints the log
 *   pnpm spike:bots --date 2026-12-01 --n 200
 *   pnpm spike:bots --replay            # also checks seed + input log replays identically
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Battle, type PRNGSeed } from '@pkmn/sim';
import { runBotBattle } from '@/engine/run-battle';
import { FORMAT, type PuzzleFile } from '@/engine/puzzle';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const p = (n: number) => String(n).padStart(2, '0');
const now = new Date();
const date = arg('date') ?? `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
const n = Number(arg('n') ?? 1);

const puzzle: PuzzleFile = JSON.parse(
  readFileSync(join(root, 'public', 'puzzles', `${date}.json`), 'utf8'),
);

const results = Array.from({ length: n }, () => runBotBattle({ p1Team: puzzle.player, p2Team: puzzle.ai }));

if (n === 1) {
  const r = results[0];
  // Print the public log, skipping the |split| secret lines and noise.
  const lines = r.log.filter((l, i, all) => !l.startsWith('|split|') && !all[i - 1]?.startsWith('|split|'));
  console.log(lines.filter(l => l && !l.startsWith('|t:|')).join('\n'));
  console.log();
}

const wins = results.filter(r => r.winner === 'p1').length;
const ties = results.filter(r => r.winner === 'tie').length;
const turns = results.map(r => r.turns);
const ms = results.map(r => r.ms);
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
console.log(`puzzle ${date}: ${puzzle.player.split(']').length} vs ${puzzle.ai.split(']').length}`);
console.log(`${n} battle(s): p1 ${wins}, p2 ${n - wins - ties}, ties ${ties}`);
console.log(`turns avg ${avg(turns).toFixed(1)} (min ${Math.min(...turns)}, max ${Math.max(...turns)})`);
console.log(`ms first ${ms[0].toFixed(0)}, avg rest ${n > 1 ? avg(ms.slice(1)).toFixed(1) : '-'}`);

if (process.argv.includes('--replay')) {
  // Resume spike: rebuild the battle from seed + input log and compare logs.
  let ok = 0;
  for (const r of results) {
    const b = new Battle({ formatid: FORMAT as never, seed: r.battleSeed as PRNGSeed });
    b.setPlayer('p1', { name: 'Player', team: puzzle.player });
    b.setPlayer('p2', { name: 'AI', team: puzzle.ai });
    for (const line of r.inputLog) {
      const [, side, ...rest] = line.match(/^>(p[12]) (.*)$/)!;
      b.choose(side as 'p1' | 'p2', rest.join(' '));
    }
    if (b.turn > 500 && !b.ended) b.tie();
    // |t:| lines are wall-clock timestamps, the only legitimate difference.
    const strip = (log: string[]) => log.filter(l => !l.startsWith('|t:|')).join('\n');
    if (strip(b.log) === strip(r.log)) ok++;
  }
  console.log(`replay: ${ok}/${n} identical`);
  if (ok !== n) process.exit(1);
}
