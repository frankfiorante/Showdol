/**
 * Generates daily puzzle files: one seeded Gen 9 Random Battle matchup per date.
 *
 *   pnpm gen:puzzle                       # today (local date)
 *   pnpm gen:puzzle --from 2026-12-01 --days 7
 *   pnpm gen:puzzle --check               # existing files still regenerate identically
 *
 * Curation: each matchup is played --battles times AI vs AI (default 100).
 * If the player's side wins outside --min..--max (default 0.2..0.8), the day
 * is rerolled with new seeds, up to --rerolls times (default 8); if none fit,
 * the most balanced attempt is kept. All seeds derive from the date, so the
 * same code and package versions reproduce the same files.
 *
 * Existing files are never changed (a published day is fixed) unless --force
 * is given. Uses all CPU cores; --jobs K to limit.
 */
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {availableParallelism} from 'node:os';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Teams, type PRNGSeed} from '@pkmn/sim';
import {TeamGenerators} from '@pkmn/randoms';
import {FORMAT, type PuzzleFile} from '@/engine/puzzle';
import {evaluateMatchup, myShard, shardMap} from './lib/matchup';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'puzzles');

const pkgVersion = (name: string) =>
  JSON.parse(readFileSync(join(root, 'node_modules', name, 'package.json'), 'utf8')).version as string;

export function seedFor(date: string, role: 'player' | 'ai', reroll: number): PRNGSeed {
  const hex = createHash('sha256').update(`showdol:v1:${date}:${role}:${reroll}`).digest('hex');
  return `sodium,${hex}`;
}

export function generatePuzzle(date: string, reroll = 0): PuzzleFile {
  const seeds = {player: seedFor(date, 'player', reroll), ai: seedFor(date, 'ai', reroll)};
  const gen = (seed: PRNGSeed) => TeamGenerators.getTeamGenerator(FORMAT, seed).getTeam();
  const player = gen(seeds.player);
  return {
    schema: 1,
    date,
    format: FORMAT,
    generator: {sim: pkgVersion('@pkmn/sim'), randoms: pkgVersion('@pkmn/randoms')},
    reroll,
    seeds,
    playerSpecies: player.map(set => set.species),
    player: Teams.pack(player),
    ai: Teams.pack(gen(seeds.ai)),
  };
}

export interface Curated {
  puzzle: PuzzleFile;
  attempts: {reroll: number; rate: number}[];
  balanced: boolean;
}

/** Generates a date's puzzle, rerolling until AI vs AI is reasonably balanced. */
export function curatePuzzle(date: string, opts: {battles: number; min: number; max: number; rerolls: number}): Curated {
  const attempts: Curated['attempts'] = [];
  let best: PuzzleFile | null = null;
  let bestDistance = Infinity;
  for (let reroll = 0; reroll <= opts.rerolls; reroll++) {
    const puzzle = generatePuzzle(date, reroll);
    const stats = evaluateMatchup(puzzle.player, puzzle.ai, opts.battles, `curate:${date}:${reroll}`);
    const rate = stats.p1Wins / stats.battles;
    attempts.push({reroll, rate});
    const curated = {...puzzle, curation: {battles: stats.battles, playerWins: stats.p1Wins}};
    if (rate >= opts.min && rate <= opts.max) return {puzzle: curated, attempts, balanced: true};
    if (Math.abs(rate - 0.5) < bestDistance) {
      best = curated;
      bestDistance = Math.abs(rate - 0.5);
    }
  }
  return {puzzle: best!, attempts, balanced: false};
}

function localDateKey(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function addDays(date: string, n: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const from = arg('from') ?? localDateKey();
const days = Number(arg('days') ?? 1);
const dates = arg('dates')?.split(',') ?? Array.from({length: days}, (_, i) => addDays(from, i));
const fileFor = (date: string) => join(outDir, `${date}.json`);
const force = process.argv.includes('--force');
const opts = {
  battles: Number(arg('battles') ?? 100),
  min: Number(arg('min') ?? 0.2),
  max: Number(arg('max') ?? 0.8),
  rerolls: Number(arg('rerolls') ?? 8),
};
const shard = myShard();
interface Row { date: string; attempts: Curated['attempts']; balanced: boolean; player: string; ai: string }

if (process.argv.includes('--check')) {
  // Existing files must still regenerate to the same teams (catches package upgrades).
  let checked = 0;
  const changed: string[] = [];
  for (const date of dates) {
    if (!existsSync(fileFor(date))) continue;
    const saved: PuzzleFile = JSON.parse(readFileSync(fileFor(date), 'utf8'));
    const again = generatePuzzle(date, saved.reroll);
    if (again.player !== saved.player || again.ai !== saved.ai) changed.push(date);
    checked++;
  }
  console.log(`${checked} files checked, ${changed.length} would change${changed.length ? `: ${changed.join(', ')}` : ''}`);
  if (changed.length) process.exit(1);
} else if (shard) {
  // Child process: curate this shard's dates and write their files.
  const todo = dates.filter((_, i) => i % shard.k === shard.i);
  for (const date of todo) {
    const {puzzle, attempts, balanced} = curatePuzzle(date, opts);
    writeFileSync(fileFor(date), JSON.stringify(puzzle, null, 2) + '\n');
    const names = (packed: string) => Teams.unpack(packed)!.map(s => s.species).join(', ');
    console.log(JSON.stringify({date, attempts, balanced, player: names(puzzle.player), ai: names(puzzle.ai)} satisfies Row));
  }
} else {
  mkdirSync(outDir, {recursive: true});
  const todo = dates.filter(d => force || !existsSync(fileFor(d)));
  const kept = dates.length - todo.length;
  if (todo.length) {
    const jobs = Math.min(todo.length, Number(arg('jobs') ?? Math.max(1, availableParallelism() - 1)));
    const t0 = performance.now();
    const args = ['--from', todo[0], '--days', '0', ...process.argv.slice(2)];
    // Children get the exact date list via --dates so gaps (kept files) are skipped.
    const rows = (await shardMap<Row>(fileURLToPath(import.meta.url), [...args, '--dates', todo.join(',')], jobs))
      .sort((a, b) => a.date.localeCompare(b.date));
    for (const r of rows) {
      const tries = r.attempts.map(a => `${Math.round(a.rate * 100)}%`).join(' → ');
      console.log(`${r.date}  player wins ${tries}${r.balanced ? '' : '  (kept most balanced)'}`);
      if (rows.length <= 7) console.log(`  player: ${r.player}\n  ai:     ${r.ai}`);
    }
    const rerolled = rows.filter(r => r.attempts.length > 1).length;
    const unbalanced = rows.filter(r => !r.balanced).length;
    console.log(`${rows.length} generated (${rerolled} rerolled, ${unbalanced} never balanced) in ${((performance.now() - t0) / 1000).toFixed(0)}s with ${jobs} jobs`);
  }
  if (kept) console.log(`${kept} existing file(s) kept (use --force to regenerate).`);
}
