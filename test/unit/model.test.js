import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BUILTIN_EXERCISES, MUSCLES } from '../../js/library.js';
import { ID_RE, emptyData, fromBackup, normalizeActive, normalizeData, toBackup, uid } from '../../js/model.js';

test('the built-in library is consistent', () => {
  const ids = new Set();
  const names = new Set();
  for (const exercise of BUILTIN_EXERCISES) {
    assert.match(exercise.id, ID_RE);
    assert.ok(MUSCLES.includes(exercise.muscle), exercise.id);
    assert.ok(!ids.has(exercise.id), `duplicate id ${exercise.id}`);
    assert.ok(!names.has(exercise.name), `duplicate name ${exercise.name}`);
    ids.add(exercise.id);
    names.add(exercise.name);
  }
});

test('uid produces route-safe, distinct ids', () => {
  const a = uid();
  assert.match(a, ID_RE);
  assert.notEqual(a, uid());
});

test('normalizeData rejects non-objects', () => {
  for (const bad of [null, undefined, 'x', 3, []]) assert.throws(() => normalizeData(bad), TypeError);
});

test('normalizeData turns an empty object into fresh data', () => {
  assert.deepEqual(normalizeData({}), emptyData());
});

test('normalizeData is stable on its own output', () => {
  const data = normalizeData({
    exercises: [{ id: 'c-1', name: 'Mein Curl', muscle: 'Bizeps', custom: true }],
    routines: [{ id: 'r1', name: 'Push', items: [{ exerciseId: 'c-1', sets: [{ weight: 20, reps: 12 }, { weight: null, reps: null }] }] }],
    workouts: [{ id: 'w1', name: 'Push', routineId: 'r1', start: 1000, end: 5000, items: [{ exerciseId: 'c-1', sets: [{ weight: 20, reps: 12 }] }] }],
    settings: { restSeconds: 120, sound: false, lastExport: 77 },
  });
  assert.deepEqual(normalizeData(JSON.parse(JSON.stringify(data))), data);
  assert.equal(data.settings.restSeconds, 120);
  assert.equal(data.settings.sound, false);
  assert.equal(data.exercises.length, BUILTIN_EXERCISES.length + 1);
});

test('normalizeData drops malformed entries and keeps the valid ones', () => {
  const data = normalizeData({
    exercises: [
      { id: 'ok', name: '  Gute   Übung ', muscle: 'Quatsch' },
      { id: 'ok', name: 'Doppelt', muscle: 'Brust' },
      { id: 'bad id!', name: 'x', muscle: 'Brust' },
      { id: 'noname', name: '   ', muscle: 'Brust' },
      null,
      'text',
    ],
    routines: [{ id: 'r1', name: 5, items: 'nope' }, { name: 'no id' }, 7],
    workouts: [
      { id: 'w1', start: 2000, end: 1000, items: [{ exerciseId: 'ok', sets: [{ weight: -5, reps: 8.9 }, { weight: 50, reps: 0 }, { weight: 1e9, reps: 3 }, 'x'] }] },
      { id: 'w2', start: 3000, items: [{ exerciseId: 'ok', sets: [] }] },
      { id: 'w3', start: 'yesterday', items: [] },
      { id: 'w1', start: 4000, items: [{ exerciseId: 'ok', sets: [{ weight: 1, reps: 1 }] }] },
    ],
    settings: { restSeconds: 77, sound: 'yes' },
  });
  const custom = data.exercises.find((e) => e.id === 'ok');
  assert.deepEqual(custom, { id: 'ok', name: 'Gute Übung', muscle: 'Sonstiges' });
  assert.equal(data.exercises.filter((e) => e.id === 'ok').length, 1);
  assert.deepEqual(data.routines, [{ id: 'r1', name: '', items: [] }]);
  assert.equal(data.workouts.length, 1, 'workouts without a valid set are dropped');
  assert.deepEqual(data.workouts[0], {
    id: 'w1', name: 'Training', routineId: null, start: 2000, end: 2000,
    items: [{ exerciseId: 'ok', sets: [{ weight: 0, reps: 8 }, { weight: 0, reps: 3 }] }],
  });
  assert.equal(data.settings.restSeconds, 90);
  assert.equal(data.settings.sound, true);
});

test('normalizeData sorts workouts newest first', () => {
  const item = [{ exerciseId: 'squat', sets: [{ weight: 100, reps: 5 }] }];
  const data = normalizeData({ workouts: [{ id: 'a', start: 10, items: item }, { id: 'b', start: 30, items: item }, { id: 'c', start: 20, items: item }] });
  assert.deepEqual(data.workouts.map((w) => w.id), ['b', 'c', 'a']);
});

test('normalizeData adds a placeholder for exercises that history refers to', () => {
  const data = normalizeData({ workouts: [{ id: 'w', start: 10, items: [{ exerciseId: 'gone', sets: [{ weight: 10, reps: 10 }] }] }] });
  assert.deepEqual(data.exercises.find((e) => e.id === 'gone'), { id: 'gone', name: 'Unbekannte Übung', muscle: 'Sonstiges', custom: true });
});

test('deleted built-ins stay deleted unless something still uses them', () => {
  const unused = normalizeData({ deletedBuiltins: ['squat', 'not-a-builtin'] });
  assert.deepEqual(unused.deletedBuiltins, ['squat']);
  assert.equal(unused.exercises.some((e) => e.id === 'squat'), false);

  const used = normalizeData({
    deletedBuiltins: ['squat'],
    routines: [{ id: 'r', name: 'Beine', items: [{ exerciseId: 'squat', sets: [] }] }],
  });
  assert.deepEqual(used.deletedBuiltins, []);
  assert.equal(used.exercises.find((e) => e.id === 'squat').name, 'Kniebeugen');
});

test('renamed built-ins keep their name and new built-ins are merged in', () => {
  const data = normalizeData({ exercises: [{ id: 'squat', name: 'Squat', muscle: 'Beine' }] });
  assert.equal(data.exercises.find((e) => e.id === 'squat').name, 'Squat');
  assert.equal(data.exercises.length, BUILTIN_EXERCISES.length);
});

test('normalizeActive restores a workout in progress', () => {
  const data = emptyData();
  const active = normalizeActive({
    id: 'a1', name: 'Push', routineId: 'r1', start: 1000,
    rest: { end: 5000, total: 90 },
    items: [
      { exerciseId: 'squat', sets: [{ weight: 100, reps: 5, done: true, tw: 95, tr: 5 }, { weight: 100, reps: null, done: true }] },
      { exerciseId: 'deleted-exercise', sets: [{ weight: 1, reps: 1, done: true }] },
    ],
  }, data);
  assert.deepEqual(active, {
    id: 'a1', name: 'Push', routineId: 'r1', start: 1000, rest: { end: 5000, total: 90 },
    items: [{ exerciseId: 'squat', sets: [
      { weight: 100, reps: 5, done: true, tw: 95, tr: 5 },
      { weight: 100, reps: null, done: false, tw: null, tr: null },
    ] }],
  });
  assert.equal(normalizeActive({ items: [] }, data), null);
  assert.equal(normalizeActive('garbage', data), null);
});

test('a backup survives the round trip', () => {
  const data = normalizeData({
    routines: [{ id: 'r1', name: 'Beine', items: [{ exerciseId: 'squat', sets: [{ weight: 100, reps: 5 }] }] }],
    workouts: [{ id: 'w1', name: 'Beine', routineId: 'r1', start: 1000, end: 2000, items: [{ exerciseId: 'squat', sets: [{ weight: 100, reps: 5 }] }] }],
  });
  const backup = JSON.parse(JSON.stringify(toBackup(data, 0)));
  assert.equal(backup.app, 'eisen');
  assert.equal(backup.exportedAt, '1970-01-01T00:00:00.000Z');
  assert.deepEqual(fromBackup(backup), data);
});

test('fromBackup rejects files that are not Eisen backups', () => {
  for (const bad of [null, [], {}, { app: 'other', data: {} }, { app: 'eisen' }, { app: 'eisen', data: [] }]) {
    assert.throws(() => fromBackup(bad), TypeError);
  }
});
