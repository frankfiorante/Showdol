import type {BattleView} from '@/engine/view';

/** Messages between the UI thread and the battle worker. */
export type ToWorker =
  | {type: 'start'; playerTeam: string; aiTeam: string; battleSeed: string; aiSeed: string}
  | {type: 'choose'; choice: string}
  | {type: 'forfeit'};

export type FromWorker =
  | {type: 'step'; view: BattleView; log: string[]; inputLog: string[]}
  /** The sim refused a choice; the battle is unchanged. */
  | {type: 'invalid'; message: string}
  | {type: 'error'; message: string};
