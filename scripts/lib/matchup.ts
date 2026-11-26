/**
 * AI-vs-AI matchup evaluation, shared by the AI harness and the puzzle
 * curation filter. Seeds derive from a label, so results are reproducible.
 */
import {createHash} from 'node:crypto';
import {heuristicOpponent} from '@/ai/heuristic';
import {parFromWins, type Par} from '@/game/par';
import {runBattle} from '@/engine/run-battle';

const seed = (label: string) => `sodium,${createHash('sha256').update(label).digest('hex').slice(0, 32)}`;

export interface MatchupStats {
  battles: number;
  p1Wins: number;
  ties: number;
  avgTurns: number;
  /** Median p1 win (Pokémon left, then turns); null if p1 never won. */
  par: Par | null;
  msPerBattle: number;
}

/** Plays `n` heuristic-vs-heuristic battles of p1Team vs p2Team. */
export function evaluateMatchup(p1Team: string, p2Team: string, n: number, label: string): MatchupStats {
  const ai = heuristicOpponent();
  let p1Wins = 0, ties = 0, turns = 0;
  const wins: Par[] = [];
  const t0 = performance.now();
  for (let i = 0; i < n; i++) {
    const r = runBattle({
      p1Team, p2Team, p1: ai, p2: ai, keepLog: false,
      battleSeed: seed(`${label}:battle:${i}`), botSeed: seed(`${label}:bots:${i}`),
    });
    if (r.winner === 'p1') {
      p1Wins++;
      wins.push({left: r.remaining.p1, turns: r.turns});
    }
    if (r.winner === 'tie') ties++;
    turns += r.turns;
  }
  return {battles: n, p1Wins, ties, avgTurns: turns / n, par: parFromWins(wins), msPerBattle: (performance.now() - t0) / n};
}

/** Runs `fn` over items in `shards` child processes of `script`, collecting JSON lines. */
export async function shardMap<T>(script: string, args: string[], shards: number): Promise<T[]> {
  const {spawn} = await import('node:child_process');
  const runs = Array.from({length: shards}, (_, i) =>
    new Promise<T[]>((resolve, reject) => {
      const child = spawn(process.execPath, ['--import', 'tsx', script, ...args, '--shard', `${i}/${shards}`], {
        stdio: ['ignore', 'pipe', 'inherit'],
      });
      let out = '';
      child.stdout.on('data', d => (out += d));
      child.on('error', reject);
      child.on('close', code =>
        code === 0
          ? resolve(out.split('\n').filter(l => l.startsWith('{')).map(l => JSON.parse(l) as T))
          : reject(new Error(`shard ${i} exited ${code}`)),
      );
    }),
  );
  return (await Promise.all(runs)).flat();
}

/** This process's shard from `--shard i/k`, or null when not a shard. */
export function myShard(): {i: number; k: number} | null {
  const idx = process.argv.indexOf('--shard');
  if (idx < 0) return null;
  const [i, k] = process.argv[idx + 1].split('/').map(Number);
  return {i, k};
}
