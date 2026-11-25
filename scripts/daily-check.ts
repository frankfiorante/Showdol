/**
 * Unit checks for dates, puzzle numbers, the save format and the daily lock.
 * Run with a DST time zone so the daylight-saving cases are real:
 *
 *   pnpm daily:check        (sets TZ=America/Chicago)
 */
import assert from 'node:assert/strict';
import {addDays, dateKey, daysBetween, formatCountdown, LAUNCH_DATE, msUntilMidnight, puzzleNumber} from '@/game/daily';
import {expireAbandoned, homeState} from '@/game/lock';
import {emptySave, finishRecord, parseSave, type GameRecord, type SaveData} from '@/game/storage';
import {computeStats} from '@/game/stats';
import {shareText} from '@/game/share';
import {decodeSave, encodeSave, mergeSaves, TransferError} from '@/game/transfer';

let passed = 0;
async function test(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    passed++;
  } catch (e) {
    console.error(`FAIL ${name}\n`, e);
    process.exit(1);
  }
}

assert.equal(Intl.DateTimeFormat().resolvedOptions().timeZone, 'America/Chicago', 'run via pnpm daily:check');

await test('dateKey uses the local date', () => {
  assert.equal(dateKey(new Date(2026, 11, 31, 23, 59)), '2026-12-31');
  assert.equal(dateKey(new Date(2027, 0, 1, 0, 0)), '2027-01-01');
  // 03:30 UTC on Mar 1 is still Feb 28 in Chicago.
  assert.equal(dateKey(new Date('2027-03-01T03:30:00Z')), '2027-02-28');
});

await test('addDays / daysBetween across month, year and DST boundaries', () => {
  assert.equal(addDays('2026-11-30', 1), '2026-12-01');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2027-03-14', 1), '2027-03-15'); // US DST starts Mar 14, 2027
  assert.equal(addDays('2027-11-07', -1), '2027-11-06'); // DST ends Nov 7, 2027
  assert.equal(addDays('2028-02-28', 1), '2028-02-29');
  assert.equal(daysBetween('2026-11-24', '2027-11-24'), 365);
  assert.equal(daysBetween('2027-03-13', '2027-03-15'), 2);
});

await test('puzzle numbers', () => {
  assert.equal(puzzleNumber('2026-11-24', '2026-11-24'), 1);
  assert.equal(puzzleNumber('2026-12-05', '2026-11-24'), 12);
  assert.equal(puzzleNumber('2026-11-23', '2026-11-24'), null);
});

await test('msUntilMidnight, including 23- and 25-hour days', () => {
  assert.equal(msUntilMidnight(new Date(2026, 10, 24, 23, 59, 0)), 60_000);
  assert.equal(msUntilMidnight(new Date(2026, 10, 24, 0, 0, 0)), 86_400_000);
  assert.equal(msUntilMidnight(new Date(2027, 2, 14, 0, 0, 0)), 23 * 3_600_000);
  assert.equal(msUntilMidnight(new Date(2027, 10, 7, 0, 0, 0)), 25 * 3_600_000);
  assert.equal(formatCountdown(3_723_400), '01:02:04');
  assert.equal(formatCountdown(-5), '00:00:00');
});

const rec = (over: Partial<GameRecord> = {}): GameRecord => ({
  puzzleNumber: 1, status: 'in_progress', battleSeed: 'sodium,aa', aiSeed: 'sodium,bb',
  inputLog: [], startedAt: '2026-11-24T10:00:00.000Z', ...over,
});
const save = (games: Record<string, GameRecord>): SaveData => ({...emptySave(), games});

await test('parseSave tolerates garbage and drops malformed records', () => {
  assert.deepEqual(parseSave(null), emptySave());
  assert.deepEqual(parseSave('not json'), emptySave());
  assert.deepEqual(parseSave('[]').games, {});
  assert.deepEqual(parseSave(JSON.stringify({schemaVersion: 99, games: {}})), emptySave());
  const raw = JSON.stringify({
    schemaVersion: 1,
    settings: {logExpanded: false},
    games: {'2026-11-24': rec(), 'bad-key': rec(), '2026-11-25': {status: 'won'}},
  });
  const parsed = parseSave(raw);
  assert.deepEqual(Object.keys(parsed.games), ['2026-11-24']);
  assert.equal(parsed.settings.logExpanded, false);
  assert.equal(parsed.settings.animations, true);
});

await test('home: play, resume, done, before launch', () => {
  const day2 = addDays(LAUNCH_DATE, 1);
  assert.deepEqual(homeState(save({}), day2), {kind: 'play', date: day2, puzzleNumber: 2});
  assert.equal(homeState(save({}), addDays(LAUNCH_DATE, -1)).kind, 'before-launch');
  const t = homeState(save({'2026-11-25': rec()}), '2026-11-25');
  assert.equal(t.kind, 'resume');
  assert.equal(t.kind === 'resume' && t.fromYesterday, false);
  assert.equal(homeState(save({'2026-11-25': rec({status: 'won'})}), '2026-11-25').kind, 'done');
});

await test('home: yesterday\'s unfinished game comes first and locks today', () => {
  const s = save({'2026-11-24': rec()});
  const h = homeState(s, '2026-11-25');
  assert.equal(h.kind, 'resume');
  assert.equal(h.kind === 'resume' && h.date, '2026-11-24');
  assert.equal(h.kind === 'resume' && h.fromYesterday, true);
  // Once it's finished (after midnight), today unlocks.
  const after = save({'2026-11-24': rec({status: 'lost'})});
  assert.equal(homeState(after, '2026-11-25').kind, 'play');
});

await test('expireAbandoned: only games older than yesterday become losses', () => {
  const now = new Date('2026-11-26T15:00:00Z');
  const s = save({'2026-11-24': rec(), '2026-11-25': rec(), '2026-11-23': rec({status: 'won'})});
  const out = expireAbandoned(s, '2026-11-26', now)!;
  assert.equal(out.games['2026-11-24'].status, 'lost');
  assert.equal(out.games['2026-11-24'].abandoned, true);
  assert.equal(out.games['2026-11-25'].status, 'in_progress');
  assert.equal(out.games['2026-11-23'].status, 'won');
  assert.equal(expireAbandoned(out, '2026-11-26', now), null, 'no-op returns null');
});

await test('finishRecord', () => {
  const done = finishRecord(rec(), {
    winner: 'tie', turns: 1000, myFainted: [true, false, true, true, true, true],
    aiRemaining: 2, forfeited: false, aiTeam: ['A', 'B', 'C', 'D', 'E', 'F'],
  }, ['>p1 move 1'], new Date('2026-11-24T12:00:00Z'));
  assert.equal(done.status, 'lost');
  assert.equal(done.turns, 1000);
  assert.deepEqual(done.inputLog, ['>p1 move 1']);
  assert.equal(done.finishedAt, '2026-11-24T12:00:00.000Z');
});

const won = (left: number, over: Partial<GameRecord> = {}) =>
  rec({status: 'won', turns: 20, myFainted: Array.from({length: 6}, (_, i) => i >= left), finishedAt: '2026-11-24T12:00:00Z', ...over});
const lost = (over: Partial<GameRecord> = {}) =>
  rec({status: 'lost', turns: 30, myFainted: Array(6).fill(true), aiRemaining: 2, finishedAt: '2026-11-24T12:00:00Z', ...over});

await test('stats: counts, win %, distribution', () => {
  const s = computeStats(save({
    '2026-11-24': won(3), '2026-11-25': lost(), '2026-11-26': won(6), '2026-11-27': won(0), '2026-11-28': rec(),
  }), '2026-11-28');
  assert.equal(s.played, 4, 'in-progress games are not counted');
  assert.equal(s.wins, 3);
  assert.equal(s.winPct, 75);
  assert.equal(s.losses, 1);
  assert.deepEqual(s.winsByLeft, [0, 1, 0, 1, 0, 0, 1], 'a 0-left win counts as 1 left');
});

await test('stats: streaks', () => {
  const g = {'2026-11-20': won(2), '2026-11-21': won(2), '2026-11-22': won(2), '2026-11-23': lost(), '2026-11-24': won(1), '2026-11-25': won(1)};
  // Today (26th) not played yet: the streak through yesterday is still alive.
  assert.equal(computeStats(save(g), '2026-11-26').currentStreak, 2);
  assert.equal(computeStats(save(g), '2026-11-26').bestStreak, 3);
  // Today finished and won extends it; lost resets it.
  assert.equal(computeStats(save({...g, '2026-11-26': won(4)}), '2026-11-26').currentStreak, 3);
  assert.equal(computeStats(save({...g, '2026-11-26': lost()}), '2026-11-26').currentStreak, 0);
  // A missed day breaks the streak but isn't a loss.
  const missed = computeStats(save(g), '2026-11-27');
  assert.equal(missed.currentStreak, 0);
  assert.equal(missed.losses, 1);
  // Gaps break best-streak runs too.
  assert.equal(computeStats(save({'2026-11-20': won(1), '2026-11-22': won(1)}), '2026-11-22').bestStreak, 1);
});

await test('share text matches the PLAN format', () => {
  assert.equal(shareText({...won(3), puzzleNumber: 12, turns: 23, won: true}, 'showdol.example'),
    'Showdol #12 · W in 23 turns\n🟩🟩🟩⬛⬛⬛\nshowdol.example');
  assert.equal(shareText({...lost(), puzzleNumber: 12, turns: 31, won: false}),
    'Showdol #12 · L in 31 turns (2 left)\n⬛⬛⬛⬛⬛⬛');
  assert.equal(shareText({...lost({forfeited: true}), puzzleNumber: 3, won: false}).split('\n')[0], 'Showdol #3 · L (forfeit)');
  assert.equal(shareText({puzzleNumber: 4, won: false, abandoned: true}), 'Showdol #4 · L (unfinished)');
  assert.equal(shareText({...won(6), puzzleNumber: 1, turns: 1, won: true}).split('\n')[0], 'Showdol #1 · W in 1 turn');
});

await test('export code round-trips and rejects junk', async () => {
  const log = Array.from({length: 80}, (_, i) => `>p${(i % 2) + 1} move ${(i % 4) + 1}`);
  const s = save({'2026-11-24': won(3, {inputLog: log}), '2026-11-25': rec({inputLog: ['>p1 move 1', '>p2 move 2']})});
  const code = await encodeSave(s);
  assert.match(code, /^SHOWDOL1-[A-Za-z0-9_-]+$/);
  const back = await decodeSave(`  ${code.slice(0, 20)}\n${code.slice(20)} `); // whitespace is ignored
  assert.deepEqual(back.games['2026-11-24'], {...s.games['2026-11-24'], battleSeed: '', aiSeed: '', inputLog: []},
    'finished games drop what only resume needs');
  assert.deepEqual(back.games['2026-11-25'], s.games['2026-11-25'], 'unfinished games keep theirs, so they can resume');
  for (const bad of ['hello', 'SHOWDOL1-', 'SHOWDOL1-abc', code.slice(0, -10)]) {
    await assert.rejects(decodeSave(bad), TransferError, bad);
  }
});

await test('merge: finished beats unfinished, earliest finish wins', () => {
  const here = save({'2026-11-24': rec(), '2026-11-25': won(2, {finishedAt: '2026-11-25T10:00:00Z'})});
  const there = save({
    '2026-11-23': lost(),
    '2026-11-24': won(5),
    '2026-11-25': lost({finishedAt: '2026-11-25T20:00:00Z'}),
  });
  const {save: merged, added, replaced} = mergeSaves(here, there);
  assert.equal(added, 1);
  assert.equal(replaced, 1);
  assert.equal(merged.games['2026-11-24'].status, 'won');
  assert.equal(merged.games['2026-11-25'].status, 'won', 'kept the result that finished first');
});

console.log(`daily-check: ${passed} groups passed`);
