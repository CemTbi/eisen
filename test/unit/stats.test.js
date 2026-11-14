import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  bestSet, computePRs, e1rm, exerciseOverview, exerciseSessions, lastSets, niceScale, placeholders, startOfWeek,
  summarize, weekSummary, workoutTotals,
} from '../../js/stats.js';

const DAY = 86_400_000;
const T0 = new Date(2026, 8, 7, 18, 0).getTime(); // a Monday

const workout = (id, day, items) => ({
  id,
  name: id,
  start: T0 + day * DAY,
  end: T0 + day * DAY + 3_600_000,
  items: items.map(([exerciseId, ...sets]) => ({ exerciseId, sets: sets.map(([weight, reps]) => ({ weight, reps })) })),
});

const LOG = [
  workout('w1', 0, [['bench', [60, 8], [60, 8], [60, 6]], ['pullup', [0, 8], [0, 6]]]),
  workout('w2', 3, [['bench', [62.5, 8], [62.5, 7]], ['pullup', [0, 10]]]),
  workout('w3', 7, [['bench', [62.5, 8], [65, 3]], ['squat', [100, 5]]]),
  workout('w4', 10, [['bench', [60, 10]], ['pullup', [0, 9]]]),
];

test('e1rm uses Epley and is the weight itself for a single', () => {
  assert.equal(e1rm(100, 1), 100);
  assert.equal(e1rm(60, 30), 120);
  assert.ok(Math.abs(e1rm(80, 5) - 93.333) < 0.001);
  assert.equal(e1rm(0, 12), 0);
  assert.equal(e1rm(80, 0), 0);
  assert.equal(e1rm(null, null), 0);
});

test('workoutTotals counts sets and volume, bodyweight sets add no volume', () => {
  assert.deepEqual(workoutTotals(LOG[0]), { sets: 5, volume: 60 * 8 + 60 * 8 + 60 * 6 });
});

test('bestSet prefers the higher estimated 1RM, then reps for bodyweight', () => {
  assert.deepEqual(bestSet([{ weight: 65, reps: 3 }, { weight: 62.5, reps: 8 }]), { weight: 62.5, reps: 8 });
  assert.deepEqual(bestSet([{ weight: 0, reps: 8 }, { weight: 0, reps: 11 }]), { weight: 0, reps: 11 });
  assert.equal(bestSet([]), null);
});

test('exerciseSessions returns one entry per workout, oldest first', () => {
  const sessions = exerciseSessions([...LOG].reverse(), 'bench');
  assert.deepEqual(sessions.map((s) => s.workoutId), ['w1', 'w2', 'w3', 'w4']);
  assert.equal(sessions[2].maxWeight, 65);
  assert.equal(sessions[0].volume, 1320);
  assert.equal(sessions[0].maxReps, 8);
  assert.equal(sessions[0].totalReps, 22);
  assert.deepEqual(sessions[2].top, { weight: 62.5, reps: 8 });
  assert.deepEqual(exerciseSessions(LOG, 'nothing'), []);
});

test('an exercise listed twice in one workout is merged into one session', () => {
  const sessions = exerciseSessions([workout('x', 0, [['bench', [60, 5]], ['squat', [100, 5]], ['bench', [70, 3]]])], 'bench');
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].sets.length, 2);
  assert.equal(sessions[0].maxWeight, 70);
});

test('summarize finds the records and the first date they were reached', () => {
  const summary = summarize(exerciseSessions(LOG, 'bench'));
  assert.equal(summary.count, 4);
  assert.equal(summary.weighted, true);
  assert.deepEqual(summary.maxWeight, { value: 65, date: LOG[2].start });
  assert.equal(summary.e1rm.date, LOG[3].start); // 60 × 10 = 80 beats 62.5 × 8 = 79.17
  assert.equal(summary.e1rm.value, 80);
  assert.deepEqual(summary.volume, { value: 1320, date: LOG[0].start });
  assert.equal(summary.last.workoutId, 'w4');
  assert.equal(summarize([]), null);
});

test('summarize marks bodyweight-only exercises as unweighted', () => {
  const summary = summarize(exerciseSessions(LOG, 'pullup'));
  assert.equal(summary.weighted, false);
  assert.deepEqual(summary.maxReps, { value: 10, date: LOG[1].start });
  assert.equal(summary.totalReps.value, 14);
});

test('lastSets returns the sets of the most recent workout regardless of order', () => {
  assert.deepEqual(lastSets(LOG, 'bench'), [{ weight: 60, reps: 10 }]);
  assert.deepEqual(lastSets([...LOG].reverse(), 'squat'), [{ weight: 100, reps: 5 }]);
  assert.equal(lastSets(LOG, 'nothing'), null);
});

test('exerciseOverview summarises each exercise', () => {
  const overview = exerciseOverview(LOG);
  assert.deepEqual(overview.get('bench'), {
    count: 4, lastDate: LOG[3].start, lastTop: { weight: 60, reps: 10 }, maxWeight: 65, maxReps: 10,
  });
  assert.equal(overview.get('pullup').count, 3);
  assert.equal(overview.get('pullup').maxWeight, 0);
  assert.equal(overview.has('nothing'), false);
});

test('computePRs flags heavier weights, better estimated 1RMs and more bodyweight reps', () => {
  const prs = computePRs([...LOG].reverse());
  assert.deepEqual([...prs.get('w1')], [], 'the first workout sets the baseline');
  assert.deepEqual([...prs.get('w2')].sort(), ['0:0', '1:0'], 'heavier bench, more pull-ups');
  assert.deepEqual([...prs.get('w3')], ['0:1'], '65 kg is the heaviest so far; first squat is no record');
  assert.deepEqual([...prs.get('w4')], ['0:0'], '60 × 10 is a new best estimated 1RM');
});

test('computePRs does not compare an exercise with itself inside one workout', () => {
  const prs = computePRs([
    workout('a', 0, [['bench', [50, 5]]]),
    workout('b', 1, [['bench', [60, 5]], ['bench', [55, 5]]]),
  ]);
  assert.deepEqual([...prs.get('b')].sort(), ['0:0', '1:0']);
});

test('placeholders prefer last time, then the plan target, then the set above', () => {
  const blank = { weight: null, reps: null, tw: null, tr: null };
  assert.deepEqual(
    placeholders([{ ...blank, tw: 50, tr: 10 }, { ...blank, tw: 50, tr: 10 }, blank], [{ weight: 60, reps: 8 }]),
    [{ weight: 60, reps: 8 }, { weight: 50, reps: 10 }, { weight: 50, reps: 10 }],
  );
});

test('placeholders carry typed values down to the following sets', () => {
  const blank = { weight: null, reps: null };
  assert.deepEqual(
    placeholders([{ weight: 70, reps: 5 }, blank, { weight: null, reps: 3 }, blank], null),
    [{ weight: null, reps: null }, { weight: 70, reps: 5 }, { weight: 70, reps: 5 }, { weight: 70, reps: 3 }],
  );
});

test('placeholders leave the weight open for bodyweight history', () => {
  assert.deepEqual(
    placeholders([{ weight: null, reps: null, tw: null, tr: null }], [{ weight: 0, reps: 12 }]),
    [{ weight: null, reps: 12 }],
  );
});

test('startOfWeek is Monday midnight', () => {
  const monday = new Date(2026, 10, 9).getTime();
  assert.equal(startOfWeek(new Date(2026, 10, 9, 0, 0).getTime()), monday);
  assert.equal(startOfWeek(new Date(2026, 10, 14, 18, 30).getTime()), monday);
  assert.equal(startOfWeek(new Date(2026, 10, 15, 23, 59).getTime()), monday);
});

test('weekSummary only counts workouts of the current week', () => {
  const now = new Date(2026, 10, 14, 12, 0).getTime(); // Saturday
  const at = (y, m, d) => ({ start: new Date(y, m, d, 18).getTime() });
  const summary = weekSummary([at(2026, 10, 8), at(2026, 10, 9), at(2026, 10, 11), at(2026, 10, 11), at(2026, 10, 16)], now);
  assert.equal(summary.count, 3);
  assert.deepEqual(summary.days, [true, false, true, false, false, false, false]);
  assert.equal(summary.today, 5);
});

test('niceScale picks round bounds that contain the data', () => {
  assert.deepEqual(niceScale(60, 80), { lo: 60, hi: 80, ticks: [60, 70, 80] });
  assert.deepEqual(niceScale(61, 79).ticks, [60, 70, 80]);
  assert.deepEqual(niceScale(0, 4500).ticks, [0, 2000, 4000, 6000]);
  const flat = niceScale(80, 80);
  assert.ok(flat.lo < 80 && flat.hi > 80);
  assert.ok(niceScale(1, 1).lo >= 0, 'never below zero for non-negative data');
  for (const [min, max] of [[57.5, 62.5], [8, 12], [0, 0], [999, 1001], [0.5, 0.75]]) {
    const { lo, hi, ticks } = niceScale(min, max);
    assert.ok(lo <= min && hi >= max, `${min}..${max} within ${lo}..${hi}`);
    assert.ok(ticks.length >= 2 && ticks.length <= 6, `${ticks.length} ticks for ${min}..${max}`);
    assert.equal(ticks[0], lo);
  }
});
