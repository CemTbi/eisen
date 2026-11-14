import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LOCALES, setLang, t } from '../../js/i18n.js';
import { BUILTIN_EXERCISES, MUSCLES } from '../../js/library.js';
import { ID_RE, emptyData, fromBackup, normalizeData, toBackup, uid } from '../../js/model.js';

const set = (weight, reps) => ({ weight, reps });

test('every language has the same keys, in the same shape', () => {
  const reference = LOCALES.de.strings;
  const holes = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
  for (const [code, { strings }] of Object.entries(LOCALES)) {
    assert.deepEqual(Object.keys(strings).sort(), Object.keys(reference).sort(), `keys of ${code}`);
    for (const [key, value] of Object.entries(strings)) {
      assert.equal(Array.isArray(value), Array.isArray(reference[key]), `${code}: ${key}`);
      if (Array.isArray(value)) assert.equal(value.length, 2, `${code}: ${key} needs [one, many]`);
      else assert.deepEqual(holes(value), holes(reference[key]), `${code}: placeholders of ${key}`);
    }
  }
});

test('every built-in exercise and muscle group is named in every language', () => {
  const ids = new Set();
  for (const exercise of BUILTIN_EXERCISES) {
    assert.match(exercise.id, ID_RE);
    assert.ok(MUSCLES.includes(exercise.muscle), exercise.id);
    assert.ok(!ids.has(exercise.id), `duplicate id ${exercise.id}`);
    ids.add(exercise.id);
  }
  for (const [code, { strings }] of Object.entries(LOCALES)) {
    const names = BUILTIN_EXERCISES.map((e) => strings[`ex.${e.id}`]);
    assert.ok(names.every(Boolean), `${code} names every exercise`);
    assert.equal(new Set(names).size, names.length, `${code} has no duplicate exercise names`);
    for (const muscle of MUSCLES) assert.ok(strings[`muscle.${muscle}`], `${code}: ${muscle}`);
  }
});

test('every built-in exercise names muscles the picture can draw', () => {
  const drawable = new Set(Object.keys(LOCALES.de.strings).filter((key) => key.startsWith('m.')).map((key) => key.slice(2)));
  assert.equal(drawable.size, 15);
  for (const exercise of BUILTIN_EXERCISES) {
    assert.ok(exercise.primary.length > 0, `${exercise.id} has a main muscle`);
    for (const muscle of [...exercise.primary, ...exercise.secondary]) assert.ok(drawable.has(muscle), `${exercise.id}: ${muscle}`);
    assert.equal(new Set([...exercise.primary, ...exercise.secondary]).size, exercise.primary.length + exercise.secondary.length, exercise.id);
  }
});

test('t fills placeholders, falls back, and setLang switches', () => {
  setLang('en');
  assert.equal(t('time.daysAgo', { n: 3 }), '3 days ago');
  assert.deepEqual(t('n.sets'), ['set', 'sets']);
  assert.equal(t('no.such.key'), 'no.such.key');
  setLang('de');
  assert.equal(t('time.daysAgo', { n: 3 }), 'vor 3 Tagen');
  assert.equal(setLang('xx'), setLang('auto'), 'unknown codes follow the device');
  setLang('de');
});

test('uid produces route-safe, distinct ids', () => {
  const a = uid();
  assert.match(a, ID_RE);
  assert.notEqual(a, uid());
});

test('normalizeData rejects non-objects and accepts an empty object', () => {
  for (const bad of [null, undefined, 'x', 3, []]) assert.throws(() => normalizeData(bad), TypeError);
  assert.deepEqual(normalizeData({}), emptyData());
});

test('normalizeData is stable on its own output', () => {
  const data = normalizeData({
    exercises: [{ id: 'c-1', name: 'Mein Curl', muscle: 'biceps', custom: true }],
    routines: [{ id: 'r1', name: 'Push', items: [{ exerciseId: 'c-1', sets: [set(20, 12), set(null, null)] }] }],
    logs: [{ id: 'l1', exerciseId: 'c-1', date: 1000, sets: [set(20, 12)] }],
    settings: { lang: 'en', theme: 'black', lastExport: 77 },
  });
  assert.deepEqual(normalizeData(JSON.parse(JSON.stringify(data))), data);
  assert.deepEqual(data.settings, { lang: 'en', theme: 'black', lastExport: 77 });
  assert.equal(data.logs.length, 1);
});

test('normalizeData drops malformed entries and keeps the valid ones', () => {
  const data = normalizeData({
    exercises: [
      { id: 'ok', name: '  Gute   Übung ', muscle: 'nonsense' },
      { id: 'ok', name: 'Doppelt', muscle: 'chest' },
      { id: 'bad id!', name: 'x', muscle: 'chest' },
      { id: 'noname', name: '   ', muscle: 'chest' },
      null,
    ],
    routines: [{ id: 'r1', name: 5, items: 'nope' }, { name: 'no id' }, 7],
    logs: [
      { id: 'a', exerciseId: 'ok', date: 2000, sets: [set(-5, 8.9), set(50, 0), set(1e9, 3), 'x'] },
      { id: 'b', exerciseId: 'ok', date: 3000, sets: [] },
      { id: 'c', exerciseId: 'ok', date: 'yesterday', sets: [set(1, 1)] },
      { id: 'a', exerciseId: 'ok', date: 4000, sets: [set(1, 1)] },
      { id: 'd', exerciseId: 'bad id!', date: 4000, sets: [set(1, 1)] },
    ],
    settings: { lang: 'klingon', theme: 'pink' },
  });
  assert.deepEqual(data.exercises, [{ id: 'ok', name: 'Gute Übung', muscle: 'other', custom: true }]);
  assert.deepEqual(data.routines, [{ id: 'r1', name: '', items: [] }]);
  assert.deepEqual(data.logs, [{ id: 'a', exerciseId: 'ok', date: 2000, sets: [set(0, 8), set(0, 3)] }]);
  assert.deepEqual(data.settings, { lang: 'auto', theme: 'midnight', lastExport: null });
});

test('logs are kept newest first and unknown exercises get a placeholder', () => {
  const data = normalizeData({ logs: [
    { id: 'a', exerciseId: 'squat', date: 10, sets: [set(100, 5)] },
    { id: 'b', exerciseId: 'gone', date: 30, sets: [set(10, 10)] },
    { id: 'c', exerciseId: 'squat', date: 20, sets: [set(100, 5)] },
  ] });
  assert.deepEqual(data.logs.map((l) => l.id), ['b', 'c', 'a']);
  assert.deepEqual(data.exercises, [{ id: 'gone', name: '?', muscle: 'other', custom: true }]);
});

test('untouched built-ins are not stored, changed ones are', () => {
  const data = normalizeData({ exercises: [
    { id: 'squat', name: 'Kniebeugen', muscle: 'legs' },
    { id: 'deadlift', name: 'Deadlift', muscle: 'back' },
    { id: 'pull-up', name: 'Klimmzug breit', muscle: 'back' },
    { id: 'crunch', name: 'Crunches', muscle: 'legs' },
  ] });
  assert.deepEqual(data.exercises, [
    { id: 'pull-up', name: 'Klimmzug breit', muscle: 'back' },
    { id: 'crunch', name: 'Crunches', muscle: 'legs' },
  ]);
});

test('deleted built-ins stay deleted unless something still uses them', () => {
  assert.deepEqual(normalizeData({ deletedBuiltins: ['squat', 'not-a-builtin'] }).deletedBuiltins, ['squat']);
  const used = normalizeData({
    deletedBuiltins: ['squat', 'crunch'],
    routines: [{ id: 'r', name: 'Beine', items: [{ exerciseId: 'squat', sets: [] }] }],
  });
  assert.deepEqual(used.deletedBuiltins, ['crunch']);
});

test('version 1 data is migrated: workouts become entries, German muscle labels become keys', () => {
  const data = normalizeData({
    version: 1,
    exercises: [
      { id: 'squat', name: 'Kniebeugen', muscle: 'Beine' },
      { id: 'c-9', name: 'Landmine Press', muscle: 'Schultern', custom: true },
    ],
    workouts: [{
      id: 'w1', name: 'Beine', start: 5000, end: 9000,
      items: [{ exerciseId: 'squat', sets: [set(100, 5), set(100, 4)] }, { exerciseId: 'c-9', sets: [set(30, 8)] }],
    }],
    settings: { restSeconds: 90, sound: true },
  });
  assert.deepEqual(data.exercises, [{ id: 'c-9', name: 'Landmine Press', muscle: 'shoulders', custom: true }]);
  assert.deepEqual(data.logs, [
    { id: 'w1-0', exerciseId: 'squat', date: 5000, sets: [set(100, 5), set(100, 4)] },
    { id: 'w1-1', exerciseId: 'c-9', date: 5000, sets: [set(30, 8)] },
  ]);
  assert.equal(data.version, 2);
  assert.equal('workouts' in data, false);
});

test('a backup survives the round trip, other files are rejected', () => {
  const data = normalizeData({
    routines: [{ id: 'r1', name: 'Beine', items: [{ exerciseId: 'squat', sets: [set(100, 5)] }] }],
    logs: [{ id: 'l1', exerciseId: 'squat', date: 1000, sets: [set(100, 5)] }],
  });
  const backup = JSON.parse(JSON.stringify(toBackup(data, 0)));
  assert.equal(backup.exportedAt, '1970-01-01T00:00:00.000Z');
  assert.deepEqual(fromBackup(backup), data);
  for (const bad of [null, [], {}, { app: 'other', data: {} }, { app: 'eisen' }, { app: 'eisen', data: [] }]) {
    assert.throws(() => fromBackup(bad), TypeError);
  }
});
