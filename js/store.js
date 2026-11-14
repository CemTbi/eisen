// App state and persistence. Everything lives in localStorage on the device.

import { getLang, locale, t } from './i18n.js';
import { BUILTIN_EXERCISES } from './library.js';
import { cleanName, emptyData, normalizeData, uid } from './model.js';
import { computePRs, exerciseOverview } from './stats.js';

const DATA_KEY = 'eisen.data.v1';
const CORRUPT_KEY = 'eisen.data.corrupt';

export const state = { data: emptyData() };

let reportError = () => {};
export function onStorageError(handler) {
  reportError = handler;
}

function read(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
    return true;
  } catch (error) {
    reportError(error);
    return false;
  }
}

export const getPref = (key) => read(`eisen.pref.${key}`);
export const setPref = (key, value) => write(`eisen.pref.${key}`, value);

export function load() {
  const raw = read(DATA_KEY);
  if (!raw) return;
  try {
    state.data = normalizeData(JSON.parse(raw));
  } catch {
    // Never overwrite data we could not read: keep a copy for recovery.
    write(CORRUPT_KEY, raw);
    state.data = emptyData();
  }
}

const cache = new Map();
function memo(key, compute) {
  if (!cache.has(key)) cache.set(key, compute());
  return cache.get(key);
}

export function save() {
  cache.clear();
  state.data.logs.sort((a, b) => b.date - a.date);
  return write(DATA_KEY, JSON.stringify(state.data));
}

// ---- exercises -----------------------------------------------------------------
// Built-ins take their name from the current language unless the user renamed them.

const BUILTINS = new Map(BUILTIN_EXERCISES.map((e) => [e.id, e]));

const exerciseMap = () => memo(`exercises:${getLang()}`, () => {
  const map = new Map();
  const deleted = new Set(state.data.deletedBuiltins);
  for (const e of BUILTIN_EXERCISES) {
    if (!deleted.has(e.id)) map.set(e.id, { id: e.id, name: t(`ex.${e.id}`), muscle: e.muscle });
  }
  for (const e of state.data.exercises) map.set(e.id, e);
  return map;
});

export const getExercise = (id) => exerciseMap().get(id) ?? null;

export const allExercises = () => memo(`sorted:${getLang()}`, () => (
  [...exerciseMap().values()].sort((a, b) => a.name.localeCompare(b.name, locale()))
));

export function exerciseNameTaken(name, exceptId = null) {
  const wanted = cleanName(name).toLocaleLowerCase(locale());
  return allExercises().some((e) => e.id !== exceptId && e.name.toLocaleLowerCase(locale()) === wanted);
}

export function addExercise({ name, muscle }) {
  const exercise = { id: `c-${uid()}`, name: cleanName(name), muscle, custom: true };
  state.data.exercises.push(exercise);
  save();
  return exercise;
}

export function updateExercise(id, { name, muscle }) {
  if (!getExercise(id)) return null;
  const builtin = BUILTINS.get(id);
  const fields = { name: cleanName(name), muscle };
  state.data.exercises = state.data.exercises.filter((e) => e.id !== id);
  // A built-in set back to its original name follows the language again.
  if (!builtin || fields.name !== t(`ex.${id}`) || muscle !== builtin.muscle) {
    state.data.exercises.push(builtin ? { id, ...fields } : { id, ...fields, custom: true });
  }
  save();
  return getExercise(id);
}

export function exerciseInUse(id) {
  return state.data.logs.some((log) => log.exerciseId === id)
    || state.data.routines.some((r) => r.items.some((item) => item.exerciseId === id));
}

/** Removes an exercise from the library. Refuses (returns false) while it is in use. */
export function removeExercise(id) {
  if (!getExercise(id) || exerciseInUse(id)) return false;
  state.data.exercises = state.data.exercises.filter((e) => e.id !== id);
  if (BUILTINS.has(id)) state.data.deletedBuiltins.push(id);
  save();
  return true;
}

// ---- plans -----------------------------------------------------------------

export const getRoutine = (id) => state.data.routines.find((r) => r.id === id) ?? null;

export function createRoutine() {
  const routine = { id: uid(), name: '', items: [] };
  state.data.routines.push(routine);
  save();
  return routine;
}

export function removeRoutine(id) {
  state.data.routines = state.data.routines.filter((r) => r.id !== id);
  save();
}

export function duplicateRoutine(id) {
  const source = getRoutine(id);
  if (!source) return null;
  const copy = {
    id: uid(),
    name: cleanName(`${source.name || t('plans.unnamed')} ${t('plans.copySuffix')}`),
    items: source.items.map((item) => ({ exerciseId: item.exerciseId, sets: item.sets.map((s) => ({ ...s })) })),
  };
  state.data.routines.splice(state.data.routines.indexOf(source) + 1, 0, copy);
  save();
  return copy;
}

// ---- logbook -----------------------------------------------------------------

export const getLog = (id) => state.data.logs.find((log) => log.id === id) ?? null;

/** Most recent entry of an exercise (logs are kept newest first). */
export const lastLog = (exerciseId) => state.data.logs.find((log) => log.exerciseId === exerciseId) ?? null;

export function addLog({ exerciseId, date, sets }) {
  const log = { id: uid(), exerciseId, date, sets };
  state.data.logs.push(log);
  save();
  return log;
}

export function updateLog(id, { date, sets }) {
  const log = getLog(id);
  if (!log) return null;
  log.date = date;
  log.sets = sets;
  save();
  return log;
}

export function removeLog(id) {
  state.data.logs = state.data.logs.filter((log) => log.id !== id);
  save();
}

// The statistics work on "sessions": one per logbook entry.
export const sessions = () => memo('sessions', () => state.data.logs.map((log) => ({
  id: log.id, name: '', start: log.date, items: [{ exerciseId: log.exerciseId, sets: log.sets }],
})));

/** Ids of entries that set a personal record → index of the record set. */
export const personalRecords = () => memo('prs', () => {
  const records = new Map();
  for (const [id, keys] of computePRs(sessions())) {
    for (const key of keys) records.set(id, Number(key.split(':')[1]));
  }
  return records;
});

export const overview = () => memo('overview', () => exerciseOverview(sessions()));

// ---- backup ------------------------------------------------------------------

export function replaceData(data) {
  state.data = data;
  return save();
}

/** Deletes plans, entries and custom exercises; language and theme stay. */
export function resetAll() {
  const { lang, theme } = state.data.settings;
  return replaceData({ ...emptyData(), settings: { lang, theme, lastExport: null } });
}
