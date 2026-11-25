import type {BattleView} from '@/engine/view';

/** Messages between the UI thread and the battle worker. */
export type ToWorker =
  | {type: 'start'; playerTeam: string; aiTeam: string; battleSeed: string; aiSeed: string; inputLog?: string[]}
  | {type: 'choose'; choice: string}
  | {type: 'forfeit'};

export type FromWorker =
  | {type: 'step'; view: BattleView; log: string[]; inputLog: string[]}
  /**
   * The sim refused a choice. The battle is unchanged, but the view may have
   * learned something (e.g. a hidden trapping ability now disables switching).
   */
  | {type: 'invalid'; message: string; view: BattleView | null}
  /** `replayFailed`: a saved game could not be restored. */
  | {type: 'error'; message: string; replayFailed?: boolean};
