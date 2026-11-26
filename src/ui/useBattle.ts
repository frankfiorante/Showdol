'use client';

import {useCallback, useEffect, useRef, useState} from 'react';
import type {TeamSeeds} from '@/engine/practice-teams';
import type {BattleView} from '@/engine/view';
import type {FromWorker, ToWorker} from '@/worker/protocol';

export interface BattleState {
  view: BattleView | null;
  log: string[];
  /** Lines added by the most recent step (what just happened). */
  latest: string[];
  /** True while the worker is computing (starting, or resolving a choice). */
  pending: boolean;
  /** Last refused choice, shown briefly. */
  notice: string | null;
  error: {message: string; replayFailed: boolean} | null;
}

/** Packed teams. A puzzle file has these fields. */
export interface PackedTeams {
  player: string;
  ai: string;
}

export interface StartArgs {
  teams: PackedTeams;
  battleSeed: string;
  aiSeed: string;
  /** Saved choices to replay (resume). */
  inputLog?: string[];
}

const IDLE: BattleState = {view: null, log: [], latest: [], pending: false, notice: null, error: null};

const isTurnHeader = (line: string) => /^== Turn \d+ ==$/.test(line);

/** The lines of the last completed turn (from the second-to-last turn header on). */
function lastTurn(log: string[]): string[] {
  const headers = log.flatMap((line, i) => (isTurnHeader(line) ? [i] : []));
  return log.slice(headers.length >= 2 ? headers[headers.length - 2] : 0);
}

/** A fresh sim seed from the browser's CSPRNG. */
export function randomSeed() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return `sodium,${Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Owns the battle worker. The sim only loads when `start` or `generateTeams` is first called.
 * `onStep` fires after every step with the input log, so the caller can save it.
 */
export function useBattle(onStep: (view: BattleView, inputLog: string[]) => void) {
  const workerRef = useRef<Worker | null>(null);
  const onStepRef = useRef(onStep);
  onStepRef.current = onStep;
  const [state, setState] = useState<BattleState>(IDLE);
  /** The caller waiting on `generateTeams`, if any. */
  const teamsRef = useRef<{resolve: (t: PackedTeams) => void; reject: (e: Error) => void} | null>(null);

  useEffect(() => () => workerRef.current?.terminate(), []);

  const send = useCallback((msg: ToWorker) => {
    let w = workerRef.current;
    if (!w) {
      w = new Worker(new URL('../worker/battle.worker.ts', import.meta.url), {type: 'module'});
      w.onmessage = (e: MessageEvent<FromWorker>) => {
        const data = e.data;
        if (data.type === 'teams' || (data.type === 'error' && teamsRef.current)) {
          const waiting = teamsRef.current;
          teamsRef.current = null;
          if (data.type === 'teams') waiting?.resolve({player: data.player, ai: data.ai});
          else waiting?.reject(new Error(data.message));
        }
        if (data.type === 'step') onStepRef.current(data.view, data.inputLog);
        setState(s => {
          switch (data.type) {
            case 'teams':
              return {...s, pending: false};
            case 'step':
              // A resumed game's first step carries the whole log; show only its last turn.
              const latest = s.log.length ? data.log : lastTurn(data.log);
              return {...s, view: data.view, log: [...s.log, ...data.log], latest, pending: false, notice: null};
            case 'invalid':
              return {...s, view: data.view ?? s.view, pending: false, notice: data.message};
            case 'error':
              return {...s, pending: false, error: {message: data.message, replayFailed: !!data.replayFailed}};
          }
        });
      };
      w.onerror = e => {
        const message = e.message || 'The battle engine failed to load.';
        teamsRef.current?.reject(new Error(message));
        teamsRef.current = null;
        setState(s => ({...s, pending: false, error: {message, replayFailed: false}}));
      };
      workerRef.current = w;
    }
    setState(s => ({...s, pending: true, notice: null}));
    w.postMessage(msg);
  }, []);

  const start = useCallback(
    ({teams, battleSeed, aiSeed, inputLog}: StartArgs) => {
      setState({...IDLE, pending: true});
      send({type: 'start', playerTeam: teams.player, aiTeam: teams.ai, battleSeed, aiSeed, inputLog});
    },
    [send],
  );
  /** Random teams for practice, made in the worker (which loads the sim and generator if needed). */
  const generateTeams = useCallback(
    (seeds: TeamSeeds) =>
      new Promise<PackedTeams>((resolve, reject) => {
        teamsRef.current = {resolve, reject};
        setState({...IDLE, pending: true});
        send({type: 'generate', seeds});
      }),
    [send],
  );
  const choose = useCallback((choice: string) => send({type: 'choose', choice}), [send]);
  const forfeit = useCallback(() => send({type: 'forfeit'}), [send]);
  const reset = useCallback(() => setState(IDLE), []);

  return {...state, start, generateTeams, choose, forfeit, reset};
}
