/** Messages between the UI thread and the battle worker. */
export type ToWorker = {type: 'run'; id: number; p1Team: string; p2Team: string; count: number};

export type FromWorker =
  | {type: 'ready'; bootMs: number}
  | {
      type: 'result';
      id: number;
      battles: {winner: string; turns: number; ms: number}[];
      species: {p1: string[]; p2: string[]};
      tail: string[];
    }
  | {type: 'error'; id?: number; message: string};
