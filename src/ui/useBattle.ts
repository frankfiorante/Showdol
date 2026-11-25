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
  error: string | null;
}

/** A fresh sim seed from the browser's CSPRNG. */
function randomSeed() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return `sodium,${Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')}`;
}

/** Owns the battle worker. The sim only loads when `start` is first called. */
export function useBattle() {
  const workerRef = useRef<Worker | null>(null);
  const [state, setState] = useState<BattleState>({
    view: null,
    log: [],
    pending: false,
    notice: null,
    error: null,
  });

  useEffect(() => () => workerRef.current?.terminate(), []);

  const send = useCallback((msg: ToWorker) => {
    let w = workerRef.current;
    if (!w) {
      w = new Worker(new URL('../worker/battle.worker.ts', import.meta.url), {type: 'module'});
      w.onmessage = (e: MessageEvent<FromWorker>) => {
        const data = e.data;
        setState(s => {
          switch (data.type) {
            case 'step':
              return {...s, view: data.view, log: [...s.log, ...data.log], pending: false, notice: null};
            case 'invalid':
              return {...s, pending: false, notice: data.message};
            case 'error':
              return {...s, pending: false, error: data.message};
          }
        });
      };
      w.onerror = e => setState(s => ({...s, pending: false, error: e.message || 'The battle engine failed to load.'}));
      workerRef.current = w;
    }
    setState(s => ({...s, pending: true, notice: null}));
    w.postMessage(msg);
  }, []);

  const start = useCallback(
    (puzzle: PuzzleFile) => {
      setState({view: null, log: [], pending: true, notice: null, error: null});
      // Phase 2 stores these seeds with the day's record for resume.
      send({type: 'start', playerTeam: puzzle.player, aiTeam: puzzle.ai, battleSeed: randomSeed(), aiSeed: randomSeed()});
    },
    [send],
  );
  const choose = useCallback((choice: string) => send({type: 'choose', choice}), [send]);
  const forfeit = useCallback(() => send({type: 'forfeit'}), [send]);

  return {...state, start, choose, forfeit};
}
