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
  /** Packed teams (Teams.pack format). */
  player: string;
  ai: string;
}

export const FORMAT = 'gen9randombattle';
