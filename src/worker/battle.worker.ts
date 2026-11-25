/// <reference lib="webworker" />
import {runBotBattle} from '../engine/run-battle';
import type {FromWorker, ToWorker} from './protocol';

// performance.now() is relative to the worker's creation, so at this point it
// covers fetching, parsing and evaluating the whole sim bundle.
const bootMs = performance.now();
const post = (msg: FromWorker) => self.postMessage(msg);

self.onmessage = (e: MessageEvent<ToWorker>) => {
  const msg = e.data;
  if (msg.type !== 'run') return;
  try {
    const results = Array.from({length: msg.count}, () =>
      runBotBattle({p1Team: msg.p1Team, p2Team: msg.p2Team}),
    );
    const last = results[results.length - 1];
    post({
      type: 'result',
      id: msg.id,
      battles: results.map(r => ({winner: r.winner, turns: r.turns, ms: r.ms})),
      species: last.species,
      tail: last.log.filter(l => l && !l.startsWith('|t:|') && !l.startsWith('|split|')).slice(-25),
    });
  } catch (err) {
    post({type: 'error', id: msg.id, message: String((err as Error)?.stack ?? err)});
  }
};

post({type: 'ready', bootMs});
