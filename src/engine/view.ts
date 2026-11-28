/**
 * Plain, serializable battle state sent from the worker to the UI.
 * Built only from what the player is allowed to know.
 */

export interface PokemonView {
  /** Index in the original team order (0-5). Only set for the player's side. */
  teamIndex?: number;
  name: string;
  species: string;
  level: number;
  types: string[];
  /** For the player: real HP. For the foe: percent, with maxhp 100. */
  hp: number;
  maxhp: number;
  status?: string;
  fainted: boolean;
  active: boolean;
  boosts: Record<string, number>;
  /** Volatile conditions worth showing (confusion, substitute, leech seed, ...). */
  volatiles: ConditionView[];
  /** The item it holds now. */
  item?: string;
  /** An item it held and lost, with how: "Life Orb (knocked off)". Only when it holds nothing now. */
  lostItem?: string;
  ability?: string;
  /** Known move names (all for the player, revealed ones for the foe). */
  moves: string[];
  teraType?: string;
  terastallized?: string;
  stats?: Record<string, number>;
  /** The player's moves with remaining PP; the foe's revealed moves (no PP). */
  moveDetails?: {name: string; type: string; pp?: number; maxpp?: number}[];
  /** Foe only, while its ability is unrevealed: what its Random Battle sets can have. */
  possibleAbilities?: string[];
  /** Foe only: it used Transform (or Imposter), so species, stats and moves are copies. */
  transformed?: boolean;
  /** Foe only: Speed from public info (base stat, level, Random Battle spreads). */
  speed?: SpeedEstimate;
}

export interface SpeedEstimate {
  /** Before items, abilities and other modifiers. */
  min: number;
  max: number;
  /** After the modifiers listed in `modifiers`, if any are known. */
  modifiedMin?: number;
  modifiedMax?: number;
  /** Known modifiers, e.g. "Transformed", "+1", "Paralysis", "Choice Scarf", "Tailwind". */
  modifiers: string[];
}

export interface MoveOption {
  /** 1-based, as used in `move N`. */
  slot: number;
  id: string;
  name: string;
  type: string;
  category: 'Physical' | 'Special' | 'Status';
  basePower: number;
  accuracy: number | true;
  pp: number;
  maxpp: number;
  disabled: boolean;
  /** Move priority (0 for most moves). */
  priority: number;
  /** What the move does, from the sim's text data. */
  desc: string;
  /** Showdown-style flag notes, e.g. "Contact", "Sound", "Not blocked by Protect". */
  flags: string[];
  /**
   * Type effectiveness against the foe's active Pokémon from its known types
   * (0, 0.25, 0.5, 1, 2, 4). Abilities aren't considered. Absent for status moves.
   */
  effectiveness?: number;
}

export interface SwitchOption {
  /** 1-based, as used in `switch N` (the sim's current position order). */
  slot: number;
  teamIndex: number;
}

export type Prompt =
  | {
      kind: 'move';
      moves: MoveOption[];
      /** Tera type if Terastallizing is available this turn. */
      canTera?: string;
      switches: SwitchOption[];
      trapped: boolean;
    }
  | {kind: 'switch'; switches: SwitchOption[]; reviving: boolean};

export interface BattleResult {
  winner: 'player' | 'ai' | 'tie';
  turns: number;
  /** In original team order. */
  myFainted: boolean[];
  aiRemaining: number;
  forfeited: boolean;
  /** The AI's full team, revealed at the end. */
  aiTeam: string[];
  /** Per aiTeam entry: whether the player saw it during the battle. */
  aiSeen: boolean[];
}

/** A weather, terrain, field effect, side condition or volatile, as the player can know it. */
export interface ConditionView {
  /** Showdown id: 'raindance' → 'rain' for weather, 'stealthrock', 'trickroom', 'leechseed', ... */
  id: string;
  name: string;
  /** Spikes and Toxic Spikes layers. */
  layers?: number;
  /**
   * Turns left counting this one, from public info: min and max differ when
   * an unseen item (Light Clay, Damp Rock, ...) could extend it. Absent when
   * it lasts until removed.
   */
  turns?: {min: number; max: number};
}

export interface SideView {
  active: PokemonView | null;
  /** Player: full team in original order. Foe: only revealed Pokémon. */
  team: PokemonView[];
  totalPokemon: number;
  conditions: ConditionView[];
}

export interface BattleView {
  turn: number;
  me: SideView;
  foe: SideView;
  field: {weather?: ConditionView; terrain?: ConditionView; pseudoWeather: ConditionView[]};
  /** What the player must answer now, or null while waiting / after the end. */
  prompt: Prompt | null;
  result: BattleResult | null;
}
