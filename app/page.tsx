'use client';

import {useEffect, useState} from 'react';
import type {PuzzleFile} from '@/engine/puzzle';
import {BattleScreen} from '@/ui/BattleScreen';
import {useBattle} from '@/ui/useBattle';

function localDateKey(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export default function Home() {
  const [date] = useState(localDateKey);
  const [puzzle, setPuzzle] = useState<PuzzleFile | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const battle = useBattle();

  useEffect(() => {
    fetch(`/puzzles/${date}.json`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(`No puzzle for ${date}.`))))
      .then(setPuzzle)
      .catch(e => setLoadError(String(e.message ?? e)));
  }, [date]);

  if (battle.error) {
    return (
      <main>
        <h1>Showdol</h1>
        <section className="card">
          <p><strong>Something went wrong in the battle engine.</strong></p>
          <pre className="small">{battle.error}</pre>
        </section>
      </main>
    );
  }

  if (battle.view && puzzle) {
    return (
      <main className="battle-main">
        <BattleScreen
          view={battle.view}
          log={battle.log}
          pending={battle.pending}
          notice={battle.notice}
          onChoose={battle.choose}
          onForfeit={battle.forfeit}
          onPlayAgain={() => battle.start(puzzle)}
        />
      </main>
    );
  }

  return (
    <main>
      <h1>Showdol</h1>
      <p className="muted">Daily Random Battle · {date}</p>
      <section className="card">
        <h2 className="card-title">Your team</h2>
        {puzzle ? (
          <ol className="team-list">
            {puzzle.playerSpecies.map(s => <li key={s}>{s}</li>)}
          </ol>
        ) : (
          <p className="muted">{loadError ?? 'Loading…'}</p>
        )}
        <p className="muted small">The opponent&apos;s team stays hidden until each Pokémon appears.</p>
        <button className="primary wide" disabled={!puzzle || battle.pending} onClick={() => puzzle && battle.start(puzzle)}>
          {battle.pending ? 'Loading battle…' : 'Play'}
        </button>
      </section>
    </main>
  );
}
