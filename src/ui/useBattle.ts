'use client';

import {useCallback, useEffect, useRef, useState} from 'react';
import type {PuzzleFile} from '@/engine/puzzle';
import type {BattleView} from '@/engine/view';
import type {FromWorker, ToWorker} from '@/worker/protocol';

export interface BattleState {
  view: BattleView | null;
  log: string[];
  /** True while the worker is computing (starting, or resolving a choice). */
  pending: boolean;
  /** Last refused choice, shown briefly. */
  notice: string | null;
  error: {message: string; replayFailed: boolean} | null;
}

export interface StartArgs {
  puzzle: PuzzleFile;
  battleSeed: string;
  aiSeed: string;
  /** Saved choices to replay (resume). */
  inputLog?: string[];
}

const IDLE: BattleState = {view: null, log: [], pending: false, notice: null, error: null};

/** A fresh sim seed from the browser's CSPRNG. */
export function randomSeed() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return `sodium,${Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Owns the battle worker. The sim only loads when `start` is first called.
 * `onStep` fires after every step with the input log, so the caller can save it.
 */
export function useBattle(onStep: (view: BattleView, inputLog: string[]) => void) {
  const workerRef = useRef<Worker | null>(null);
  const onStepRef = useRef(onStep);
  onStepRef.current = onStep;
  const [state, setState] = useState<BattleState>(IDLE);

  useEffect(() => () => workerRef.current?.terminate(), []);

  const send = useCallback((msg: ToWorker) => {
    let w = workerRef.current;
    if (!w) {
      w = new Worker(new URL('../worker/battle.worker.ts', import.meta.url), {type: 'module'});
      w.onmessage = (e: MessageEvent<FromWorker>) => {
        const data = e.data;
        if (data.type === 'step') onStepRef.current(data.view, data.inputLog);
        setState(s => {
          switch (data.type) {
            case 'step':
              return {...s, view: data.view, log: [...s.log, ...data.log], pending: false, notice: null};
            case 'invalid':
              return {...s, view: data.view ?? s.view, pending: false, notice: data.message};
            case 'error':
              return {...s, pending: false, error: {message: data.message, replayFailed: !!data.replayFailed}};
          }
        });
      };
      w.onerror = e =>
        setState(s => ({...s, pending: false, error: {message: e.message || 'The battle engine failed to load.', replayFailed: false}}));
      workerRef.current = w;
    }
    setState(s => ({...s, pending: true, notice: null}));
    w.postMessage(msg);
  }, []);

  const start = useCallback(
    ({puzzle, battleSeed, aiSeed, inputLog}: StartArgs) => {
      setState({...IDLE, pending: true});
      send({type: 'start', playerTeam: puzzle.player, aiTeam: puzzle.ai, battleSeed, aiSeed, inputLog});
    },
    [send],
  );
  const choose = useCallback((choice: string) => send({type: 'choose', choice}), [send]);
  const forfeit = useCallback(() => send({type: 'forfeit'}), [send]);
  const reset = useCallback(() => setState(IDLE), []);

  return {...state, start, choose, forfeit, reset};
}
