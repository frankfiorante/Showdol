/**
 * Heuristic AI: scores every legal option and picks the best, with a small
 * seeded chance of taking the runner-up. Works for either side.
 *
 * It sees the whole battle (including the player's full team), per PLAN.md.
 * Scores are in rough "points": ~100 for an attack that does a full HP bar.
 */
import type {Battle, Pokemon, PRNG, Side} from '@pkmn/sim';
import type {BotRequest} from '@/engine/random-bot';
import type {Opponent} from '@/engine/opponent';
import {estimate, type DamageEstimate} from './calc';

export interface AIWeights {
  /** Bonus scaled by KO chance. */
  ko: number;
  /** Extra bonus for a likely KO before the target can act. */
  koFirst: number;
  /** How much an attack is discounted when we'll probably be KO'd first (0-1). */
  outspedPenalty: number;
  /** Fixed cost of switching (lost tempo). */
  switchCost: number;
  /** Extra cost for switching out a Pokémon that just came in. */
  switchChurn: number;
  /** How much of the matchup improvement a switch is credited with (0-1). */
  switchGain: number;
  /** Cost of switching when the active Pokémon isn't under pressure. */
  comfortableSwitchCost: number;
  /** Weight of incoming damage when judging a matchup. */
  defense: number;
  /** Percent chance of choosing the runner-up when it's close. */
  randomPct: number;
  /** The runner-up must score at least this fraction of the best. */
  randomMargin: number;
  setup: number;
  status: number;
  hazards: number;
  recovery: number;
}

export const DEFAULT_WEIGHTS: AIWeights = {
  ko: 60,
  koFirst: 40,
  outspedPenalty: 0.6,
  switchCost: 20,
  switchChurn: 30,
  switchGain: 0.8,
  comfortableSwitchCost: 30,
  defense: 1,
  randomPct: 10,
  randomMargin: 0.8,
  setup: 80,
  status: 45,
  hazards: 12,
  recovery: 110,
};

interface Option {
  choice: string;
  score: number;
}

const HAZARDS: Record<string, number> = {stealthrock: 1, spikes: 3, toxicspikes: 2, stickyweb: 1};
const REMOVAL = new Set(['defog', 'rapidspin', 'mortalspin', 'tidyup', 'courtchange']);
const PIVOTS = new Set(['uturn', 'voltswitch', 'flipturn', 'partingshot', 'teleport', 'chillyreception', 'shedtail']);
const SCREENS = new Set(['reflect', 'lightscreen', 'auroraveil']);
const SELF_DESTRUCT = new Set(['explosion', 'selfdestruct', 'mistyexplosion', 'finalgambit', 'memento', 'healingwish', 'lunardance']);

export function heuristicOpponent(w: AIWeights = DEFAULT_WEIGHTS): Opponent {
  return {
    choose(req, battle, rng) {
      const me = battle.sides.find(s => s.activeRequest === (req as unknown))!;
      const ai = new Evaluator(battle, me, w);
      const options = req.forceSwitch ? ai.forcedSwitchOptions(req) : ai.turnOptions(req);
      return pick(options, rng, w) ?? 'default';
    },
  };
}

function pick(options: Option[], rng: PRNG, w: AIWeights): string | undefined {
  if (!options.length) return undefined;
  const sorted = [...options].sort((a, b) => b.score - a.score);
  const [best, second] = sorted;
  if (second && best.score > 0 && second.score >= best.score * w.randomMargin && rng.random(100) < w.randomPct) {
    return second.choice;
  }
  return best.choice;
}

const fainted = (cond: string) => cond.endsWith(' fnt');

class Evaluator {
  readonly foe: Side;
  readonly self: Pokemon;
  readonly target: Pokemon | null;

  constructor(readonly battle: Battle, readonly me: Side, readonly w: AIWeights) {
    this.foe = me.foe;
    this.self = me.active[0];
    this.target = this.foe.active[0]?.hp ? this.foe.active[0] : null;
  }

  private hpFrac(p: Pokemon) {
    return p.hp / p.maxhp;
  }

  /** Best expected damage the attacker's moves do to the defender. */
  private best(attacker: Pokemon, defender: Pokemon, opts: {attackerTera?: boolean; defenderTera?: boolean} = {}) {
    let best: DamageEstimate & {priority: number} = {exp: 0, pKO: 0, priority: 0};
    for (const slot of attacker.moveSlots) {
      if (slot.pp <= 0) continue;
      const e = estimate(this.battle, attacker, defender, slot.id, opts);
      const score = e.exp + e.pKO;
      if (score > best.exp + best.pKO) best = {...e, priority: this.battle.dex.moves.get(slot.id).priority};
    }
    return best;
  }

  /** True if `a` moves before `b` with a priority-0 move (ties count as 50/50 → false). */
  private faster(a: Pokemon, b: Pokemon) {
    return a.getActionSpeed() > b.getActionSpeed();
  }

  /** How good it is for `mon` to face the foe's active Pokémon (higher is better). */
  private matchup(mon: Pokemon, entering: boolean) {
    if (!this.target) return 0;
    const offense = this.best(mon, this.target);
    const threat = this.best(this.target, mon);
    let score = offense.exp * 100 + offense.pKO * this.w.ko;
    let incoming = threat.exp * 100;
    if (threat.pKO > 0.5 && (threat.priority > 0 || !this.faster(mon, this.target))) incoming += 50;
    if (entering) incoming += this.hazardDamage(mon) * 100;
    score -= incoming * this.w.defense;
    return score;
  }

  /** Fraction of max HP lost to entry hazards on switch-in. */
  private hazardDamage(mon: Pokemon) {
    const conds = this.me.sideConditions;
    let dmg = 0;
    if (conds.stealthrock && mon.getItem().id !== 'heavydutyboots') {
      dmg += 0.125 * 2 ** this.battle.dex.getEffectiveness('Rock', mon.getTypes());
    }
    if (conds.spikes && mon.isGrounded() && mon.getItem().id !== 'heavydutyboots') {
      dmg += [0, 1 / 8, 1 / 6, 1 / 4][conds.spikes.layers ?? 1];
    }
    return Math.min(dmg, this.hpFrac(mon));
  }

  forcedSwitchOptions(req: BotRequest): Option[] {
    const team = req.side.pokemon;
    const reviving = team.some(p => p.active && p.reviving);
    return team.flatMap((p, i) => {
      if (p.active || fainted(p.condition) !== reviving) return [];
      const mon = this.me.pokemon[i];
      return [{choice: `switch ${i + 1}`, score: reviving ? mon.maxhp : this.matchup(mon, true)}];
    });
  }

  turnOptions(req: BotRequest): Option[] {
    const active = req.active?.[0];
    if (!active || !this.target) return [];
    const options: Option[] = [];
    const threat = this.best(this.target, this.self);
    const threatIfTera = active.canTerastallize ? this.best(this.target, this.self, {defenderTera: true}) : threat;

    active.moves.forEach((m, i) => {
      if (m.disabled) return;
      const plain = this.scoreMove(m.id, false, threat);
      options.push({choice: `move ${i + 1}`, score: plain.score});
      if (active.canTerastallize) {
        const tera = this.scoreMove(m.id, true, threatIfTera);
        // One rule (PLAN.md): Tera only when it flips a knockout either way.
        const flipsOurs = tera.pKO >= 0.5 && plain.pKO < 0.5;
        const flipsTheirs = threat.pKO >= 0.5 && threatIfTera.pKO < 0.5;
        if (flipsOurs || flipsTheirs) options.push({choice: `move ${i + 1} terastallize`, score: tera.score + 5});
      }
    });

    if (!active.trapped) {
      // Switching gives the foe a free hit, so only consider it under pressure:
      // likely to be KO'd, losing the damage race badly, or unable to hurt the foe.
      const ours = this.best(this.self, this.target);
      const pressured = threat.pKO > 0.4 || threat.exp > 0.55 + ours.exp / 2 || ours.exp < 0.15;
      const current = this.matchup(this.self, false);
      const cost = this.w.switchCost + (pressured ? 0 : this.w.comfortableSwitchCost) +
        (this.self.activeTurns === 0 ? this.w.switchChurn : 0);
      req.side.pokemon.forEach((p, i) => {
        if (p.active || fainted(p.condition)) return;
        const mon = this.me.pokemon[i];
        const gain = (this.matchup(mon, true) - current) * this.w.switchGain;
        options.push({choice: `switch ${i + 1}`, score: gain - cost});
      });
    }
    return options;
  }

  private scoreMove(id: string, tera: boolean, threat: DamageEstimate & {priority: number}) {
    const move = this.battle.dex.moves.get(id);
    const target = this.target!;
    const self = this.self;
    const goesFirst = move.priority > threat.priority || (move.priority === threat.priority && this.faster(self, target));
    const likelyKOd = !goesFirst && threat.pKO > 0.5;

    if (move.category !== 'Status') {
      const e = estimate(this.battle, self, target, id, {attackerTera: tera});
      if (e.exp === 0) return {score: -50, pKO: 0};
      let score = e.exp * 100 + e.pKO * this.w.ko;
      if (goesFirst && e.pKO > 0.5) score += this.w.koFirst;
      if (likelyKOd) score *= 1 - this.w.outspedPenalty * threat.pKO;
      if (move.recoil) score -= (e.exp * target.hp * (move.recoil[0] / move.recoil[1]) / self.maxhp) * 60;
      if (move.mindBlownRecoil || move.id === 'steelbeam') score -= 30;
      if (SELF_DESTRUCT.has(move.id)) score = e.pKO > 0.5 && this.hpFrac(self) < 0.4 ? score : score - 80;
      if (PIVOTS.has(move.id)) score += 5;
      // Moves that only work in some situations.
      if ((move.id === 'fakeout' || move.id === 'firstimpression') && self.activeTurns > 0) return {score: -50, pKO: 0};
      if (move.id === 'suckerpunch' || move.id === 'thunderclap') score *= 0.6; // fails if the target doesn't attack
      if (move.id === 'focuspunch') score *= 0.3;
      if (move.flags.charge && self.getItem().id !== 'powerherb' &&
          !(['solarbeam', 'solarblade'].includes(move.id) && ['sunnyday', 'desolateland'].includes(this.battle.field.effectiveWeather()))) {
        score *= 0.45; // two turns to land
      }
      if (move.flags.recharge) score *= 0.7;
      if (move.self?.boosts && Object.values(move.self.boosts).some(v => (v ?? 0) < 0)) score -= 8;
      return {score, pKO: e.pKO};
    }
    return {score: this.scoreStatus(id, threat, likelyKOd), pKO: 0};
  }

  private scoreStatus(id: string, threat: DamageEstimate, likelyKOd: boolean): number {
    const move = this.battle.dex.moves.get(id);
    const self = this.self;
    const target = this.target!;
    const acc = move.accuracy === true ? 1 : move.accuracy / 100;
    const hp = this.hpFrac(self);
    const doomed = likelyKOd ? 0.4 : 1;

    // Inflicting a major status.
    if (move.status && move.target !== 'self') {
      if (target.status || target.volatiles.substitute || !this.canStatus(target, move.status, move)) return -20;
      const value: Record<string, number> = {
        slp: 70,
        par: this.faster(target, self) ? 55 : 35,
        brn: target.getStat('atk', false, true) > target.getStat('spa', false, true) ? 55 : 20,
        tox: 45,
        psn: 30,
        frz: 50,
      };
      return (value[move.status] ?? 30) * (this.w.status / 45) * acc * doomed * (0.5 + this.hpFrac(target) / 2);
    }
    if (move.id === 'yawn') return target.status || target.volatiles.yawn ? -20 : 35 * doomed;

    // Entry hazards.
    if (HAZARDS[move.id]) {
      const cond = this.foe.sideConditions[move.id];
      if (cond && (cond.layers ?? 1) >= HAZARDS[move.id]) return -20;
      const left = this.foe.pokemon.filter(p => p.hp > 0 && !p.isActive).length;
      return (15 + this.w.hazards * left) * doomed * (cond ? 0.6 : 1);
    }
    if (REMOVAL.has(move.id)) {
      const mine = Object.keys(this.me.sideConditions).some(c => HAZARDS[c]);
      return mine ? 45 * doomed : 0;
    }

    // Healing.
    if (move.heal || move.flags.heal || ['rest', 'strengthsap', 'synthesis', 'morningsun', 'moonlight', 'shoreup'].includes(move.id)) {
      if (hp > 0.75) return -10;
      const missing = 1 - hp;
      return missing * this.w.recovery - (threat.exp * hp > missing ? 40 : 0);
    }

    // Stat boosts for ourselves.
    const boosts = move.boosts && (move.target === 'self' || move.target === 'adjacentAllyOrSelf') ? move.boosts : move.self?.boosts;
    if (boosts && Object.values(boosts).some(v => (v ?? 0) > 0)) {
      const already = Math.max(...Object.entries(boosts).map(([k, v]) => ((v ?? 0) > 0 ? self.boosts[k as 'atk'] : -6)));
      if (already >= 6) return -30;
      const safe = threat.exp < 0.4 ? 1 : threat.exp < 0.7 ? 0.45 : 0.15;
      return this.w.setup * safe * doomed - already * 12;
    }

    if (move.id === 'substitute') return self.volatiles.substitute || hp <= 0.5 ? -20 : threat.exp < 0.25 ? 30 : 5;
    if (move.stallingMove) return this.battle.turn > 1 && self.lastMove?.id === move.id ? -30 : 5;
    if (SCREENS.has(move.id)) return this.me.sideConditions[move.id] ? -20 : 30 * doomed;
    if (move.weather || move.terrain || move.pseudoWeather) return 15;
    if (move.id === 'haze' || move.id === 'clearsmog') {
      return Object.values(target.boosts).some(v => v > 0) ? 50 : -10;
    }
    if (['whirlwind', 'roar', 'dragontail', 'circlethrow'].includes(move.id)) {
      return Object.values(target.boosts).some(v => v > 0) ? 50 : 10;
    }
    if (['wish', 'healbell', 'aromatherapy'].includes(move.id)) return hp < 0.6 ? 35 : 10;
    if (['taunt', 'encore', 'trick', 'switcheroo', 'destinybond', 'painsplit', 'leechseed'].includes(move.id)) return 20 * doomed;
    if (PIVOTS.has(move.id)) return 20;
    return 10 * doomed;
  }

  private canStatus(target: Pokemon, status: string, move: {flags: {powder?: 1}; type: string}) {
    const types = target.getTypes();
    const ability = target.getAbility().id;
    if (this.battle.field.terrain === 'mistyterrain' && target.isGrounded()) return false;
    if (this.battle.dex.getImmunity(move.type, types) === false) return false;
    if (move.flags.powder && (types.includes('Grass') || ability === 'overcoat' || target.getItem().id === 'safetygoggles')) return false;
    if (['purifyingsalt', 'comatose', 'goodasgold', 'magicbounce'].includes(ability)) return false;
    if (status === 'brn') return !types.includes('Fire') && !['waterveil', 'waterbubble', 'thermalexchange'].includes(ability);
    if (status === 'par') return !types.includes('Electric') && ability !== 'limber';
    if (status === 'tox' || status === 'psn') {
      return !types.includes('Poison') && !types.includes('Steel') && !['immunity', 'pastelveil'].includes(ability);
    }
    if (status === 'slp') {
      return !['insomnia', 'vitalspirit', 'sweetveil'].includes(ability) && this.battle.field.terrain !== 'electricterrain';
    }
    return true;
  }
}
