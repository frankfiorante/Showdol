/**
 * Plays full battles through BattleSession the way the UI does: a random
 * "player" picks only from the options in the view's prompt. Checks that
 * every battle ends, the view never shows unrevealed foe info, and resuming
 * from any saved point (seeds + input log, as after a reload) and replaying the
 * player's remaining choices reproduces the battle exactly, AI choices included.
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

let wins = 0, forfeits = 0, rejected = 0, turns = 0, hintChecks = 0;
const t0 = performance.now();
for (let i = 0; i < n; i++) {
  const pz = puzzles[i % puzzles.length];
  const init = {playerTeam: pz.player, aiTeam: pz.ai, battleSeed: PRNG.generateSeed(), aiSeed: PRNG.generateSeed()};
  const s = new BattleSession(init);
  const rng = new PRNG(PRNG.generateSeed());
  let step = s.start();
  // Input log length at each point the UI would have saved it.
  const savePoints = [s.inputLog.length];
  const foeNames = new Set(s.sim.sides[1].pokemon.map(p => p.name));
  const forfeitAt = i % 10 === 9 ? 5 : Infinity;
  while (!step.view.result) {
    const v = step.view;
    if (!v.prompt) fail(`no prompt and no result on turn ${v.turn}`);
    if (v.me.team.length !== 6) fail('player team not 6');
    if (v.foe.team.length > 6) fail(`foe team > 6 on ${pz.date}: ${v.foe.team.map(f => f.name + '/' + f.species).join(', ')}`);
    for (const f of v.foe.team) if (!foeNames.has(f.name)) fail(`foe ${f.name} not on AI team`);
    if (v.foe.active && v.foe.active.maxhp !== 100) fail('foe HP should be a percentage');
    // The tooltip's public estimates must contain the real hidden values.
    const shown = v.foe.active, real = s.sim.sides[1].active[0];
    // Illusion disguises the Pokémon on purpose; Transform is checked (its Speed is exact).
    if (shown && real && !real.fainted && real.species.name === shown.species && !real.illusion) {
      hintChecks++;
      const spe = real.storedStats.spe;
      if (!shown.speed || spe < shown.speed.min || spe > shown.speed.max) {
        fail(`${shown.species} speed ${spe} outside ${shown.speed?.min}-${shown.speed?.max} on ${pz.date}`);
      }
      if (real.transformed && shown.speed?.min !== spe) fail(`transformed ${real.name}: speed ${spe} vs exact ${shown.speed?.min}`);
      // Transform copies the target's ability; otherwise compare the set's own ability.
      const realAbility = s.sim.dex.abilities.get(real.transformed ? real.ability : real.baseAbility).name;
      if (shown.possibleAbilities && !shown.possibleAbilities.includes(realAbility)) {
        fail(`${shown.species} ability ${realAbility} not in ${shown.possibleAbilities.join('/')} on ${pz.date}`);
      }
    }
    if (v.turn >= forfeitAt) { step = s.forfeit(); break; }
    try {
      step = s.choose(pickChoice(v, rng));
    } catch (e) {
      if (!(e instanceof ChoiceError)) throw e;
      rejected++; // e.g. a switch into a not-yet-revealed trapping ability
      const after = s.view().prompt;
      if (after?.kind === 'move' && !after.trapped && /trapped/.test((e as Error).message)) fail('trap not reflected in prompt');
      if (process.argv.includes("--why")) console.log(`rejected on ${pz.date}: ${(e as Error).message}`);
      step = s.choose('default');
    }
    savePoints.push(s.inputLog.length);
  }
  const r = step.view.result!;
  if (r.myFainted.length !== 6) fail('myFainted not 6');
  if (r.winner === 'ai' && !r.forfeited && !r.myFainted.every(Boolean)) fail('lost without all fainted');
  if (r.winner === 'player') wins++;
  if (r.forfeited) forfeits++;
  turns += r.turns;

  // Resume from a random save point, then replay only the player's later choices.
  const cut = savePoints[rng.random(savePoints.length)];
  const resumed = new BattleSession({...init, inputLog: s.inputLog.slice(0, cut)});
  let rstep = resumed.start();
  for (const line of s.inputLog.slice(cut)) {
    if (line === '>forcelose p1') rstep = resumed.forfeit();
    else if (line.startsWith('>p1 ')) rstep = resumed.choose(line.slice(4));
  }
  const strip = (log: string[]) => log.filter(l => !l.startsWith('|t:|')).join('\n');
  if (resumed.inputLog.join('\n') !== s.inputLog.join('\n')) fail(`resumed input log diverged in battle ${i} (cut ${cut})`);
  if (strip(resumed.sim.log) !== strip(s.sim.log)) fail(`resumed sim log diverged in battle ${i}`);
  if (resumed.log.join("\n") !== s.log.join("\n")) { const k = s.log.findIndex((l, j) => l !== resumed.log[j]); fail(`resumed formatted log diverged in battle ${i} at ${k}: ${JSON.stringify(s.log.slice(k - 2, k + 2))} vs ${JSON.stringify(resumed.log.slice(k - 2, k + 2))}`); }
  if (JSON.stringify(rstep.view.result) !== JSON.stringify(r)) fail(`resumed result differs in battle ${i}`);
  if (r.aiTeam.length !== 6) fail('aiTeam not revealed at end');

  if (print && i === 0) console.log(s.log.join('\n'), '\n');
}
const ms = performance.now() - t0;
console.log(`${n} battles: player won ${wins}, forfeits ${forfeits}, avg turns ${(turns / n).toFixed(1)}, rejected choices ${rejected}`);
console.log(`foe speed/ability estimates contained the real values in ${hintChecks} checks`);
console.log(`resumes identical; ${(ms / n).toFixed(1)} ms per battle incl. replay`);
