/**
 * A bot that picks a uniformly random legal choice from a sim request.
 * Used for spikes, the AI test harness, and as a fallback.
 */

/** Minimal slice of the sim's ChoiceRequest that the bot reads. */
export interface BotRequest {
  wait?: boolean;
  teamPreview?: boolean;
  forceSwitch?: boolean[];
  active?: {
    moves: {id: string; disabled?: string | boolean; pp?: number}[];
    trapped?: boolean;
    maybeTrapped?: boolean;
    canTerastallize?: string;
  }[];
  side: {
    pokemon: {active: boolean; condition: string; reviving?: boolean}[];
  };
}

/** Returns an integer in [0, n). */
export type RandInt = (n: number) => number;

const isFainted = (condition: string) => condition.endsWith(' fnt');

export function chooseRandom(req: BotRequest, randInt: RandInt, teraChance = 0.1): string {
  if (req.wait) throw new Error('chooseRandom called on a wait request');
  if (req.teamPreview) return 'default';

  const team = req.side.pokemon;

  if (req.forceSwitch) {
    // Revival Blessing: the active Pokémon is "reviving" and must pick a fainted ally.
    const reviving = team.some(p => p.active && p.reviving);
    const options = team
      .map((p, i) => ({p, slot: i + 1}))
      .filter(({p}) => !p.active && (reviving ? isFainted(p.condition) : !isFainted(p.condition)));
    if (!options.length) return 'pass';
    return `switch ${options[randInt(options.length)].slot}`;
  }

  const active = req.active?.[0];
  if (!active) return 'default';

  const moves = active.moves
    .map((m, i) => ({m, slot: i + 1}))
    .filter(({m}) => !m.disabled);
  const switches = active.trapped
    ? []
    : team
        .map((p, i) => ({p, slot: i + 1}))
        .filter(({p}) => !p.active && !isFainted(p.condition));

  // Prefer moves 3:1 so random battles actually end.
  const pickSwitch = switches.length > 0 && (moves.length === 0 || randInt(4) === 0);
  if (pickSwitch) return `switch ${switches[randInt(switches.length)].slot}`;
  if (!moves.length) return 'default';

  const {slot} = moves[randInt(moves.length)];
  const tera = active.canTerastallize && randInt(1000) < teraChance * 1000 ? ' terastallize' : '';
  return `move ${slot}${tera}`;
}
