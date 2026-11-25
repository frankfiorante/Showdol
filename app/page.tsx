'use client';

import {useEffect, useRef, useState} from 'react';
import type {PuzzleFile} from '@/engine/puzzle';
import type {FromWorker, ToWorker} from '@/worker/protocol';

function localDateKey(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const speciesOf = (packed: string) =>
  packed.split(']').map(entry => {
    const [name, species] = entry.split('|');
    return species || name;
  });

interface Metrics {
  workerBootMs?: number; // UI thread: new Worker() -> 'ready'
  moduleMs?: number; // worker: time until module body ran
  firstBattleMs?: number;
  avgBattleMs?: number;
  battles: number;
  p1Wins: number;
  avgTurns?: number;
}

export default function SpikePage() {
  const [date] = useState(localDateKey);
  const [puzzle, setPuzzle] = useState<PuzzleFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [metrics, setMetrics] = useState<Metrics>({battles: 0, p1Wins: 0});
  const [tail, setTail] = useState<string[]>([]);
  const workerRef = useRef<Worker | null>(null);
  const readyRef = useRef<Promise<void> | null>(null);
  const nextId = useRef(1);

  useEffect(() => {
    fetch(`/puzzles/${date}.json`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(`No puzzle for ${date} (${r.status})`))))
      .then(setPuzzle)
      .catch(e => setError(String(e.message ?? e)));
    return () => workerRef.current?.terminate();
  }, [date]);

  /** Creates the worker on first use, so the sim never loads until Play. */
  function getWorker(): Promise<Worker> {
    if (!readyRef.current) {
      const t0 = performance.now();
      const w = new Worker(new URL('../src/worker/battle.worker.ts', import.meta.url), {type: 'module'});
      workerRef.current = w;
      readyRef.current = new Promise((resolve, reject) => {
        const onMsg = (e: MessageEvent<FromWorker>) => {
          if (e.data.type !== 'ready') return;
          w.removeEventListener('message', onMsg);
          const bootMs = e.data.bootMs;
          setMetrics(m => ({...m, workerBootMs: performance.now() - t0, moduleMs: bootMs}));
          resolve();
        };
        w.addEventListener('message', onMsg);
        w.addEventListener('error', e => reject(new Error(e.message || 'Worker failed to load')));
      });
    }
    return readyRef.current.then(() => workerRef.current!);
  }

  async function run(count: number) {
    if (!puzzle) return;
    setBusy(true);
    setError(null);
    try {
      const w = await getWorker();
      const id = nextId.current++;
      const result = await new Promise<Extract<FromWorker, {type: 'result'}>>((resolve, reject) => {
        const onMsg = (e: MessageEvent<FromWorker>) => {
          if (!('id' in e.data) || e.data.id !== id) return;
          w.removeEventListener('message', onMsg);
          if (e.data.type === 'result') resolve(e.data);
          else if (e.data.type === 'error') reject(new Error(e.data.message));
        };
        w.addEventListener('message', onMsg);
        const msg: ToWorker = {type: 'run', id, p1Team: puzzle.player, p2Team: puzzle.ai, count};
        w.postMessage(msg);
      });
      setTail(result.tail);
      setMetrics(m => {
        const battles = m.battles + result.battles.length;
        const first = m.firstBattleMs ?? result.battles[0].ms;
        const rest = m.firstBattleMs === undefined ? result.battles.slice(1) : result.battles;
        const prevRestN = m.firstBattleMs === undefined ? 0 : m.battles - 1;
        const restSum = (m.avgBattleMs ?? 0) * prevRestN + rest.reduce((a, b) => a + b.ms, 0);
        const restN = prevRestN + rest.length;
        const turnsSum = (m.avgTurns ?? 0) * m.battles + result.battles.reduce((a, b) => a + b.turns, 0);
        return {
          ...m,
          battles,
          firstBattleMs: first,
          avgBattleMs: restN ? restSum / restN : undefined,
          p1Wins: m.p1Wins + result.battles.filter(b => b.winner === 'p1').length,
          avgTurns: turnsSum / battles,
        };
      });
    } catch (e) {
      setError(String((e as Error).message ?? e));
    } finally {
      setBusy(false);
    }
  }

  const fmt = (n?: number) => (n === undefined ? '–' : `${n.toFixed(0)} ms`);

  return (
    <main>
      <h1>Showdol</h1>
      <p className="muted">Phase 0 spike · {date}</p>

      <section className="card">
        <h2 style={{marginTop: 0, fontSize: 18}}>Today&apos;s matchup</h2>
        {puzzle ? (
          <dl>
            <dt>Player</dt>
            <dd>{speciesOf(puzzle.player).join(', ')}</dd>
            <dt>AI</dt>
            <dd>{speciesOf(puzzle.ai).join(', ')}</dd>
          </dl>
        ) : (
          <p className="muted">{error ?? 'Loading…'}</p>
        )}
      </section>

      <section className="card">
        <div className="row">
          <button className="primary" disabled={!puzzle || busy} onClick={() => run(1)}>
            Run 1 bot battle
          </button>
          <button disabled={!puzzle || busy} onClick={() => run(20)}>
            Run 20
          </button>
        </div>
        <dl style={{marginTop: 16}}>
          <dt>Worker boot (UI)</dt>
          <dd>{fmt(metrics.workerBootMs)}</dd>
          <dt>Worker module eval</dt>
          <dd>{fmt(metrics.moduleMs)}</dd>
          <dt>First battle</dt>
          <dd>{fmt(metrics.firstBattleMs)}</dd>
          <dt>Avg battle after</dt>
          <dd>{fmt(metrics.avgBattleMs)}</dd>
          <dt>Battles · P1 wins</dt>
          <dd>
            {metrics.battles} · {metrics.p1Wins}
          </dd>
          <dt>Avg turns</dt>
          <dd>{metrics.avgTurns?.toFixed(1) ?? '–'}</dd>
        </dl>
        {error && puzzle && <p style={{color: 'crimson'}}>{error}</p>}
      </section>

      {tail.length > 0 && (
        <section className="card">
          <h2 style={{marginTop: 0, fontSize: 18}}>End of last battle</h2>
          <pre>{tail.join('\n')}</pre>
        </section>
      )}
    </main>
  );
}
