import {Battle, PRNG, type PRNGSeed} from '@pkmn/sim';
import type {BotRequest} from './random-bot';
import {decisionSeed, randomOpponent, type Opponent} from './opponent';
import {FORMAT} from './puzzle';

export interface BattleRunOptions {
  /** Packed teams. */
  p1Team: string;
  p2Team: string;
  /** Who plays each side. Random-move bots by default. */
  p1?: Opponent;
  p2?: Opponent;
  /** Battle seed (damage rolls, crits, ...). Random if omitted. */
  battleSeed?: string;
  /** Base seed for both sides' decisions. Random if omitted. */
  botSeed?: string;
  /** Hard cap so a stalemate can't spin forever. */
  maxTurns?: number;
  /** Keep the full protocol log (off for bulk runs). */
  keepLog?: boolean;
}

export interface BattleRunResult {
  winner: 'p1' | 'p2' | 'tie';
  turns: number;
  battleSeed: string;
  botSeed: string;
  /** Every choice, in the order it was made, as BattleStream input lines. */
  inputLog: string[];
  /** Full omniscient protocol log (empty unless keepLog). */
  log: string[];
  ms: number;
  /** Pokémon left standing at the end. */
  remaining: {p1: number; p2: number};
  species: {p1: string[]; p2: string[]};
}

/**
 * Runs a full battle between two controllers synchronously by driving the
 * sim's Battle object directly. Works in Node and in a Web Worker.
 */
export function runBattle(opts: BattleRunOptions): BattleRunResult {
  const start = performance.now();
  const battleSeed = (opts.battleSeed ?? PRNG.generateSeed()) as PRNGSeed;
  const botSeed = opts.botSeed ?? PRNG.generateSeed();
  const controllers = {p1: opts.p1 ?? randomOpponent, p2: opts.p2 ?? randomOpponent};
  const maxTurns = opts.maxTurns ?? 500;

  const battle = new Battle({formatid: FORMAT as never, seed: battleSeed});
  battle.setPlayer('p1', {name: 'Player', team: opts.p1Team});
  battle.setPlayer('p2', {name: 'AI', team: opts.p2Team});

  const inputLog: string[] = [];
  let decisions = 0;
  while (!battle.ended) {
    let acted = false;
    for (const side of battle.sides) {
      const req = side.activeRequest as BotRequest | null;
      if (!req || req.wait || side.isChoiceDone()) continue;
      const rng = new PRNG(decisionSeed(botSeed, decisions++));
      let choice = controllers[side.id as 'p1' | 'p2'].choose(req, battle, rng);
      if (!battle.choose(side.id, choice)) {
        side.clearChoice();
        choice = 'default';
        battle.choose(side.id, choice);
      }
      inputLog.push(`>${side.id} ${choice}`);
      acted = true;
      if (battle.ended) break;
    }
    if (!acted && !battle.ended) throw new Error(`Battle stuck on turn ${battle.turn}`);
    if (battle.turn > maxTurns && !battle.ended) battle.tie();
  }

  const winner = battle.winner === 'Player' ? 'p1' : battle.winner === 'AI' ? 'p2' : 'tie';
  const [s1, s2] = battle.sides;
  const order = (side: typeof s1) => side.team.map(set => side.pokemon.find(p => p.set === set)!);
  return {
    winner,
    turns: battle.turn,
    battleSeed,
    botSeed,
    inputLog,
    log: opts.keepLog === false ? [] : battle.log.slice(),
    ms: performance.now() - start,
    remaining: {p1: s1.pokemon.filter(p => !p.fainted).length, p2: s2.pokemon.filter(p => !p.fainted).length},
    species: {p1: order(s1).map(p => p.species.name), p2: order(s2).map(p => p.species.name)},
  };
}

/** Random bot vs random bot (Phase 0 spike API). */
export const runBotBattle = (opts: Omit<BattleRunOptions, 'p1' | 'p2'>) => runBattle(opts);
export type BotBattleResult = BattleRunResult;
