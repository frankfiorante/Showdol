/**
 * Unit checks for dates, puzzle numbers, the save format and the daily lock.
 * Run with a DST time zone so the daylight-saving cases are real:
 *
 *   pnpm daily:check        (sets TZ=America/Chicago)
 */
import assert from 'node:assert/strict';
import {addDays, dateKey, daysBetween, formatCountdown, msUntilMidnight, puzzleNumber} from '@/game/daily';
import {expireAbandoned, homeState} from '@/game/lock';
import {emptySave, finishRecord, parseSave, type GameRecord, type SaveData} from '@/game/storage';

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
  } catch (e) {
    console.error(`FAIL ${name}\n`, e);
    process.exit(1);
  }
}

assert.equal(Intl.DateTimeFormat().resolvedOptions().timeZone, 'America/Chicago', 'run via pnpm daily:check');

test('dateKey uses the local date', () => {
  assert.equal(dateKey(new Date(2026, 11, 31, 23, 59)), '2026-12-31');
  assert.equal(dateKey(new Date(2027, 0, 1, 0, 0)), '2027-01-01');
  // 03:30 UTC on Mar 1 is still Feb 28 in Chicago.
  assert.equal(dateKey(new Date('2027-03-01T03:30:00Z')), '2027-02-28');
});

test('addDays / daysBetween across month, year and DST boundaries', () => {
  assert.equal(addDays('2026-11-30', 1), '2026-12-01');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2027-03-14', 1), '2027-03-15'); // US DST starts Mar 14, 2027
  assert.equal(addDays('2027-11-07', -1), '2027-11-06'); // DST ends Nov 7, 2027
  assert.equal(addDays('2028-02-28', 1), '2028-02-29');
  assert.equal(daysBetween('2026-11-24', '2027-11-24'), 365);
  assert.equal(daysBetween('2027-03-13', '2027-03-15'), 2);
});

test('puzzle numbers', () => {
  assert.equal(puzzleNumber('2026-11-24', '2026-11-24'), 1);
  assert.equal(puzzleNumber('2026-12-05', '2026-11-24'), 12);
  assert.equal(puzzleNumber('2026-11-23', '2026-11-24'), null);
});

test('msUntilMidnight, including 23- and 25-hour days', () => {
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

test('parseSave tolerates garbage and drops malformed records', () => {
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

test('home: play, resume, done, before launch', () => {
  assert.deepEqual(homeState(save({}), '2026-11-25'), {kind: 'play', date: '2026-11-25', puzzleNumber: 2});
  assert.equal(homeState(save({}), '2026-11-01').kind, 'before-launch');
  const t = homeState(save({'2026-11-25': rec()}), '2026-11-25');
  assert.equal(t.kind, 'resume');
  assert.equal(t.kind === 'resume' && t.fromYesterday, false);
  assert.equal(homeState(save({'2026-11-25': rec({status: 'won'})}), '2026-11-25').kind, 'done');
});

test('home: yesterday\'s unfinished game comes first and locks today', () => {
  const s = save({'2026-11-24': rec()});
  const h = homeState(s, '2026-11-25');
  assert.equal(h.kind, 'resume');
  assert.equal(h.kind === 'resume' && h.date, '2026-11-24');
  assert.equal(h.kind === 'resume' && h.fromYesterday, true);
  // Once it's finished (after midnight), today unlocks.
  const after = save({'2026-11-24': rec({status: 'lost'})});
  assert.equal(homeState(after, '2026-11-25').kind, 'play');
});

test('expireAbandoned: only games older than yesterday become losses', () => {
  const now = new Date('2026-11-26T15:00:00Z');
  const s = save({'2026-11-24': rec(), '2026-11-25': rec(), '2026-11-23': rec({status: 'won'})});
  const out = expireAbandoned(s, '2026-11-26', now)!;
  assert.equal(out.games['2026-11-24'].status, 'lost');
  assert.equal(out.games['2026-11-24'].abandoned, true);
  assert.equal(out.games['2026-11-25'].status, 'in_progress');
  assert.equal(out.games['2026-11-23'].status, 'won');
  assert.equal(expireAbandoned(out, '2026-11-26', now), null, 'no-op returns null');
});

test('finishRecord', () => {
  const done = finishRecord(rec(), {
    winner: 'tie', turns: 1000, myFainted: [true, false, true, true, true, true],
    aiRemaining: 2, forfeited: false, aiTeam: ['A', 'B', 'C', 'D', 'E', 'F'],
  }, ['>p1 move 1'], new Date('2026-11-24T12:00:00Z'));
  assert.equal(done.status, 'lost');
  assert.equal(done.turns, 1000);
  assert.deepEqual(done.inputLog, ['>p1 move 1']);
  assert.equal(done.finishedAt, '2026-11-24T12:00:00.000Z');
});

console.log(`daily-check: ${passed} groups passed`);
