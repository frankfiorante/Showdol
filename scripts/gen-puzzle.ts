/**
 * Generates daily puzzle files: one seeded Gen 9 Random Battle matchup per date.
 *
 *   pnpm gen:puzzle                       # today (local date)
 *   pnpm gen:puzzle --from 2026-12-01 --days 7
 *   pnpm gen:puzzle --check               # verify determinism, write nothing
 *
 * Seeds are derived from the date, so rerunning with the same pinned package
 * versions reproduces the same files byte for byte.
 */
import {createHash} from 'node:crypto';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Teams, type PRNGSeed} from '@pkmn/sim';
import {TeamGenerators} from '@pkmn/randoms';
import {FORMAT, type PuzzleFile} from '../src/engine/puzzle';

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
  const team = (seed: PRNGSeed) => Teams.pack(TeamGenerators.getTeamGenerator(FORMAT, seed).getTeam());
  return {
    schema: 1,
    date,
    format: FORMAT,
    generator: {sim: pkgVersion('@pkmn/sim'), randoms: pkgVersion('@pkmn/randoms')},
    reroll,
    seeds,
    player: team(seeds.player),
    ai: team(seeds.ai),
  };
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
const dates = Array.from({length: days}, (_, i) => addDays(from, i));

if (process.argv.includes('--check')) {
  // Same seed twice in one process must match, and must not depend on order.
  const a = dates.map(d => JSON.stringify(generatePuzzle(d)));
  const b = [...dates].reverse().map(d => JSON.stringify(generatePuzzle(d))).reverse();
  const mismatched = dates.filter((_, i) => a[i] !== b[i]);
  const digest = createHash('sha256').update(a.join('\n')).digest('hex').slice(0, 16);
  console.log(`${dates.length} dates, ${mismatched.length} mismatches, digest ${digest}`);
  if (mismatched.length) process.exit(1);
} else {
  mkdirSync(outDir, {recursive: true});
  for (const date of dates) {
    const puzzle = generatePuzzle(date);
    writeFileSync(join(outDir, `${date}.json`), JSON.stringify(puzzle, null, 2) + '\n');
    const names = (packed: string) => Teams.unpack(packed)!.map(s => s.species).join(', ');
    console.log(`${date}\n  player: ${names(puzzle.player)}\n  ai:     ${names(puzzle.ai)}`);
  }
}
