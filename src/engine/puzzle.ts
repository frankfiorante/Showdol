/** Shape of a daily puzzle file at /puzzles/YYYY-MM-DD.json. */
export interface PuzzleFile {
  schema: 1;
  date: string;
  format: 'gen9randombattle';
  /** Exact package versions that generated this file. */
  generator: {sim: string; randoms: string};
  /** How many times this date was rerolled by the curation filter. */
  reroll: number;
  /** Team-generation seeds, kept so a file can be reproduced. */
  seeds: {player: string; ai: string};
  /** Player's species in team order, for the home screen (no sim needed). */
  playerSpecies: string[];
  /** Player's full sets in team order, as the sim sees them, for home-screen tooltips. */
  playerSets?: PlayerSetInfo[];
  /**
   * Result of the lopsided-day filter: heuristic AI vs heuristic AI on this
   * matchup, with the player's team as p1.
   */
  curation?: {battles: number; playerWins: number};
  /** Packed teams (Teams.pack format). */
  player: string;
  ai: string;
}

export const FORMAT = 'gen9randombattle';

/** One of the player's Pokémon as it starts the battle (read from the sim at build time). */
export interface PlayerSetInfo {
  species: string;
  level: number;
  types: string[];
  ability: string;
  item?: string;
  teraType: string;
  maxhp: number;
  /** atk, def, spa, spd, spe. */
  stats: Record<string, number>;
  moves: {name: string; type: string; pp: number}[];
}
