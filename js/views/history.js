// Logbook tab: all finished workouts, one workout in detail, and its editor.

import { emptyState, field, pageHead, tile, topbar } from '../components.js';
import { addExercises, exerciseCards } from '../editor.js';
import { MAX_NAME } from '../model.js';
import { back, navigate, rerender } from '../router.js';
import { bestSet, workoutTotals } from '../stats.js';
import { getExercise, getWorkout, personalRecords, removeWorkout, routineFromWorkout, save, state } from '../store.js';
import { actionSheet, confirm, toast } from '../ui.js';
import {
  fmtDateLong, fmtDay, fmtDuration, fmtKg, fmtMonth, fmtSet, fromLocalInput, h, icon, parseNum, plural, toLocalInput,
} from '../util.js';

const PREVIEW_LINES = 4;
const PAGE = 40;
let shown = PAGE;

const monthKey = (ts) => {
  const date = new Date(ts);
  return date.getFullYear() * 12 + date.getMonth();
};

export function historyView() {
  const { workouts } = state.data;
  const node = h('div', { class: 'page' }, pageHead('Verlauf'));

  if (!workouts.length) {
    node.append(emptyState({
      iconName: 'history',
      title: 'Noch keine Trainings',
      text: 'Sobald du ein Training beendest, erscheint es hier mit allen Sätzen und Gewichten.',
    }));
    return { node, tab: 'history' };
  }

  const perMonth = new Map();
  for (const workout of workouts) perMonth.set(monthKey(workout.start), (perMonth.get(monthKey(workout.start)) ?? 0) + 1);

  let month = null;
  for (const workout of workouts.slice(0, shown)) {
    const key = monthKey(workout.start);
    if (key !== month) {
      month = key;
      node.append(h('div', { class: 'section-head' },
        h('h2', null, fmtMonth(workout.start)),
        h('span', { class: 'meta' }, plural(perMonth.get(key), 'Training', 'Trainings'))));
    }
    node.append(workoutCard(workout));
  }
  if (workouts.length > shown) {
    node.append(h('button', {
      class: 'btn btn-quiet btn-block more',
      onclick: () => {
        shown += PAGE;
        rerender();
      },
    }, 'Ältere Trainings anzeigen'));
  }
  return { node, tab: 'history' };
}

function statChip(iconName, text) {
  return h('span', { class: 'stat-chip' }, icon(iconName, 15), text);
}

function workoutCard(workout) {
  const totals = workoutTotals(workout);
  const prs = personalRecords().get(workout.id)?.size ?? 0;
  const extra = workout.items.length - PREVIEW_LINES;
  return h('button', { class: 'card workout-card', onclick: () => navigate(`/workout/${workout.id}`) },
    h('span', { class: 'wc-head' },
      h('span', { class: 'wc-name' }, workout.name),
      h('span', { class: 'meta' }, fmtDay(workout.start))),
    h('span', { class: 'wc-stats' },
      statChip('timer', fmtDuration(workout.end - workout.start)),
      statChip('dumbbell', fmtKg(totals.volume)),
      prs > 0 && statChip('trophy', plural(prs, 'Bestwert', 'Bestwerte'))),
    h('span', { class: 'wc-list' },
      workout.items.slice(0, PREVIEW_LINES).map((item) => h('span', { class: 'wc-line' },
        h('span', null, `${item.sets.length} × ${getExercise(item.exerciseId).name}`),
        h('span', { class: 'meta' }, fmtSet(bestSet(item.sets))))),
      extra > 0 && h('span', { class: 'meta' }, `+ ${plural(extra, 'weitere Übung', 'weitere Übungen')}`)));
}

// ---- one workout -------------------------------------------------------------------

export function workoutView(id) {
  const workout = getWorkout(id);
  if (!workout) return { redirect: '/history' };
  const totals = workoutTotals(workout);
  const prs = personalRecords().get(workout.id) ?? new Set();

  const menu = () => actionSheet({
    title: workout.name,
    actions: [
      { label: 'Bearbeiten', icon: 'edit', onSelect: () => navigate(`/workout/${workout.id}/edit`) },
      {
        label: 'Als Plan speichern',
        icon: 'copy',
        onSelect: () => {
          const routine = routineFromWorkout(workout);
          navigate(`/routine/${routine.id}`);
          toast('Plan aus Training erstellt');
        },
      },
      {
        label: 'Löschen',
        icon: 'trash',
        danger: true,
        onSelect: async () => {
          const ok = await confirm({
            title: 'Training löschen?',
            message: 'Es verschwindet aus dem Verlauf und aus allen Statistiken.',
            confirmLabel: 'Training löschen',
            danger: true,
          });
          if (!ok) return;
          removeWorkout(workout.id);
          back('/history');
        },
      },
    ],
  });

  const node = h('div', { class: 'page' },
    topbar({
      onBack: () => back('/history'),
      backLabel: 'Verlauf',
      right: h('button', { class: 'icon-btn', 'aria-label': 'Optionen', onclick: menu }, icon('more')),
    }),
    h('div', { class: 'detail-head' },
      h('h1', null, workout.name),
      h('p', { class: 'meta' }, fmtDateLong(workout.start))),
    h('div', { class: 'tiles tiles-3' },
      tile('Dauer', fmtDuration(workout.end - workout.start)),
      tile('Volumen', fmtKg(totals.volume)),
      tile('Sätze', String(totals.sets))),
    workout.items.map((item, i) => {
      const exercise = getExercise(item.exerciseId);
      return h('section', { class: 'card' },
        h('button', { class: 'ex-name link', onclick: () => navigate(`/exercise/${exercise.id}`) },
          exercise.name, icon('chevron', 16)),
        h('ol', { class: 'set-list' }, item.sets.map((set, j) => h('li', null,
          h('span', { class: 'set-index' }, String(j + 1)),
          h('span', { class: 'set-value' }, fmtSet(set)),
          prs.has(`${i}:${j}`) && h('span', { class: 'badge' }, icon('trophy', 13), 'Bestwert')))));
    }));
  return { node, tab: 'history' };
}

// ---- editing a logged workout ----------------------------------------------------------

export function workoutEditView(id) {
  const workout = getWorkout(id);
  if (!workout) return { redirect: '/history' };

  const ctx = { mode: 'workout', items: workout.items, changed: save, rerender };
  const done = () => back(`/workout/${workout.id}`);

  const nameInput = h('input', {
    class: 'field',
    type: 'text',
    value: workout.name,
    maxLength: MAX_NAME,
    autocomplete: 'off',
    enterkeyhint: 'done',
    oninput: (event) => {
      workout.name = event.target.value;
      save();
    },
  });
  const startInput = h('input', {
    class: 'field',
    type: 'datetime-local',
    value: toLocalInput(workout.start),
    max: toLocalInput(Date.now()),
    onchange: (event) => {
      const start = fromLocalInput(event.target.value);
      if (!start || start > Date.now()) {
        event.target.value = toLocalInput(workout.start);
        return;
      }
      workout.end = start + (workout.end - workout.start);
      workout.start = start;
      save();
    },
  });
  const durationInput = h('input', {
    class: 'field',
    type: 'text',
    inputmode: 'numeric',
    maxLength: 4,
    value: String(Math.max(1, Math.round((workout.end - workout.start) / 60_000))),
    autocomplete: 'off',
    enterkeyhint: 'done',
    oninput: (event) => {
      const minutes = parseNum(event.target.value);
      if (minutes == null || minutes < 1) return;
      workout.end = workout.start + Math.min(Math.floor(minutes), 1440) * 60_000;
      save();
    },
  });

  const node = h('div', { class: 'page' },
    topbar({
      title: 'Training bearbeiten',
      onBack: done,
      right: h('button', { class: 'btn-text strong', onclick: done }, 'Fertig'),
    }),
    h('div', { class: 'card stack' },
      field('Name', nameInput),
      h('div', { class: 'form-row' }, field('Beginn', startInput), field('Dauer (min)', durationInput))),
    exerciseCards(ctx),
    h('button', { class: 'btn btn-tint btn-block', onclick: () => addExercises(ctx) }, icon('plus', 18), 'Übung hinzufügen'));

  return {
    node,
    tab: 'history',
    leave: () => {
      if (!getWorkout(workout.id)) return;
      // A logged set needs reps; drop whatever was left half-filled.
      for (const item of workout.items) {
        item.sets = item.sets.filter((s) => s.reps).map((s) => ({ weight: s.weight || 0, reps: s.reps }));
      }
      workout.items = workout.items.filter((item) => item.sets.length);
      workout.name = workout.name.replace(/\s+/g, ' ').trim() || 'Training';
      if (workout.items.length) {
        save();
      } else {
        removeWorkout(workout.id);
        toast('Leeres Training gelöscht');
      }
    },
  };
}
