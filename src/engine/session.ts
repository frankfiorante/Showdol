import {Battle, Dex, PRNG, Teams, extractChannelMessages, type PRNGSeed} from '@pkmn/sim';
import {Battle as ClientBattle, type Pokemon as ClientPokemon} from '@pkmn/client';
import {gens} from './gens';
import {boostMultiplier, hintFor, speedRange} from './hints';
import {Protocol} from '@pkmn/protocol';
import {LogFormatter} from '@pkmn/view';
import {FORMAT} from './puzzle';
import type {BotRequest} from './random-bot';
import {decisionSeed, type Opponent} from './opponent';
import {heuristicOpponent} from '@/ai/heuristic';
import type {BattleResult, BattleView, MoveOption, PokemonView, Prompt, SideView, SpeedEstimate, SwitchOption} from './view';

export type {Opponent} from './opponent';

export interface SessionInit {
  /** Packed teams. */
  playerTeam: string;
  aiTeam: string;
  battleSeed: string;
  aiSeed: string;
  opponent?: Opponent;
  /** Choices already made (from storage) to replay before continuing. */
  inputLog?: string[];
}

export interface StepResult {
  view: BattleView;
  /** Formatted log text added since the previous step. */
  log: string[];
}

export class ChoiceError extends Error {}

/** A saved input log that no longer replays (e.g. the sim changed). */
export class ReplayError extends Error {}

const PLAYER = 'Player';
const AI = 'AI';

/**
 * One player's battle: the sim (omniscient), the AI opponent, and a client
 * that sees only the player's channel and powers the view and the log.
 * Plain TypeScript, so it runs in the worker and in Node tests alike.
 */
export class BattleSession {
  readonly sim: Battle;
  private readonly client: ClientBattle;
  private readonly formatter: LogFormatter;
  private readonly opponent: Opponent;
  private readonly aiSeed: string;
  private aiDecisions = 0;
  private readonly playerSets: ReturnType<typeof Teams.unpack> & object;
  private cursor = 0;
  private forfeited = false;
  /** Every choice in order, as `>p1 move 1` lines. Phase 2 persists this. */
  readonly inputLog: string[] = [];
  /** Full formatted log so far. */
  readonly log: string[] = [];

  constructor(init: SessionInit) {
    this.playerSets = Teams.unpack(init.playerTeam)!;
    this.opponent = init.opponent ?? heuristicOpponent();
    this.aiSeed = init.aiSeed;
    this.sim = new Battle({formatid: FORMAT as never, seed: init.battleSeed as PRNGSeed});
    this.client = new ClientBattle(gens, 'p1' as never, this.playerSets as never);
    this.formatter = new LogFormatter('p1', this.client);
    this.sim.setPlayer('p1', {name: PLAYER, team: init.playerTeam});
    this.sim.setPlayer('p2', {name: AI, team: init.aiTeam});
    if (init.inputLog) this.replay(init.inputLog);
  }

  /** Re-applies saved choices without asking the AI again. */
  private replay(lines: string[]) {
    for (const line of lines) {
      if (line === '>forcelose p1') {
        this.forfeited = true;
        this.sim.lose('p1');
      } else {
        const m = line.match(/^>(p[12]) (.+)$/);
        if (!m || this.sim.ended || !this.sim.choose(m[1] as 'p1' | 'p2', m[2])) {
          throw new ReplayError(`Saved battle could not be replayed at "${line}" (turn ${this.sim.turn})`);
        }
        if (m[1] === 'p2') this.aiDecisions++;
      }
      this.inputLog.push(line);
    }
  }

  /** Runs until the player has to choose (or the battle ends). */
  start(): StepResult {
    return this.advance();
  }

  choose(choice: string): StepResult {
    if (this.sim.ended) throw new ChoiceError('The battle is over.');
    const side = this.sim.sides[0];
    if (!this.needsChoice(0)) throw new ChoiceError('Not waiting for a choice.');
    if (!this.sim.choose('p1', choice)) {
      const error = side.choice.error || `Invalid choice: ${choice}`;
      // Keeps any request update the sim made (e.g. trapped: true).
      side.clearChoice();
      throw new ChoiceError(error.replace(/^\[[^\]]+]\s*/, ''));
    }
    this.inputLog.push(`>p1 ${choice}`);
    return this.advance();
  }

  forfeit(): StepResult {
    if (!this.sim.ended) {
      this.forfeited = true;
      this.inputLog.push('>forcelose p1');
      this.sim.lose('p1');
    }
    return this.advance();
  }

  private needsChoice(n: 0 | 1) {
    const side = this.sim.sides[n];
    const req = side.activeRequest;
    return !!req && !req.wait && !side.isChoiceDone();
  }

  private advance(): StepResult {
    // The AI decides as soon as it's asked, before seeing the player's choice.
    while (!this.sim.ended && this.needsChoice(1)) {
      const req = this.sim.sides[1].activeRequest as unknown as BotRequest;
      const rng = new PRNG(decisionSeed(this.aiSeed, this.aiDecisions++));
      let choice = this.opponent.choose(req, this.sim, rng);
      if (!this.sim.choose('p2', choice)) {
        this.sim.sides[1].clearChoice();
        choice = 'default';
        this.sim.choose('p2', choice);
      }
      this.inputLog.push(`>p2 ${choice}`);
    }
    if (!this.sim.ended && !this.needsChoice(0)) {
      throw new Error(`Battle stalled on turn ${this.sim.turn}`);
    }
    const log = this.feedClient();
    return {view: this.view(), log};
  }

  /** Feeds new sim output (player's channel only) to the client and formatter. */
  private feedClient(): string[] {
    const fresh = this.sim.log.slice(this.cursor);
    this.cursor = this.sim.log.length;
    const lines = extractChannelMessages(fresh.join('\n'), [1])[1];
    const out: string[] = [];
    for (const line of lines) {
      const {args, kwArgs} = Protocol.parseBattleLine(line);
      const text = this.formatter.formatText(args as never, kwArgs as never);
      if (text) out.push(text);
      this.client.add(args as never, kwArgs as never);
    }
    // The client is deliberately never given |request| data: the player's own
    // side comes straight from the sim, and keeping the client's state a pure
    // function of the log means a resumed battle formats exactly like a live one.
    const formatted = out.join('').split('\n').filter(l => l.trim() !== '');
    this.log.push(...formatted);
    return formatted;
  }

  view(): BattleView {
    return {
      turn: this.sim.turn,
      me: this.mySide(),
      foe: this.foeSide(),
      field: {
        weather: this.client.field.weather,
        terrain: this.client.field.terrain,
        pseudoWeather: Object.keys(this.client.field.pseudoWeather).map(id => Dex.conditions.get(id).name),
      },
      prompt: this.sim.ended ? null : this.prompt(),
      result: this.sim.ended ? this.result() : null,
    };
  }

  private mySide(): SideView {
    const simSide = this.sim.sides[0];
    const clientSide = this.client.p1;
    // Sim Pokémon in original team order (the sim reorders side.pokemon on switches).
    const team = simSide.team.map((set, teamIndex) => {
      const p = simSide.pokemon.find(mon => mon.set === set)!;
      const known = clientSide.team.find(c => c.originalIdent === `p1: ${p.name}`);
      const view: PokemonView = {
        teamIndex,
        name: p.name,
        species: p.species.name,
        level: p.level,
        types: p.getTypes(),
        hp: p.hp,
        maxhp: p.maxhp,
        status: p.status || undefined,
        fainted: p.fainted,
        active: p.isActive,
        boosts: p.isActive ? nonZero(p.boosts) : {},
        volatiles: p.isActive && known ? volatiles(known) : [],
        item: p.item ? Dex.items.get(p.item).name : undefined,
        ability: Dex.abilities.get(p.ability).name,
        moves: p.baseMoveSlots.map(m => m.move),
        moveDetails: p.moveSlots.map(m => ({name: m.move, type: Dex.moves.get(m.id).type, pp: m.pp, maxpp: m.maxpp})),
        teraType: p.teraType,
        terastallized: p.terastallized || undefined,
        stats: {...p.storedStats},
      };
      return view;
    });
    return {
      active: team.find(p => p.active) ?? null,
      team,
      totalPokemon: team.length,
      conditions: sideConditions(clientSide.sideConditions),
    };
  }

  private foeSide(): SideView {
    const side = this.client.p2;
    const toView = (p: ClientPokemon): PokemonView => {
      const ability = abilityName(p.ability);
      const item = itemName(p.item);
      const isActive = side.active.includes(p);
      return {
        name: p.name,
        species: p.speciesForme,
        level: p.level,
        types: p.terastallized ? [p.terastallized] : [...(this.client.gen.species.get(p.speciesForme)?.types ?? [])],
        hp: p.hp,
        maxhp: p.maxhp,
        status: p.status,
        fainted: p.fainted,
        active: isActive,
        boosts: nonZero(p.boosts as Record<string, number>),
        volatiles: volatiles(p),
        item,
        ability,
        moves: p.moveSlots.map(m => m.name),
        moveDetails: p.moveSlots.map(m => ({name: m.name, type: Dex.moves.get(m.id).type})),
        terastallized: p.terastallized,
        possibleAbilities: ability ? undefined : this.transformTarget(p) ? [this.transformTarget(p)!.getAbility().name] : hintFor(p.speciesForme)?.abilities,
        transformed: !!p.volatiles.transform,
        speed: foeSpeed(p, item, isActive && !!side.sideConditions.tailwind, this.transformedSpeed(p)),
      };
    };
    const active = side.active[0];
    return {
      active: active && !active.fainted ? toView(active) : null,
      team: withoutIllusionGhosts(side.team).map(toView),
      totalPokemon: side.totalPokemon || 6,
      conditions: sideConditions(side.sideConditions),
    };
  }

  /**
   * Transform copies the target's stats and ability. In singles the target is
   * the player's own Pokémon, which the player knows, so these are exact.
   */
  private transformedSpeed(p: ClientPokemon): number | undefined {
    return this.transformTarget(p)?.storedStats.spe;
  }

  /** The player's Pokémon a transformed foe copied (its stats and ability are known exactly). */
  private transformTarget(p: ClientPokemon) {
    const target = p.volatiles.transform?.pokemon;
    if (!target) return undefined;
    return this.sim.sides[0].pokemon.find(mon => `p1: ${mon.name}` === target.originalIdent);
  }

  private prompt(): Prompt | null {
    if (!this.needsChoice(0)) return null;
    const req = this.sim.sides[0].activeRequest!;
    const simSide = this.sim.sides[0];
    const teamIndex = (slot: number) => simSide.team.indexOf(simSide.pokemon[slot - 1].set);
    const reqTeam = req.side.pokemon;
    const fainted = (i: number) => reqTeam[i].condition.endsWith(' fnt');

    if ('forceSwitch' in req && req.forceSwitch) {
      const reviving = reqTeam.some(p => p.active && p.reviving);
      const switches: SwitchOption[] = reqTeam
        .map((p, i) => ({slot: i + 1, teamIndex: teamIndex(i + 1), ok: !p.active && fainted(i) === reviving}))
        .filter(s => s.ok)
        .map(({slot, teamIndex}) => ({slot, teamIndex}));
      return {kind: 'switch', switches, reviving};
    }
    if (!('active' in req) || !req.active) return null;
    const active = req.active[0];
    const foeTypes = this.foeSide().active?.types ?? [];
    const moves: MoveOption[] = active.moves.map((m, i) => {
      const move = Dex.moves.get(m.id);
      return {
        slot: i + 1,
        id: m.id,
        name: m.move,
        type: move.type,
        category: move.category,
        basePower: move.basePower,
        accuracy: move.accuracy,
        pp: m.pp ?? 0,
        maxpp: m.maxpp ?? 0,
        disabled: !!m.disabled,
        priority: move.priority,
        desc: move.shortDesc || move.desc,
        flags: moveFlags(move),
        effectiveness: move.category === 'Status' || !foeTypes.length ? undefined : effectiveness(move.type, foeTypes),
      };
    });
    const trapped = !!active.trapped;
    const switches: SwitchOption[] = trapped
      ? []
      : reqTeam
          .map((p, i) => ({slot: i + 1, teamIndex: teamIndex(i + 1), ok: !p.active && !fainted(i)}))
          .filter(s => s.ok)
          .map(({slot, teamIndex}) => ({slot, teamIndex}));
    return {kind: 'move', moves, canTera: active.canTerastallize, switches, trapped};
  }

  private result(): BattleResult {
    const [me, ai] = this.sim.sides;
    // Match on base species so forme changes (Mimikyu-Busted, Ogerpon's Tera forms) still count as seen.
    const base = (name: string) => Dex.species.get(name).baseSpecies;
    const seen = new Set(this.client.p2.team.map(p => base(p.speciesForme)));
    return {
      winner: this.sim.winner === PLAYER ? 'player' : this.sim.winner === AI ? 'ai' : 'tie',
      turns: this.sim.turn,
      myFainted: me.team.map(set => me.pokemon.find(p => p.set === set)!.fainted),
      aiRemaining: ai.pokemon.filter(p => !p.fainted).length,
      forfeited: this.forfeited,
      // Safe to reveal once the battle is over.
      aiTeam: ai.team.map(set => Dex.species.get(set.species).name),
      aiSeen: ai.team.map(set => seen.has(base(set.species))),
    };
  }
}

/**
 * When Zoroark's Illusion breaks, the client keeps a stale entry for the
 * Pokémon it was disguised as (with Zoroark's HP and Tera). The real one is
 * always tracked later, so keep the last entry per name.
 */
function withoutIllusionGhosts(team: ClientPokemon[]): ClientPokemon[] {
  return team.filter((p, i) => !team.slice(i + 1).some(q => q.name === p.name));
}

/**
 * Display names for the foe's revealed item and ability. The client sometimes
 * stores an effect id like "itemlifeorb" (from "[from] item: Life Orb").
 */
function itemName(id: string) {
  if (!id) return undefined;
  const plain = Dex.items.get(id);
  if (plain.exists) return plain.name;
  const stripped = Dex.items.get(id.replace(/^item/, ''));
  return stripped.exists ? stripped.name : undefined;
}

function abilityName(id: string) {
  if (!id) return undefined;
  const plain = Dex.abilities.get(id);
  if (plain.exists) return plain.name;
  const stripped = Dex.abilities.get(id.replace(/^ability/, ''));
  return stripped.exists ? stripped.name : undefined;
}

/**
 * The foe's Speed from public information only: base stat, level and the
 * Random Battle spreads, then whatever modifiers have been revealed.
 */
function foeSpeed(p: ClientPokemon, item: string | undefined, tailwind: boolean, copied?: number): SpeedEstimate {
  const [min, max] = copied === undefined ? speedRange(p.speciesForme, p.level) : [copied, copied];
  const modifiers: string[] = copied === undefined ? [] : ['Transformed'];
  let mult = 1;
  const stage = p.boosts.spe ?? 0;
  if (stage) {
    mult *= boostMultiplier(stage);
    modifiers.push(`${stage > 0 ? '+' : ''}${stage}`);
  }
  if (p.status === 'par') {
    mult *= 0.5;
    modifiers.push('Paralysis');
  }
  if (item === 'Choice Scarf') {
    mult *= 1.5;
    modifiers.push('Choice Scarf');
  } else if (item === 'Iron Ball') {
    mult *= 0.5;
    modifiers.push('Iron Ball');
  }
  if (tailwind) {
    mult *= 2;
    modifiers.push('Tailwind');
  }
  return mult !== 1
    ? {min, max, modifiedMin: Math.floor(min * mult), modifiedMax: Math.floor(max * mult), modifiers}
    : {min, max, modifiers};
}

/** The flag notes Showdown's move tooltip lists. */
function moveFlags(move: ReturnType<typeof Dex.moves.get>): string[] {
  const f = move.flags;
  const notes: string[] = [];
  if (f.contact) notes.push('Contact');
  if (f.sound) notes.push('Sound');
  if (f.powder) notes.push('Powder');
  if (f.punch) notes.push('Punch');
  if (f.slicing) notes.push('Slicing');
  if (f.pulse) notes.push('Pulse');
  if (f.bite) notes.push('Bite');
  if (f.bullet) notes.push('Bullet');
  if (f.wind) notes.push('Wind');
  const hitsTarget = !['self', 'allySide', 'foeSide', 'all', 'allies', 'allyTeam'].includes(move.target);
  if (hitsTarget && !f.protect) notes.push('Not blocked by Protect');
  if (hitsTarget && f.bypasssub && !f.sound) notes.push('Bypasses Substitute');
  if (f.reflectable) notes.push('Bounceable (Magic Bounce / Magic Coat)');
  return notes;
}

/** Type-chart multiplier only: what the player could work out from the types shown. */
function effectiveness(moveType: string, types: string[]) {
  if (!Dex.getImmunity(moveType, types)) return 0;
  return 2 ** Dex.getEffectiveness(moveType, types);
}

function nonZero(boosts: Record<string, number>) {
  return Object.fromEntries(Object.entries(boosts).filter(([, v]) => v));
}

const SHOWN_VOLATILES = new Set([
  'confusion', 'substitute', 'leechseed', 'taunt', 'encore', 'torment', 'yawn', 'perishsong',
  'curse', 'saltcure', 'focusenergy', 'protosynthesis', 'quarkdrive', 'flashfire', 'disable',
  'magnetrise', 'aquaring', 'ingrain', 'destinybond', 'partiallytrapped', 'trapped', 'charge',
]);

function volatiles(p: ClientPokemon) {
  return Object.keys(p.volatiles)
    .filter(id => SHOWN_VOLATILES.has(id))
    .map(id => Dex.conditions.get(id).name || id);
}

function sideConditions(conds: Record<string, {name: string; level: number}>) {
  return Object.values(conds).map(c => (c.level > 1 ? `${c.name} ×${c.level}` : c.name));
}
