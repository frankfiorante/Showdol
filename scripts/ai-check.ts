/**
 * Offline AI harness.
 *
 *   pnpm ai:check random --n 200          # AI vs random-move bot, both sides
 *   pnpm ai:check mirror --days 30 --n 60 # AI vs AI on each day's matchup
 *   pnpm ai:check duel --weights '{"ko":80}' --n 400
 *                                          # variant weights vs default, both sides, paired seeds
 *
 * Options: --from YYYY-MM-DD (default: first puzzle), --jobs K (default: cores - 1)
 */
import {readFileSync, readdirSync} from 'node:fs';
import {availableParallelism} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {PRNG} from '@pkmn/sim';
import {DEFAULT_WEIGHTS, heuristicOpponent} from '@/ai/heuristic';
import type {Opponent} from '@/engine/opponent';
import type {PuzzleFile} from '@/engine/puzzle';
import {runBattle} from '@/engine/run-battle';
import {evaluateMatchup, myShard, shardMap, type MatchupStats} from './lib/matchup';

const script = fileURLToPath(import.meta.url);
const dir = join(import.meta.dirname, '..', 'public', 'puzzles');
const arg = (name: string, dflt: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : dflt;
};
const mode = process.argv[2];
const n = Number(arg('n', mode === 'random' ? '200' : '60'));
const days = Number(arg('days', '30'));
const jobs = Number(arg('jobs', String(Math.max(1, availableParallelism() - 1))));
const files = readdirSync(dir).sort();
const fromIdx = Math.max(0, files.indexOf(`${arg('from', files[0].slice(0, 10))}.json`));
const puzzles: PuzzleFile[] = files.slice(fromIdx, fromIdx + days).map(f => JSON.parse(readFileSync(join(dir, f), 'utf8')));
const shard = myShard();
const mine = <T>(xs: T[]) => (shard ? xs.filter((_, i) => i % shard.k === shard.i) : xs);

/** Times every decision an opponent makes. */
function timed(o: Opponent, times: number[]): Opponent {
  return {choose: (req, battle, rng) => {
    const t = performance.now();
    const c = o.choose(req, battle, rng);
    times.push(performance.now() - t);
    return c;
  }};
}

interface RandomRow { aiWins: number; battles: number; times: number[] }
interface MirrorRow { date: string; stats: MatchupStats }
interface DuelRow { variantWins: number; battles: number; ties: number }

if (mode === 'random') {
  if (shard) {
    const times: number[] = [];
    const ai = timed(heuristicOpponent(), times);
    let aiWins = 0, battles = 0;
    for (const i of mine(Array.from({length: n}, (_, i) => i))) {
      const pz = puzzles[i % puzzles.length];
      const aiIsP2 = i % 2 === 0;
      const r = runBattle({p1Team: pz.player, p2Team: pz.ai, p1: aiIsP2 ? undefined : ai, p2: aiIsP2 ? ai : undefined,
        keepLog: false, botSeed: PRNG.generateSeed()});
      if (r.winner === (aiIsP2 ? 'p2' : 'p1')) aiWins++;
      battles++;
    }
    console.log(JSON.stringify({aiWins, battles, times}));
  } else {
    const rows = await shardMap<RandomRow>(script, process.argv.slice(2), jobs);
    const wins = rows.reduce((a, r) => a + r.aiWins, 0), total = rows.reduce((a, r) => a + r.battles, 0);
    const times = rows.flatMap(r => r.times).sort((a, b) => a - b);
    const q = (p: number) => times[Math.floor(p * (times.length - 1))].toFixed(1);
    console.log(`AI vs random: AI won ${wins}/${total} (${((100 * wins) / total).toFixed(1)}%)`);
    console.log(`AI decision time (Node): median ${q(0.5)} ms, p95 ${q(0.95)} ms, max ${q(1)} ms over ${times.length} decisions`);
  }
} else if (mode === 'mirror') {
  if (shard) {
    for (const pz of mine(puzzles)) {
      console.log(JSON.stringify({date: pz.date, stats: evaluateMatchup(pz.player, pz.ai, n, `check:${pz.date}`)}));
    }
  } else {
    const t0 = performance.now();
    const rows = (await shardMap<MirrorRow>(script, process.argv.slice(2), jobs)).sort((a, b) => a.date.localeCompare(b.date));
    const pct = (r: MirrorRow) => (100 * r.stats.p1Wins) / r.stats.battles;
    const buckets = Array.from({length: 10}, () => 0);
    for (const r of rows) buckets[Math.min(9, Math.floor(pct(r) / 10))]++;
    console.log(`AI vs AI, ${n} battles per day, ${rows.length} days (${((performance.now() - t0) / 1000).toFixed(0)}s, ${jobs} jobs)`);
    console.log('player-team win %:');
    buckets.forEach((c, i) => console.log(`  ${String(i * 10).padStart(3)}-${String(i * 10 + 10).padEnd(3)} ${'█'.repeat(c)} ${c}`));
    const lop = rows.filter(r => pct(r) < 20 || pct(r) > 80);
    console.log(`outside 20-80%: ${lop.length} days${lop.length ? ` (${lop.slice(0, 8).map(r => `${r.date} ${pct(r).toFixed(0)}%`).join(', ')}${lop.length > 8 ? ', …' : ''})` : ''}`);
    const avg = (f: (r: MirrorRow) => number) => rows.reduce((a, r) => a + f(r), 0) / rows.length;
    console.log(`avg turns ${avg(r => r.stats.avgTurns).toFixed(1)}, ${avg(r => r.stats.msPerBattle).toFixed(0)} ms per battle`);
  }
} else if (mode === 'duel') {
  const variant = {...DEFAULT_WEIGHTS, ...JSON.parse(arg('weights', '{}'))};
  if (shard) {
    const base = heuristicOpponent(), alt = heuristicOpponent(variant);
    let variantWins = 0, battles = 0, ties = 0;
    for (const i of mine(Array.from({length: Math.ceil(n / 2)}, (_, i) => i))) {
      const pz = puzzles[i % puzzles.length];
      const seeds = {battleSeed: PRNG.generateSeed(), botSeed: PRNG.generateSeed()};
      // Same seeds, sides swapped, so team and luck differences cancel out.
      for (const altIsP1 of [true, false]) {
        const r = runBattle({p1Team: pz.player, p2Team: pz.ai, p1: altIsP1 ? alt : base, p2: altIsP1 ? base : alt, keepLog: false, ...seeds});
        if (r.winner === 'tie') ties++;
        else if ((r.winner === 'p1') === altIsP1) variantWins++;
        battles++;
      }
    }
    console.log(JSON.stringify({variantWins, battles, ties}));
  } else {
    const rows = await shardMap<DuelRow>(script, process.argv.slice(2), jobs);
    const w = rows.reduce((a, r) => a + r.variantWins, 0), b = rows.reduce((a, r) => a + r.battles, 0);
    const se = 100 * Math.sqrt(0.25 / b);
    console.log(`variant ${JSON.stringify(JSON.parse(arg('weights', '{}')))} won ${w}/${b} = ${((100 * w) / b).toFixed(1)}% (±${(2 * se).toFixed(1)}% at 95%)`);
  }
} else {
  console.error('usage: ai:check random|mirror|duel [--n N] [--days D] [--from DATE] [--jobs K]');
  process.exit(1);
}
