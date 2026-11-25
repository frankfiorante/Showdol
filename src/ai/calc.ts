/**
 * Bridge from live sim state to @smogon/calc. Uses the calc's data-free
 * "adaptable" build with the sim's own data (via @pkmn/data).
 *
 * Everything here only *reads* the battle: no events, no PRNG calls, so
 * evaluating options can never change how the battle plays out.
 */
import {calculate, Field, Move as CalcMove, Pokemon as CalcPokemon} from '@smogon/calc/dist/adaptable';
import type {Battle, Pokemon, Side} from '@pkmn/sim';
import {gen9} from '@/engine/gens';

// The calc's Generation interface is structurally the same as @pkmn/data's.
const gen = gen9 as never;

const WEATHER: Record<string, string> = {
  sunnyday: 'Sun', raindance: 'Rain', sandstorm: 'Sand', snowscape: 'Snow', snow: 'Snow',
  desolateland: 'Harsh Sunshine', primordialsea: 'Heavy Rain', deltastream: 'Strong Winds',
};
const TERRAIN: Record<string, string> = {
  electricterrain: 'Electric', grassyterrain: 'Grassy', psychicterrain: 'Psychic', mistyterrain: 'Misty',
};

export interface DamageEstimate {
  /** Expected damage as a fraction of the defender's current HP (0-1), accuracy included. */
  exp: number;
  /** Chance this hit knocks out the defender, accuracy included. */
  pKO: number;
}

const NONE: DamageEstimate = {exp: 0, pKO: 0};

/** A calc Pokémon for a sim Pokémon. `tera` forces the Tera state on or off. */
export function toCalc(p: Pokemon, tera?: boolean): CalcPokemon {
  const isTera = tera ?? !!p.terastallized;
  const {atk, def, spa, spd, spe} = p.boosts;
  return new CalcPokemon(gen, p.species.name, {
    level: p.level,
    ability: (p.getAbility().name || undefined) as never,
    item: (p.getItem().name || undefined) as never,
    nature: (p.set.nature || 'Hardy') as never,
    evs: p.set.evs,
    ivs: p.set.ivs,
    boosts: {atk, def, spa, spd, spe},
    curHP: p.hp,
    status: (p.status || '') as never,
    teraType: (isTera ? p.teraType : undefined) as never,
  });
}

export function fieldFor(battle: Battle, attacker: Side, defender: Side): Field {
  const side = (s: Side) => ({
    isReflect: !!s.sideConditions.reflect,
    isLightScreen: !!s.sideConditions.lightscreen,
    isAuroraVeil: !!s.sideConditions.auroraveil,
    isSR: !!s.sideConditions.stealthrock,
    spikes: s.sideConditions.spikes?.layers ?? 0,
    isTailwind: !!s.sideConditions.tailwind,
  });
  return new Field({
    gameType: 'Singles',
    weather: WEATHER[battle.field.effectiveWeather()] as never,
    terrain: TERRAIN[battle.field.terrain] as never,
    attackerSide: side(attacker),
    defenderSide: side(defender),
  });
}

/** The 16 damage rolls (or a single value) as a flat list of totals. */
function rolls(damage: number | number[] | number[][]): number[] {
  if (typeof damage === 'number') return [damage];
  if (Array.isArray(damage[0])) {
    const multi = damage as number[][];
    return multi[0].map((_, i) => multi.reduce((sum, hit) => sum + hit[i], 0));
  }
  return damage as number[];
}

/**
 * Expected damage and KO chance of `moveId` from attacker onto defender.
 * Returns zeros for status moves, immunities, and anything the calc can't handle.
 */
export function estimate(
  battle: Battle,
  attacker: Pokemon,
  defender: Pokemon,
  moveId: string,
  opts: {attackerTera?: boolean; defenderTera?: boolean} = {},
): DamageEstimate {
  const move = battle.dex.moves.get(moveId);
  if (move.category === 'Status' || defender.hp <= 0) return NONE;
  try {
    const result = calculate(
      gen,
      toCalc(attacker, opts.attackerTera),
      toCalc(defender, opts.defenderTera),
      new CalcMove(gen, move.name, {isStellarFirstUse: true} as never),
      fieldFor(battle, attacker.side, defender.side),
    );
    const r = rolls(result.damage);
    const hp = defender.hp;
    const acc = move.accuracy === true ? 1 : move.accuracy / 100;
    const mean = r.reduce((a, b) => a + b, 0) / r.length;
    const ko = r.filter(d => d >= hp).length / r.length;
    return {exp: Math.min(1, mean / hp) * acc, pKO: ko * acc};
  } catch {
    return NONE;
  }
}
