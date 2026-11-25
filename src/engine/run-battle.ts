import {Battle, PRNG, type PRNGSeed} from '@pkmn/sim';
import {chooseRandom, type BotRequest} from './random-bot';
import {FORMAT} from './puzzle';

export interface BotBattleOptions {
  /** Packed teams. */
  p1Team: string;
  p2Team: string;
  /** Battle seed (damage rolls, crits, ...). Random if omitted. */
  battleSeed?: string;
  /** Seed for the bots' choices. Random if omitted. */
  botSeed?: string;
  /** Hard cap so a stalemate can't spin forever. */
  maxTurns?: number;
}

export interface BotBattleResult {
  winner: 'p1' | 'p2' | 'tie';
  turns: number;
  battleSeed: string;
  botSeed: string;
  /** Every choice, in the order it was made, as BattleStream input lines. */
  inputLog: string[];
  /** Full omniscient protocol log. */
  log: string[];
  ms: number;
  species: {p1: string[]; p2: string[]};
}

/**
 * Runs a full random-bot vs random-bot battle synchronously by driving the
 * sim's Battle object directly. Works in Node and in a Web Worker.
 */
export function runBotBattle(opts: BotBattleOptions): BotBattleResult {
  const start = performance.now();
  const battleSeed = (opts.battleSeed ?? PRNG.generateSeed()) as PRNGSeed;
  const botSeed = (opts.botSeed ?? PRNG.generateSeed()) as PRNGSeed;
  const botRng = new PRNG(botSeed);
  const randInt = (n: number) => botRng.random(n);
  const maxTurns = opts.maxTurns ?? 500;

  const battle = new Battle({formatid: FORMAT as never, seed: battleSeed});
  battle.setPlayer('p1', {name: 'Player', team: opts.p1Team});
  battle.setPlayer('p2', {name: 'AI', team: opts.p2Team});

  const inputLog: string[] = [];
  while (!battle.ended) {
    let acted = false;
    for (const side of battle.sides) {
      const req = side.activeRequest as BotRequest | null;
      if (!req || req.wait || side.isChoiceDone()) continue;
      let choice = chooseRandom(req, randInt);
      if (!battle.choose(side.id, choice)) {
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

  const winner =
    battle.winner === 'Player' ? 'p1' : battle.winner === 'AI' ? 'p2' : 'tie';
  return {
    winner,
    turns: battle.turn,
    battleSeed,
    botSeed,
    inputLog,
    log: battle.log.slice(),
    ms: performance.now() - start,
    species: {
      p1: battle.sides[0].pokemon.map(p => p.species.name),
      p2: battle.sides[1].pokemon.map(p => p.species.name),
    },
  };
}
