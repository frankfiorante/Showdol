'use client';

import Link from 'next/link';
import {shareText} from '@/game/share';
import {Footer, Nav} from '@/ui/Nav';
import {ShareButton} from '@/ui/ShareButton';
import {useCallback, useEffect, useState} from 'react';
import type {PuzzleFile} from '@/engine/puzzle';
import type {BattleView} from '@/engine/view';
import {formatPar} from '@/game/par';
import {dateKey, formatCountdown, msUntilMidnight, puzzleNumber} from '@/game/daily';
import {expireAbandoned, homeState, type HomeState} from '@/game/lock';
import {finishRecord, loadSave, newerSaveStored, writeSave, type GameRecord, type SaveData, type SaveWrite} from '@/game/storage';
import {BattleScreen, ResultSummary} from '@/ui/BattleScreen';
import {Sprite} from '@/ui/Sprite';
import {viewFromSet, WithPokemonTip} from '@/ui/PokemonTip';
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
  const [storage, setStorage] = useState<SaveWrite>('ok');
  const today = now ? dateKey(now) : null;

  const commit = useCallback((next: SaveData) => {
    setSave(next);
    setStorage(writeSave(next));
  }, []);

  // Load once, then expire abandoned games whenever the day changes (not mid-battle).
  useEffect(() => {
    if (!today || openDate) return;
    if (!save && newerSaveStored()) setStorage('newer');
    const current = save ?? loadSave();
    const expired = expireAbandoned(current, today, new Date());
    if (expired) commit(expired);
    else if (!save) setSave(current);
  }, [today, openDate, save, commit]);

  const home: HomeState | null = save && today ? homeState(save, today) : null;
  const puzzleDate = openDate ?? (home && home.kind !== 'before-launch' ? home.date : null);
  const puzzle = usePuzzle(puzzleDate);
  const loadedPuzzle = puzzle instanceof Error ? null : puzzle;
  /** Par for a date, if its puzzle file is the one loaded. */
  const parFor = (date: string) => (loadedPuzzle?.date === date ? loadedPuzzle.par : undefined);

  const onStep = useCallback(
    (view: BattleView, inputLog: string[]) => {
      if (!openDate) return;
      // Re-read storage so another tab's writes to other dates aren't lost.
      const latest = loadSave();
      const rec = latest.games[openDate] ?? save?.games[openDate];
      if (!rec) return;
      // Games started before par existed pick it up when they finish.
      const par = rec.par ?? (loadedPuzzle?.date === openDate ? loadedPuzzle.par : undefined);
      const updated: GameRecord = view.result ? finishRecord({...rec, ...(par && {par})}, view.result, inputLog, new Date())
        : {...rec, inputLog, turns: view.turn};
      commit({...latest, games: {...latest.games, [openDate]: updated}});
    },
    [openDate, save, commit, loadedPuzzle],
  );
  const battle = useBattle(onStep);

  // A game finished before par existed gets it once the day's puzzle file is loaded, so it counts in stats.
  const doneDate = home?.kind === 'done' && !home.record.par ? home.date : null;
  useEffect(() => {
    if (!doneDate || loadedPuzzle?.date !== doneDate || !loadedPuzzle.par) return;
    const latest = loadSave();
    const rec = latest.games[doneDate];
    if (rec && !rec.par) commit({...latest, games: {...latest.games, [doneDate]: {...rec, par: loadedPuzzle.par}}});
  }, [doneDate, loadedPuzzle, commit]);

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
      ...(p.par && {par: p.par}),
      startedAt: new Date().toISOString(),
    };
    // The day counts from here, before the engine even loads.
    commit({...latest, games: {...latest.games, [date]: rec}});
    setOpenDate(date);
    battle.start({teams: p, battleSeed: rec.battleSeed, aiSeed: rec.aiSeed});
  }

  function resume(p: PuzzleFile, date: string, rec: GameRecord) {
    setOpenDate(date);
    battle.start({teams: p, battleSeed: rec.battleSeed, aiSeed: rec.aiSeed, inputLog: rec.inputLog});
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
    return <main><Nav /><p className="muted">Loading…</p></main>;
  }

  if (battle.error) {
    return (
      <main>
        <Nav />
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
          par={save.games[openDate]?.par ?? parFor(openDate)}
          view={battle.view}
          log={battle.log}
          latest={battle.latest}
          logExpanded={save.settings.logExpanded}
          onToggleLog={() => {
            const latest = loadSave();
            commit({...latest, settings: {...latest.settings, logExpanded: !save.settings.logExpanded}});
          }}
          pending={battle.pending}
          notice={battle.notice}
          onChoose={battle.choose}
          onForfeit={battle.forfeit}
          onDone={closeBattle}
        />
      </main>
    );
  }

  const countdown = formatCountdown(msUntilMidnight(now));

  return (
    <main>
      <Nav />
      {storage === 'blocked' && (
        <p className="notice small">This browser isn&apos;t saving progress (private mode or storage blocked).</p>
      )}
      {storage === 'newer' && (
        <p className="notice small">A newer version of Showdol saved your games. Reload the page to see them and keep saving.</p>
      )}
      <HomeCard home={home} puzzle={loadedPuzzle} puzzleError={puzzle instanceof Error ? puzzle.message : null}
        loading={!!openDate || battle.pending} countdown={countdown} firstTime={!Object.keys(save.games).length}
        onPlay={(p, d) => play(p, d)} onResume={(p, d, r) => resume(p, d, r)} />
      <Footer />
    </main>
  );
}

function HomeCard({home, puzzle, puzzleError, loading, countdown, firstTime, onPlay, onResume}: {
  home: HomeState;
  firstTime: boolean;
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
    const r = {...home.record, par: home.record.par ?? (puzzle?.date === home.date ? puzzle.par : undefined)};
    const won = r.status === 'won';
    return (
      <>
        <p className="muted">Puzzle #{r.puzzleNumber} · {home.date}</p>
        <section className="card result">
          <h2>{won ? 'You won!' : r.abandoned ? 'Not finished (loss)' : 'You lost'}</h2>
          <ResultSummary won={won} {...r} />
          <ShareButton text={shareText({...r, won}, window.location.host)} />
          <p className="countdown">Next puzzle in <strong>{countdown}</strong></p>
          <p className="small"><Link href="/stats">See your stats</Link></p>
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
          <ol className="team-grid">
            {team.map((s, i) => {
              const set = puzzle?.playerSets?.[i];
              const member = (
                <>
                  <Sprite species={s} size={72} />
                  <span className="small">{s}</span>
                </>
              );
              return (
                <li key={s}>
                  {set ? (
                    <WithPokemonTip p={viewFromSet(set, i)} tapToggle tabIndex={0} role="button"
                      aria-label={`Details: ${s}`} className="team-member">
                      {member}
                    </WithPokemonTip>
                  ) : member}
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="muted">{puzzleError ?? 'Loading…'}</p>
        )}
        <p className="muted small">
          {puzzle?.playerSets && 'Tap or hover a Pokémon to see its set. '}
          The opponent&apos;s team stays hidden until each Pokémon appears.
        </p>
        {puzzle?.par && (
          <p className="par-line">
            <strong>Par: {formatPar(puzzle.par)}</strong>
            <span className="muted small"> · the AI&apos;s typical win with this team. Finish with more Pokémon
              remaining, or as many in fewer turns, to beat it.</span>
          </p>
        )}
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
        {home.kind === 'play' && firstTime && (
          <p className="small">New here? <Link href="/how-to-play">How to play</Link></p>
        )}
      </section>
    </>
  );
}
