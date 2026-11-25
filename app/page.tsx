'use client';

import {useCallback, useEffect, useState} from 'react';
import type {PuzzleFile} from '@/engine/puzzle';
import type {BattleView} from '@/engine/view';
import {dateKey, formatCountdown, msUntilMidnight, puzzleNumber} from '@/game/daily';
import {expireAbandoned, homeState, type HomeState} from '@/game/lock';
import {finishRecord, loadSave, writeSave, type GameRecord, type SaveData} from '@/game/storage';
import {BattleScreen, ResultSummary} from '@/ui/BattleScreen';
import {randomSeed, useBattle} from '@/ui/useBattle';

/** Updates every second so the countdown runs and midnight is noticed. */
function useNow() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

/** Fetches a date's puzzle file, cached per date. */
function usePuzzle(date: string | null) {
  const [cache, setCache] = useState<Record<string, PuzzleFile | Error>>({});
  useEffect(() => {
    if (!date || cache[date]) return;
    fetch(`/puzzles/${date}.json`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(`No puzzle file for ${date}.`))))
      .then((p: PuzzleFile) => setCache(c => ({...c, [date]: p})))
      .catch((e: Error) => setCache(c => ({...c, [date]: e})));
  }, [date, cache]);
  return date ? cache[date] : undefined;
}

export default function Home() {
  const now = useNow();
  const [save, setSave] = useState<SaveData | null>(null);
  /** Date of the game open in the battle screen, if any. */
  const [openDate, setOpenDate] = useState<string | null>(null);
  const [storageOk, setStorageOk] = useState(true);
  const today = now ? dateKey(now) : null;

  const commit = useCallback((next: SaveData) => {
    setSave(next);
    setStorageOk(writeSave(next));
  }, []);

  // Load once, then expire abandoned games whenever the day changes (not mid-battle).
  useEffect(() => {
    if (!today || openDate) return;
    const current = save ?? loadSave();
    const expired = expireAbandoned(current, today, new Date());
    if (expired) commit(expired);
    else if (!save) setSave(current);
  }, [today, openDate, save, commit]);

  const onStep = useCallback(
    (view: BattleView, inputLog: string[]) => {
      if (!openDate) return;
      // Re-read storage so another tab's writes to other dates aren't lost.
      const latest = loadSave();
      const rec = latest.games[openDate] ?? save?.games[openDate];
      if (!rec) return;
      const updated: GameRecord = view.result ? finishRecord(rec, view.result, inputLog, new Date())
        : {...rec, inputLog, turns: view.turn};
      commit({...latest, games: {...latest.games, [openDate]: updated}});
    },
    [openDate, save, commit],
  );
  const battle = useBattle(onStep);

  const home: HomeState | null = save && today ? homeState(save, today) : null;
  const puzzleDate = openDate ?? (home && home.kind !== 'before-launch' ? home.date : null);
  const puzzle = usePuzzle(puzzleDate);

  function play(p: PuzzleFile, date: string) {
    const latest = loadSave();
    if (latest.games[date]) {
      // Started in another tab meanwhile; show whatever state that left.
      setSave(latest);
      return;
    }
    const rec: GameRecord = {
      puzzleNumber: puzzleNumber(date)!,
      status: 'in_progress',
      battleSeed: randomSeed(),
      aiSeed: randomSeed(),
      inputLog: [],
      startedAt: new Date().toISOString(),
    };
    // The day counts from here, before the engine even loads.
    commit({...latest, games: {...latest.games, [date]: rec}});
    setOpenDate(date);
    battle.start({puzzle: p, battleSeed: rec.battleSeed, aiSeed: rec.aiSeed});
  }

  function resume(p: PuzzleFile, date: string, rec: GameRecord) {
    setOpenDate(date);
    battle.start({puzzle: p, battleSeed: rec.battleSeed, aiSeed: rec.aiSeed, inputLog: rec.inputLog});
  }

  function closeBattle() {
    battle.reset();
    setOpenDate(null);
  }

  function giveUpBrokenGame() {
    if (!openDate) return;
    const latest = loadSave();
    const rec = latest.games[openDate];
    if (rec) {
      const lost: GameRecord = {...rec, status: 'lost', abandoned: true, finishedAt: new Date().toISOString()};
      commit({...latest, games: {...latest.games, [openDate]: lost}});
    }
    closeBattle();
  }

  if (!now || !save || !home) {
    return <main><h1>Showdol</h1><p className="muted">Loading…</p></main>;
  }

  if (battle.error) {
    return (
      <main>
        <h1>Showdol</h1>
        <section className="card">
          {battle.error.replayFailed ? (
            <>
              <p><strong>This saved game can&apos;t be restored.</strong></p>
              <p className="muted small">The game engine may have changed since it was started. It can be recorded as a loss.</p>
              <button className="primary" onClick={giveUpBrokenGame}>Record as a loss</button>
            </>
          ) : (
            <>
              <p><strong>Something went wrong in the battle engine.</strong></p>
              <button onClick={closeBattle}>Back</button>
            </>
          )}
          <pre className="small" style={{marginTop: 12}}>{battle.error.message}</pre>
        </section>
      </main>
    );
  }

  if (openDate && battle.view) {
    return (
      <main className="battle-main">
        <BattleScreen
          puzzleNumber={save.games[openDate]?.puzzleNumber ?? puzzleNumber(openDate)!}
          view={battle.view}
          log={battle.log}
          pending={battle.pending}
          notice={battle.notice}
          onChoose={battle.choose}
          onForfeit={battle.forfeit}
          onDone={closeBattle}
        />
      </main>
    );
  }

  const loadedPuzzle = puzzle instanceof Error ? null : puzzle;
  const countdown = formatCountdown(msUntilMidnight(now));

  return (
    <main>
      <h1>Showdol</h1>
      {!storageOk && (
        <p className="notice small">This browser isn&apos;t saving progress (private mode or storage blocked).</p>
      )}
      <HomeCard home={home} puzzle={loadedPuzzle} puzzleError={puzzle instanceof Error ? puzzle.message : null}
        loading={!!openDate || battle.pending} countdown={countdown}
        onPlay={(p, d) => play(p, d)} onResume={(p, d, r) => resume(p, d, r)} />
    </main>
  );
}

function HomeCard({home, puzzle, puzzleError, loading, countdown, onPlay, onResume}: {
  home: HomeState;
  puzzle: PuzzleFile | null | undefined;
  puzzleError: string | null;
  loading: boolean;
  countdown: string;
  onPlay: (p: PuzzleFile, date: string) => void;
  onResume: (p: PuzzleFile, date: string, rec: GameRecord) => void;
}) {
  if (home.kind === 'before-launch') {
    return <section className="card"><p>Showdol hasn&apos;t launched yet. Check back soon.</p></section>;
  }

  if (home.kind === 'done') {
    const r = home.record;
    const won = r.status === 'won';
    return (
      <>
        <p className="muted">Puzzle #{r.puzzleNumber} · {home.date}</p>
        <section className="card result">
          <h2>{won ? 'You won!' : r.abandoned ? 'Not finished (loss)' : 'You lost'}</h2>
          <ResultSummary won={won} {...r} />
          <p className="countdown">Next puzzle in <strong>{countdown}</strong></p>
        </section>
      </>
    );
  }

  const number = home.kind === 'play' ? home.puzzleNumber : home.record.puzzleNumber;
  const team = puzzle?.playerSpecies;
  return (
    <>
      <p className="muted">Puzzle #{number} · {home.date}</p>
      <section className="card">
        {home.kind === 'resume' && home.fromYesterday && (
          <p className="notice small">
            Yesterday&apos;s game isn&apos;t finished. Finish it in the next {countdown} or it counts as a loss.
            Today&apos;s puzzle unlocks after.
          </p>
        )}
        <h2 className="card-title">Your team</h2>
        {team ? (
          <ol className="team-list">{team.map(s => <li key={s}>{s}</li>)}</ol>
        ) : (
          <p className="muted">{puzzleError ?? 'Loading…'}</p>
        )}
        <p className="muted small">The opponent&apos;s team stays hidden until each Pokémon appears.</p>
        <button
          className="primary wide"
          disabled={!puzzle || loading}
          onClick={() => {
            if (!puzzle) return;
            if (home.kind === 'resume') onResume(puzzle, home.date, home.record);
            else onPlay(puzzle, home.date);
          }}
        >
          {loading ? 'Loading battle…' : home.kind === 'resume' ? `Resume (turn ${home.record.turns ?? 1})` : 'Play'}
        </button>
        {home.kind === 'play' && <p className="muted small">One game a day. Once you press Play, today counts.</p>}
      </section>
    </>
  );
}
