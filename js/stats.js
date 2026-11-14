// Pure calculations over the logbook. No DOM, no storage: everything here is unit-tested.
//
// Input is a list of sessions: { id, name, start, items: [{ exerciseId, sets: [{ weight, reps }] }] }.
// The app passes one session per logbook entry. A weight of 0 means a bodyweight set.

/** Estimated one-rep max (Epley). 0 for bodyweight sets. */
export function e1rm(weight, reps) {
  if (!(weight > 0) || !(reps > 0)) return 0;
  return reps === 1 ? weight : weight * (1 + reps / 30);
}

export const setVolume = (set) => (set.weight || 0) * (set.reps || 0);

function compareSets(a, b) {
  return e1rm(a.weight, a.reps) - e1rm(b.weight, b.reps) || (a.weight || 0) - (b.weight || 0) || a.reps - b.reps;
}

/** The strongest set: highest estimated 1RM, for bodyweight sets the most reps. */
export function bestSet(sets) {
  let best = null;
  for (const set of sets) if (!best || compareSets(set, best) > 0) best = set;
  return best;
}

const heaviestSet = (sets) => sets.reduce((a, b) => ((b.weight || 0) > (a.weight || 0) ? b : a));

/** One entry per workout that contains the exercise, oldest first. */
export function exerciseSessions(workouts, exerciseId) {
  const sessions = [];
  for (const workout of workouts) {
    const sets = workout.items.filter((item) => item.exerciseId === exerciseId).flatMap((item) => item.sets);
    if (!sets.length) continue;
    sessions.push({
      workoutId: workout.id,
      name: workout.name,
      date: workout.start,
      sets,
      top: bestSet(sets),
      maxWeight: Math.max(...sets.map((s) => s.weight || 0)),
      e1rm: Math.max(...sets.map((s) => e1rm(s.weight, s.reps))),
      volume: sets.reduce((sum, s) => sum + setVolume(s), 0),
      maxReps: Math.max(...sets.map((s) => s.reps)),
      totalReps: sets.reduce((sum, s) => sum + s.reps, 0),
    });
  }
  return sessions.sort((a, b) => a.date - b.date);
}

/** Records across sessions. Each record names the first session that reached it. */
export function summarize(sessions) {
  if (!sessions.length) return null;
  const record = (key) => {
    const best = sessions.reduce((a, b) => (b[key] > a[key] ? b : a));
    return { value: best[key], date: best.date };
  };
  return {
    count: sessions.length,
    weighted: sessions.some((s) => s.maxWeight > 0),
    last: sessions.at(-1),
    maxWeight: record('maxWeight'),
    e1rm: record('e1rm'),
    volume: record('volume'),
    maxReps: record('maxReps'),
    totalReps: record('totalReps'),
  };
}

/**
 * Per exercise: how often it was trained, the last session's top set and the
 * all-time best weight. Feeds the exercise overview list.
 */
export function exerciseOverview(workouts) {
  const overview = new Map();
  for (const workout of workouts) {
    const seen = new Set();
    for (const item of workout.items) {
      if (!item.sets.length) continue;
      let entry = overview.get(item.exerciseId);
      if (!entry) {
        entry = { count: 0, lastDate: 0, lastTop: null, maxWeight: 0, maxReps: 0 };
        overview.set(item.exerciseId, entry);
      }
      if (!seen.has(item.exerciseId)) {
        seen.add(item.exerciseId);
        entry.count += 1;
      }
      const top = bestSet(item.sets);
      if (workout.start > entry.lastDate) {
        entry.lastDate = workout.start;
        entry.lastTop = top;
      } else if (workout.start === entry.lastDate && compareSets(top, entry.lastTop) > 0) {
        entry.lastTop = top;
      }
      for (const set of item.sets) {
        entry.maxWeight = Math.max(entry.maxWeight, set.weight || 0);
        entry.maxReps = Math.max(entry.maxReps, set.reps);
      }
    }
  }
  return overview;
}

/**
 * Personal records. Returns Map(workoutId → Set of "itemIndex:setIndex").
 * A set is a record when it beats everything logged for that exercise in
 * earlier workouts: a heavier weight, a higher estimated 1RM, or more reps on
 * a bodyweight exercise. The first time an exercise is logged is not a record.
 */
export function computePRs(workouts) {
  const sorted = [...workouts].sort((a, b) => a.start - b.start);
  const best = new Map();
  const result = new Map();
  for (const workout of sorted) {
    const prs = new Set();
    const updated = new Map();
    workout.items.forEach((item, index) => {
      if (!item.sets.length) return;
      const prev = best.get(item.exerciseId);
      const heavy = heaviestSet(item.sets);
      const top = bestSet(item.sets);
      if (prev) {
        if ((heavy.weight || 0) > prev.weight) prs.add(`${index}:${item.sets.indexOf(heavy)}`);
        else if (e1rm(top.weight, top.reps) > prev.e1rm + 1e-9) prs.add(`${index}:${item.sets.indexOf(top)}`);
        else if (prev.weight === 0 && !(top.weight > 0) && top.reps > prev.reps) prs.add(`${index}:${item.sets.indexOf(top)}`);
      }
      const next = updated.get(item.exerciseId) ?? { weight: 0, e1rm: 0, reps: 0, ...prev };
      for (const set of item.sets) {
        next.weight = Math.max(next.weight, set.weight || 0);
        next.e1rm = Math.max(next.e1rm, e1rm(set.weight, set.reps));
        next.reps = Math.max(next.reps, set.reps);
      }
      updated.set(item.exerciseId, next);
    });
    for (const [exerciseId, value] of updated) best.set(exerciseId, value);
    result.set(workout.id, prs);
  }
  return result;
}

/**
 * Grey placeholder values for the sets of one exercise. For each set, in order
 * of preference: what was lifted in the same set last time, the plan's target
 * (tw/tr), and finally whatever the set above it uses.
 */
export function placeholders(sets, previous) {
  const out = [];
  let carryWeight = null;
  let carryReps = null;
  sets.forEach((set, i) => {
    const prev = previous?.[i];
    const weight = (prev?.weight || null) ?? set.tw ?? carryWeight;
    const reps = prev?.reps ?? set.tr ?? carryReps;
    out.push({ weight, reps });
    carryWeight = set.weight ?? weight;
    carryReps = set.reps ?? reps;
  });
  return out;
}

/** Round axis bounds and ticks for a value range. */
export function niceScale(min, max, count = 3) {
  const nonNegative = min >= 0;
  if (min === max) {
    const padding = min === 0 ? 1 : Math.abs(min) * 0.1;
    min -= padding;
    max += padding;
  }
  const raw = (max - min) / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw - 1e-12);
  let lo = Math.floor(min / step + 1e-9) * step;
  if (nonNegative) lo = Math.max(lo, 0);
  const hi = Math.ceil(max / step - 1e-9) * step;
  const ticks = [];
  for (let i = 0; lo + i * step <= hi + step / 1e6; i++) ticks.push(Math.round((lo + i * step) * 1e6) / 1e6);
  return { lo, hi, ticks };
}
