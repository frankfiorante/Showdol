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
  /** Volatile conditions worth showing (confusion, substitute, ...). */
  volatiles: string[];
  item?: string;
  ability?: string;
  /** Known move names (all for the player, revealed ones for the foe). */
  moves: string[];
  teraType?: string;
  terastallized?: string;
  stats?: Record<string, number>;
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
}

export interface SideView {
  active: PokemonView | null;
  /** Player: full team in original order. Foe: only revealed Pokémon. */
  team: PokemonView[];
  totalPokemon: number;
  conditions: string[];
}

export interface BattleView {
  turn: number;
  me: SideView;
  foe: SideView;
  field: {weather?: string; terrain?: string; pseudoWeather: string[]};
  /** What the player must answer now, or null while waiting / after the end. */
  prompt: Prompt | null;
  result: BattleResult | null;
}
