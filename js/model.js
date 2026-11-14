// Data model and validation. Everything read from storage or from a backup
// file goes through normalizeData, so the rest of the app can trust its shapes.
//
// data = {
//   version: 2,
//   exercises: custom exercises and renamed built-ins  [{ id, name, muscle, custom? }]
//   deletedBuiltins: ids of built-ins the user removed
//   routines: the training plans                         [{ id, name, items: [{ exerciseId, sets }] }]
//   logs: the logbook, one entry per exercise and day    [{ id, exerciseId, date, sets }]
//   settings: { lang, theme, lastExport }
// }
// A set is { weight, reps }. In plans both may be null; in the logbook reps is
// always set and a weight of 0 means bodyweight.

import { LOCALES, translations } from './i18n.js';
import { BUILTIN_EXERCISES, MUSCLES } from './library.js';

export const ID_RE = /^[\w-]{1,64}$/;
export const MAX_NAME = 60;
export const THEMES = ['midnight', 'black'];

const MAX_WEIGHT = 2000;
const MAX_REPS = 1000;
const MAX_SETS = 50;
const MAX_ITEMS = 100;

// Version 1 stored muscle groups by their German label.
const LEGACY_MUSCLES = {
  Brust: 'chest', Rücken: 'back', Schultern: 'shoulders', Bizeps: 'biceps', Trizeps: 'triceps', Beine: 'legs', Bauch: 'abs',
};

export function uid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function emptyData() {
  return {
    version: 2,
    exercises: [],
    deletedBuiltins: [],
    routines: [],
    logs: [],
    settings: { lang: 'auto', theme: 'midnight', lastExport: null },
  };
}

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const arr = (v) => (Array.isArray(v) ? v : []);
const num = (v, max) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max ? v : null);
const idOf = (v) => (typeof v === 'string' && ID_RE.test(v) ? v : null);
const timeOf = (v) => num(v, 8.64e15);

export const cleanName = (v, max = MAX_NAME) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');

function weightOf(v) {
  const n = num(v, MAX_WEIGHT);
  return n == null ? null : Math.round(n * 100) / 100;
}

function repsOf(v) {
  const n = num(v, MAX_REPS);
  return n == null || Math.floor(n) < 1 ? null : Math.floor(n);
}

const planSets = (raw) => arr(raw).filter(isObj).slice(0, MAX_SETS).map((s) => ({ weight: weightOf(s.weight), reps: repsOf(s.reps) }));

/** Sets of a logbook entry: each needs reps, a missing weight means bodyweight. */
export const loggedSets = (raw) => arr(raw).filter(isObj).slice(0, MAX_SETS).flatMap((s) => {
  const reps = repsOf(s.reps);
  return reps ? [{ weight: weightOf(s.weight) ?? 0, reps }] : [];
});

/**
 * Returns a clean copy of raw app data (current or version 1). Invalid entries
 * are dropped instead of failing the whole load. Throws only when raw is not an
 * object at all.
 */
export function normalizeData(raw) {
  if (!isObj(raw)) throw new TypeError('invalid data');
  const data = emptyData();
  const builtins = new Map(BUILTIN_EXERCISES.map((e) => [e.id, e]));
  const known = new Set(builtins.keys());

  for (const e of arr(raw.exercises)) {
    const id = isObj(e) ? idOf(e.id) : null;
    const name = isObj(e) ? cleanName(e.name) : '';
    if (!id || !name || data.exercises.some((x) => x.id === id)) continue;
    const muscle = MUSCLES.includes(e.muscle) ? e.muscle : LEGACY_MUSCLES[e.muscle] ?? 'other';
    const builtin = builtins.get(id);
    if (builtin) {
      // Only keep a built-in the user actually changed, so untouched ones follow the language.
      if (translations(`ex.${id}`).includes(name) && muscle === builtin.muscle) continue;
      data.exercises.push({ id, name, muscle });
    } else {
      data.exercises.push({ id, name, muscle, custom: true });
      known.add(id);
    }
  }

  const deleted = new Set(arr(raw.deletedBuiltins).filter((id) => builtins.has(id)));

  // Plans and entries must never point at a missing exercise.
  const ensure = (id) => {
    deleted.delete(id);
    if (known.has(id)) return;
    known.add(id);
    data.exercises.push({ id, name: '?', muscle: 'other', custom: true });
  };

  const routineIds = new Set();
  for (const r of arr(raw.routines)) {
    const id = isObj(r) ? idOf(r.id) : null;
    if (!id || routineIds.has(id)) continue;
    routineIds.add(id);
    const items = arr(r.items).slice(0, MAX_ITEMS).flatMap((item) => {
      const exerciseId = isObj(item) ? idOf(item.exerciseId) : null;
      if (!exerciseId) return [];
      ensure(exerciseId);
      return [{ exerciseId, sets: planSets(item.sets) }];
    });
    data.routines.push({ id, name: cleanName(r.name), items });
  }

  const logIds = new Set();
  const addLog = (id, exerciseId, date, rawSets) => {
    const sets = loggedSets(rawSets);
    if (!id || !exerciseId || !date || logIds.has(id) || !sets.length) return;
    logIds.add(id);
    ensure(exerciseId);
    data.logs.push({ id, exerciseId, date, sets });
  };
  for (const log of arr(raw.logs)) {
    if (isObj(log)) addLog(idOf(log.id), idOf(log.exerciseId), timeOf(log.date), log.sets);
  }
  // Version 1 grouped sets into workouts; each exercise of a workout becomes an entry.
  for (const workout of arr(raw.workouts)) {
    if (!isObj(workout)) continue;
    arr(workout.items).forEach((item, i) => {
      if (isObj(item)) addLog(idOf(`${workout.id}-${i}`.slice(-64)), idOf(item.exerciseId), timeOf(workout.start), item.sets);
    });
  }
  data.logs.sort((a, b) => b.date - a.date);
  data.deletedBuiltins = [...deleted];

  const settings = isObj(raw.settings) ? raw.settings : {};
  if (settings.lang === 'auto' || LOCALES[settings.lang]) data.settings.lang = settings.lang;
  if (THEMES.includes(settings.theme)) data.settings.theme = settings.theme;
  data.settings.lastExport = timeOf(settings.lastExport);
  return data;
}

/** Backup file envelope. */
export function toBackup(data, now = Date.now()) {
  return { app: 'eisen', version: 2, exportedAt: new Date(now).toISOString(), data };
}

export function fromBackup(parsed) {
  if (!isObj(parsed) || parsed.app !== 'eisen' || !isObj(parsed.data)) throw new TypeError('not an Eisen backup');
  return normalizeData(parsed.data);
}
