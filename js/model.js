// Data model and validation. Everything read from storage or from a backup
// file goes through normalizeData, so the rest of the app can trust its shapes.

import { BUILTIN_EXERCISES, MUSCLES } from './library.js';

export const ID_RE = /^[\w-]{1,64}$/;
export const MAX_NAME = 60;
export const REST_OPTIONS = [0, 30, 45, 60, 90, 120, 150, 180, 240, 300];

const MAX_WEIGHT = 2000;
const MAX_REPS = 1000;
const MAX_SETS = 50;
const MAX_ITEMS = 100;

export function uid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function emptyData() {
  return {
    version: 1,
    exercises: BUILTIN_EXERCISES.map((e) => ({ ...e })),
    deletedBuiltins: [],
    routines: [],
    workouts: [],
    settings: { restSeconds: 90, sound: true, lastExport: null },
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

/** Exercises of a plan: sets may be partly or completely empty. */
function planItems(raw, ensure) {
  return arr(raw).slice(0, MAX_ITEMS).flatMap((item) => {
    const exerciseId = isObj(item) ? idOf(item.exerciseId) : null;
    if (!exerciseId) return [];
    ensure(exerciseId);
    const sets = arr(item.sets).filter(isObj).slice(0, MAX_SETS)
      .map((s) => ({ weight: weightOf(s.weight), reps: repsOf(s.reps) }));
    return [{ exerciseId, sets }];
  });
}

/** Exercises of a logged workout: every set has reps, empty exercises are dropped. */
function loggedItems(raw, ensure) {
  return arr(raw).slice(0, MAX_ITEMS).flatMap((item) => {
    const exerciseId = isObj(item) ? idOf(item.exerciseId) : null;
    if (!exerciseId) return [];
    const sets = arr(item.sets).filter(isObj).slice(0, MAX_SETS).flatMap((s) => {
      const reps = repsOf(s.reps);
      return reps ? [{ weight: weightOf(s.weight) ?? 0, reps }] : [];
    });
    if (!sets.length) return [];
    ensure(exerciseId);
    return [{ exerciseId, sets }];
  });
}

/**
 * Returns a clean copy of raw app data. Invalid entries are dropped instead of
 * failing the whole load. Throws only when raw is not an object at all.
 */
export function normalizeData(raw) {
  if (!isObj(raw)) throw new TypeError('Ungültige Daten');
  const data = emptyData();
  data.exercises = [];

  const known = new Set();
  for (const e of arr(raw.exercises)) {
    const id = isObj(e) ? idOf(e.id) : null;
    const name = isObj(e) ? cleanName(e.name) : '';
    if (!id || !name || known.has(id)) continue;
    known.add(id);
    const exercise = { id, name, muscle: MUSCLES.includes(e.muscle) ? e.muscle : 'Sonstiges' };
    if (e.custom === true) exercise.custom = true;
    data.exercises.push(exercise);
  }

  const builtins = new Map(BUILTIN_EXERCISES.map((e) => [e.id, e]));
  const deleted = new Set(arr(raw.deletedBuiltins).filter((id) => builtins.has(id)));
  for (const [id, builtin] of builtins) {
    if (known.has(id) || deleted.has(id)) continue;
    known.add(id);
    data.exercises.push({ ...builtin });
  }

  // Plans and workouts must never point at a missing exercise.
  const ensure = (id) => {
    if (known.has(id)) return;
    known.add(id);
    deleted.delete(id);
    data.exercises.push(builtins.has(id)
      ? { ...builtins.get(id) }
      : { id, name: 'Unbekannte Übung', muscle: 'Sonstiges', custom: true });
  };

  const routineIds = new Set();
  for (const r of arr(raw.routines)) {
    const id = isObj(r) ? idOf(r.id) : null;
    if (!id || routineIds.has(id)) continue;
    routineIds.add(id);
    data.routines.push({ id, name: cleanName(r.name), items: planItems(r.items, ensure) });
  }

  const workoutIds = new Set();
  for (const w of arr(raw.workouts)) {
    const id = isObj(w) ? idOf(w.id) : null;
    const start = isObj(w) ? timeOf(w.start) : null;
    if (!id || !start || workoutIds.has(id)) continue;
    const items = loggedItems(w.items, ensure);
    if (!items.length) continue;
    workoutIds.add(id);
    const end = timeOf(w.end);
    data.workouts.push({
      id,
      name: cleanName(w.name) || 'Training',
      routineId: idOf(w.routineId),
      start,
      end: end != null && end >= start ? end : start,
      items,
    });
  }
  data.workouts.sort((a, b) => b.start - a.start);
  data.deletedBuiltins = [...deleted];

  const settings = isObj(raw.settings) ? raw.settings : {};
  if (REST_OPTIONS.includes(settings.restSeconds)) data.settings.restSeconds = settings.restSeconds;
  if (typeof settings.sound === 'boolean') data.settings.sound = settings.sound;
  data.settings.lastExport = timeOf(settings.lastExport);
  return data;
}

/** The workout in progress. Returns null when raw is unusable. */
export function normalizeActive(raw, data) {
  const start = isObj(raw) ? timeOf(raw.start) : null;
  if (!start) return null;
  const known = new Set(data.exercises.map((e) => e.id));
  const items = arr(raw.items).slice(0, MAX_ITEMS).flatMap((item) => {
    const exerciseId = isObj(item) ? idOf(item.exerciseId) : null;
    if (!exerciseId || !known.has(exerciseId)) return [];
    const sets = arr(item.sets).filter(isObj).slice(0, MAX_SETS).map((s) => {
      const reps = repsOf(s.reps);
      return { weight: weightOf(s.weight), reps, done: s.done === true && reps != null, tw: weightOf(s.tw), tr: repsOf(s.tr) };
    });
    return [{ exerciseId, sets }];
  });
  const rest = isObj(raw.rest) && timeOf(raw.rest.end) && num(raw.rest.total, 3600)
    ? { end: raw.rest.end, total: raw.rest.total }
    : null;
  return { id: idOf(raw.id) ?? uid(), name: cleanName(raw.name), routineId: idOf(raw.routineId), start, items, rest };
}

/** Backup file envelope. */
export function toBackup(data, now = Date.now()) {
  return { app: 'eisen', version: 1, exportedAt: new Date(now).toISOString(), data };
}

export function fromBackup(parsed) {
  if (!isObj(parsed) || parsed.app !== 'eisen' || !isObj(parsed.data)) {
    throw new TypeError('Das ist kein Eisen-Backup.');
  }
  return normalizeData(parsed.data);
}
