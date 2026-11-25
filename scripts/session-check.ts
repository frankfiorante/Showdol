/**
 * Plays full battles through BattleSession the way the UI does: a random
 * "player" picks only from the options in the view's prompt. Checks that
 * every battle ends, the view never shows unrevealed foe info, and a battle
 * rebuilt from seeds + input log ends identically.
 *
 *   pnpm session:check                 # 200 battles across this week's puzzles
 *   pnpm session:check --n 20 --print  # also prints one formatted log
 */
import {readFileSync, readdirSync} from 'node:fs';
import {join} from 'node:path';
import {PRNG} from '@pkmn/sim';
import {BattleSession, ChoiceError} from '@/engine/session';
import type {BattleView} from '@/engine/view';
import type {PuzzleFile} from '@/engine/puzzle';

const dir = join(import.meta.dirname, '..', 'public', 'puzzles');
const puzzles: PuzzleFile[] = readdirSync(dir).map(f => JSON.parse(readFileSync(join(dir, f), 'utf8')));
const argN = process.argv.indexOf('--n');
const n = argN >= 0 ? Number(process.argv[argN + 1]) : 200;
const print = process.argv.includes('--print');

function pickChoice(view: BattleView, rng: PRNG): string {
  const p = view.prompt!;
  if (p.kind === 'switch') return `switch ${p.switches[rng.random(p.switches.length)].slot}`;
  const moves = p.moves.filter(m => !m.disabled);
  if (p.switches.length && (moves.length === 0 || rng.random(5) === 0)) {
    return `switch ${p.switches[rng.random(p.switches.length)].slot}`;
  }
  if (!moves.length) return 'move 1';
  const tera = p.canTera && rng.random(8) === 0 ? ' terastallize' : '';
  return `move ${moves[rng.random(moves.length)].slot}${tera}`;
}

function fail(msg: string): never {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

let wins = 0, forfeits = 0, rejected = 0, turns = 0;
const t0 = performance.now();
for (let i = 0; i < n; i++) {
  const pz = puzzles[i % puzzles.length];
  const init = {playerTeam: pz.player, aiTeam: pz.ai, battleSeed: PRNG.generateSeed(), aiSeed: PRNG.generateSeed()};
  const s = new BattleSession(init);
  const rng = new PRNG(PRNG.generateSeed());
  let step = s.start();
  const foeNames = new Set(s.sim.sides[1].pokemon.map(p => p.name));
  const forfeitAt = i % 10 === 9 ? 5 : Infinity;
  while (!step.view.result) {
    const v = step.view;
    if (!v.prompt) fail(`no prompt and no result on turn ${v.turn}`);
    if (v.me.team.length !== 6) fail('player team not 6');
    if (v.foe.team.length > 6) fail('foe team > 6');
    for (const f of v.foe.team) if (!foeNames.has(f.name)) fail(`foe ${f.name} not on AI team`);
    if (v.foe.active && v.foe.active.maxhp !== 100) fail('foe HP should be a percentage');
    if (v.turn >= forfeitAt) { step = s.forfeit(); break; }
    try {
      step = s.choose(pickChoice(v, rng));
    } catch (e) {
      if (!(e instanceof ChoiceError)) throw e;
      rejected++; // e.g. a choice the request allows but the sim refuses (rare)
      step = s.choose('default');
    }
  }
  const r = step.view.result!;
  if (r.myFainted.length !== 6) fail('myFainted not 6');
  if (r.winner === 'player' && r.myFainted.every(Boolean)) fail('won with all fainted');
  if (r.winner === 'ai' && !r.forfeited && !r.myFainted.every(Boolean)) fail('lost without all fainted');
  if (r.winner === 'player') wins++;
  if (r.forfeited) forfeits++;
  turns += r.turns;

  // Replay from seeds + input log, feeding the AI's logged choices back.
  const replay = new BattleSession({...init, opponent: {choose: () => { throw new Error('AI asked during replay'); }}});
  for (const line of s.inputLog) {
    if (line === '>forcelose p1') replay.sim.lose('p1');
    else replay.sim.choose(line.slice(1, 3) as 'p1' | 'p2', line.slice(4));
  }
  const strip = (log: string[]) => log.filter(l => !l.startsWith('|t:|')).join('\n');
  if (strip(replay.sim.log) !== strip(s.sim.log)) fail(`replay diverged in battle ${i}`);

  if (print && i === 0) console.log(s.log.join('\n'), '\n');
}
const ms = performance.now() - t0;
console.log(`${n} battles: player won ${wins}, forfeits ${forfeits}, avg turns ${(turns / n).toFixed(1)}, rejected choices ${rejected}`);
console.log(`replays identical; ${(ms / n).toFixed(1)} ms per battle incl. replay`);
