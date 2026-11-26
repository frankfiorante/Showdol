'use client';

import {useCallback, useEffect, useRef, useState} from 'react';
import type {BattleView} from '@/engine/view';
import {loadPractice, stepPractice, writePractice, type PracticeRecord} from '@/game/practice';
import {loadSave, writeSave, type Settings} from '@/game/storage';
import {BattleScreen, ResultSummary} from '@/ui/BattleScreen';
import {Footer, Nav} from '@/ui/Nav';
import {randomSeed, useBattle} from '@/ui/useBattle';

const HEADLINE = {player: 'You won!', ai: 'You lost', tie: 'Tie'} as const;

/**
 * Practice: random teams on both sides, made in the browser for every game.
 * One game is saved at a time (src/game/practice.ts), apart from the daily save.
 */
export function Practice() {
  /** undefined while loading; null when there's no saved practice game. */
  const [rec, setRec] = useState<PracticeRecord | null | undefined>(undefined);
  /** Mirrors `rec` synchronously, so a step that lands right after a new game saves to it. */
  const recRef = useRef<PracticeRecord | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  /** The battle screen (or its loading state) is showing. */
  const [open, setOpen] = useState(false);
  const [storageOk, setStorageOk] = useState(true);

  useEffect(() => {
    const saved = loadPractice();
    recRef.current = saved;
    setRec(saved);
    setSettings(loadSave().settings);
  }, []);

  const commit = useCallback((next: PracticeRecord) => {
    recRef.current = next;
    setRec(next);
    setStorageOk(writePractice(next));
  }, []);

  const onStep = useCallback(
    (view: BattleView, inputLog: string[]) => {
      const cur = recRef.current;
      if (cur?.status === 'in_progress') commit(stepPractice(cur, view.result, view.turn, inputLog, new Date()));
    },
    [commit],
  );
  const battle = useBattle(onStep);

  async function newGame() {
    setOpen(true);
    const teamSeeds = {player: randomSeed(), ai: randomSeed()};
    let teams;
    try {
      teams = await battle.generateTeams(teamSeeds);
    } catch {
      return; // battle.error has the message
    }
    // The previous practice game is only replaced once the new one exists.
    const next: PracticeRecord = {
      status: 'in_progress',
      teamSeeds,
      playerTeam: teams.player,
      aiTeam: teams.ai,
      battleSeed: randomSeed(),
      aiSeed: randomSeed(),
      inputLog: [],
      startedAt: new Date().toISOString(),
    };
    commit(next);
    battle.start({teams, battleSeed: next.battleSeed, aiSeed: next.aiSeed});
  }

  function resume(r: PracticeRecord) {
    setOpen(true);
    battle.start({teams: {player: r.playerTeam, ai: r.aiTeam}, battleSeed: r.battleSeed, aiSeed: r.aiSeed, inputLog: r.inputLog});
  }

  function close() {
    battle.reset();
    setOpen(false);
  }

  if (rec === undefined || !settings) {
    return <main><Nav /><p className="muted">Loading…</p></main>;
  }

  if (battle.error) {
    return (
      <main>
        <Nav />
        <section className="card">
          {battle.error.replayFailed ? (
            <>
              <p><strong>This practice game can&apos;t be restored.</strong></p>
              <p className="muted small">The game engine may have changed since it was started.</p>
              <div className="row">
                <button className="primary" onClick={newGame}>Start a new game</button>
                <button onClick={close}>Back</button>
              </div>
            </>
          ) : (
            <>
              <p><strong>Something went wrong in the battle engine.</strong></p>
              <button onClick={close}>Back</button>
            </>
          )}
          <pre className="small" style={{marginTop: 12}}>{battle.error.message}</pre>
        </section>
      </main>
    );
  }

  if (open && battle.view) {
    return (
      <main className="battle-main">
        <BattleScreen
          view={battle.view}
          log={battle.log}
          latest={battle.latest}
          logExpanded={settings.logExpanded}
          onToggleLog={() => {
            // Settings live in the daily save, shared with the home page.
            const latest = loadSave();
            const next = {...latest.settings, logExpanded: !settings.logExpanded};
            writeSave({...latest, settings: next});
            setSettings(next);
          }}
          pending={battle.pending}
          notice={battle.notice}
          onChoose={battle.choose}
          onForfeit={battle.forfeit}
          onDone={close}
          onNewGame={newGame}
        />
      </main>
    );
  }

  const loading = open || battle.pending;
  const result = rec?.status === 'finished' ? rec.result : undefined;
  return (
    <main>
      <Nav />
      <h1 className="page-title">Practice</h1>
      {!storageOk && (
        <p className="notice small">This browser isn&apos;t saving progress (private mode or storage blocked).</p>
      )}
      <section className="card">
        <p>
          Random teams on both sides, new every game. Practice games don&apos;t count toward your stats or streaks,
          and you can play as many as you like.
        </p>
        {rec?.status === 'in_progress' ? (
          <>
            <button className="primary wide" disabled={loading} onClick={() => resume(rec)}>
              {loading ? 'Loading battle…' : `Resume (turn ${rec.turns ?? 1})`}
            </button>
            <p className="muted small">
              Only one practice game is saved. <button className="link" disabled={loading} onClick={newGame}>Start a new
              one</button> to replace it.
            </p>
          </>
        ) : (
          <button className="primary wide" disabled={loading} onClick={newGame}>
            {loading ? 'Loading battle…' : result ? 'New game' : 'Play'}
          </button>
        )}
      </section>
      {result && (
        <section className="card result">
          <p className="muted small">Last practice game</p>
          <h2>{HEADLINE[result.winner]}</h2>
          <ResultSummary won={result.winner === 'player'} {...result} aiSeen={undefined} />
        </section>
      )}
      <Footer />
    </main>
  );
}
