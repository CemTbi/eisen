// App state and persistence. Data lives in localStorage on the device:
// one key for the logbook, one small key for the workout in progress (which is
// written on every keystroke).

import { cleanName, emptyData, normalizeActive, normalizeData, uid } from './model.js';
import { computePRs, exerciseOverview, setVolume } from './stats.js';

const DATA_KEY = 'eisen.data.v1';
const ACTIVE_KEY = 'eisen.active.v1';
const CORRUPT_KEY = 'eisen.data.corrupt';

export const state = { data: emptyData(), active: null };

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
  if (raw) {
    try {
      state.data = normalizeData(JSON.parse(raw));
    } catch {
      // Never overwrite data we could not read: keep a copy for recovery.
      write(CORRUPT_KEY, raw);
      state.data = emptyData();
    }
  }
  const active = read(ACTIVE_KEY);
  if (active) {
    try {
      state.active = normalizeActive(JSON.parse(active), state.data);
    } catch {
      state.active = null;
    }
  }
}

const cache = new Map();
function memo(key, compute) {
  if (!cache.has(key)) cache.set(key, compute());
  return cache.get(key);
}

export function save() {
  cache.clear();
  state.data.workouts.sort((a, b) => b.start - a.start);
  return write(DATA_KEY, JSON.stringify(state.data));
}

export function saveActive() {
  return write(ACTIVE_KEY, state.active ? JSON.stringify(state.active) : null);
}

// ---- derived data (cached until the next save) -----------------------------

export const personalRecords = () => memo('prs', () => computePRs(state.data.workouts));
export const overview = () => memo('overview', () => exerciseOverview(state.data.workouts));

const UNKNOWN = { id: '', name: 'Unbekannte Übung', muscle: 'Sonstiges' };

export function getExercise(id) {
  return memo('exercises', () => new Map(state.data.exercises.map((e) => [e.id, e]))).get(id) ?? UNKNOWN;
}

export const sortedExercises = () => memo('sorted', () => (
  [...state.data.exercises].sort((a, b) => a.name.localeCompare(b.name, 'de'))
));

// ---- plans -----------------------------------------------------------------

export const getRoutine = (id) => state.data.routines.find((r) => r.id === id) ?? null;

export function createRoutine(fields = {}) {
  const routine = { id: uid(), name: '', items: [], ...fields };
  state.data.routines.push(routine);
  save();
  return routine;
}

export function removeRoutine(id) {
  state.data.routines = state.data.routines.filter((r) => r.id !== id);
  save();
}

const copyItems = (items) => items.map((item) => ({
  exerciseId: item.exerciseId,
  sets: item.sets.map((s) => ({ weight: s.weight || null, reps: s.reps ?? null })),
}));

export function duplicateRoutine(id) {
  const source = getRoutine(id);
  if (!source) return null;
  const copy = { id: uid(), name: cleanName(`${source.name || 'Plan'} (Kopie)`), items: copyItems(source.items) };
  state.data.routines.splice(state.data.routines.indexOf(source) + 1, 0, copy);
  save();
  return copy;
}

export const routineFromWorkout = (workout) => createRoutine({ name: workout.name, items: copyItems(workout.items) });

// ---- workout in progress -----------------------------------------------------

export function startWorkout(routine) {
  state.active = {
    id: uid(),
    name: routine ? routine.name || 'Training' : 'Freies Training',
    routineId: routine?.id ?? null,
    start: Date.now(),
    rest: null,
    items: (routine?.items ?? []).map((item) => ({
      exerciseId: item.exerciseId,
      sets: item.sets.map((s) => ({ weight: null, reps: null, done: false, tw: s.weight, tr: s.reps })),
    })),
  };
  saveActive();
  return state.active;
}

export function activeTotals(active = state.active) {
  let done = 0;
  let open = 0;
  let volume = 0;
  for (const item of active?.items ?? []) {
    for (const set of item.sets) {
      if (set.done && set.reps) {
        done += 1;
        volume += setVolume(set);
      } else {
        open += 1;
      }
    }
  }
  return { done, open, volume };
}

/**
 * Stores the workout in progress in the logbook. Only ticked sets are kept.
 * Returns the saved workout, or null when no set was ticked.
 */
export function finishWorkout({ updateRoutine = false, now = Date.now() } = {}) {
  const active = state.active;
  if (!active) return null;
  const items = active.items
    .map((item) => ({
      exerciseId: item.exerciseId,
      sets: item.sets.filter((s) => s.done && s.reps).map((s) => ({ weight: s.weight || 0, reps: s.reps })),
    }))
    .filter((item) => item.sets.length);
  if (!items.length) return null;

  const routine = active.routineId ? getRoutine(active.routineId) : null;
  const workout = {
    id: active.id,
    name: cleanName(active.name) || routine?.name || 'Training',
    routineId: routine?.id ?? null,
    start: active.start,
    end: Math.max(now, active.start),
    items,
  };
  state.data.workouts.push(workout);

  if (routine && updateRoutine) {
    // The plan takes over this workout's exercises and sets. Sets that were
    // not ticked keep the value they were aiming for.
    routine.items = active.items.map((item) => ({
      exerciseId: item.exerciseId,
      sets: item.sets.map((s) => ({ weight: (s.weight ?? s.tw) || null, reps: s.reps ?? s.tr ?? null })),
    }));
  }

  state.active = null;
  save();
  saveActive();
  return workout;
}

export function discardActive() {
  state.active = null;
  saveActive();
}

// ---- logbook -----------------------------------------------------------------

export const getWorkout = (id) => state.data.workouts.find((w) => w.id === id) ?? null;

export function removeWorkout(id) {
  state.data.workouts = state.data.workouts.filter((w) => w.id !== id);
  save();
}

// ---- exercises ---------------------------------------------------------------

export function exerciseNameTaken(name, exceptId = null) {
  const wanted = cleanName(name).toLocaleLowerCase('de');
  return state.data.exercises.some((e) => e.id !== exceptId && e.name.toLocaleLowerCase('de') === wanted);
}

export function addExercise({ name, muscle }) {
  const exercise = { id: `c-${uid()}`, name: cleanName(name), muscle, custom: true };
  state.data.exercises.push(exercise);
  save();
  return exercise;
}

export function updateExercise(id, { name, muscle }) {
  const exercise = state.data.exercises.find((e) => e.id === id);
  if (!exercise) return null;
  exercise.name = cleanName(name);
  exercise.muscle = muscle;
  save();
  return exercise;
}

export function exerciseInUse(id) {
  const uses = (items) => items.some((item) => item.exerciseId === id);
  return state.data.workouts.some((w) => uses(w.items))
    || state.data.routines.some((r) => uses(r.items))
    || uses(state.active?.items ?? []);
}

/** Removes an exercise from the library. Refuses (returns false) while it is in use. */
export function removeExercise(id) {
  const exercise = state.data.exercises.find((e) => e.id === id);
  if (!exercise || exerciseInUse(id)) return false;
  state.data.exercises = state.data.exercises.filter((e) => e.id !== id);
  if (!exercise.custom) state.data.deletedBuiltins.push(id);
  save();
  return true;
}

// ---- backup ------------------------------------------------------------------

export function replaceData(data) {
  state.data = data;
  state.active = null;
  saveActive();
  return save();
}

export function resetAll() {
  return replaceData(emptyData());
}
