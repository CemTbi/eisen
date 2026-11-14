// The set table: one card per exercise with a row per set. Shared by the
// workout in progress ('active'), the plan editor ('routine') and the editor
// for a logged workout ('workout').
//
// ctx = { mode, items, changed(), rerender(), onSetDone?(), onValues?() }
// Typing never redraws the view (that would close the keyboard); only
// structural changes call ctx.rerender().

import { pickExercises } from './picker.js';
import { primeAudio } from './rest.js';
import { navigate } from './router.js';
import { lastSets, placeholders } from './stats.js';
import { getExercise, state } from './store.js';
import { actionSheet, toast } from './ui.js';
import { fmtInput, fmtNum, h, icon, parseReps, parseWeight } from './util.js';

const blankSet = (mode) => (mode === 'active'
  ? { weight: null, reps: null, done: false, tw: null, tr: null }
  : { weight: null, reps: null });

const fmtPrevious = (set) => (set.weight > 0 ? `${fmtNum(set.weight)} × ${set.reps}` : `${set.reps} Wdh.`);

/** Opens the picker and appends the chosen exercises. */
export async function addExercises(ctx) {
  const ids = await pickExercises();
  if (!ids?.length) return;
  for (const id of ids) {
    // In a workout, start with as many sets as last time.
    const count = ctx.mode === 'workout' ? 1 : (ctx.mode === 'active' && lastSets(state.data.workouts, id)?.length) || 3;
    ctx.items.push({ exerciseId: id, sets: Array.from({ length: count }, () => blankSet(ctx.mode)) });
  }
  ctx.changed();
  ctx.rerender();
}

export function exerciseCards(ctx) {
  return ctx.items.map((item, index) => exerciseCard(ctx, item, index));
}

function exerciseCard(ctx, item, index) {
  const { mode, items } = ctx;
  const active = mode === 'active';
  const exercise = getExercise(item.exerciseId);
  const previous = active ? lastSets(state.data.workouts, item.exerciseId) : null;
  const rows = [];

  const commit = () => {
    ctx.changed();
    ctx.rerender();
  };

  // A logged workout has no targets, so its empty fields stay blank.
  const hints = () => (mode === 'workout' ? [] : placeholders(item.sets, previous));

  const refreshHints = () => {
    const values = hints();
    rows.forEach((row, i) => {
      row.weight.placeholder = fmtInput(values[i]?.weight);
      row.reps.placeholder = fmtInput(values[i]?.reps);
    });
  };

  const syncDone = (i) => {
    rows[i].el.classList.toggle('done', item.sets[i].done);
    rows[i].check.setAttribute('aria-pressed', String(item.sets[i].done));
  };

  const toggleDone = (i) => {
    const set = item.sets[i];
    primeAudio();
    if (set.done) {
      set.done = false;
      commit();
      return;
    }
    // Ticking an empty set accepts the grey suggestion.
    const hint = hints()[i];
    set.weight ??= hint.weight;
    set.reps ??= hint.reps;
    if (!set.reps) {
      rows[i].weight.value = fmtInput(set.weight);
      ctx.changed();
      toast('Trag zuerst die Wiederholungen ein.');
      rows[i].reps.focus();
      return;
    }
    set.done = true;
    ctx.onSetDone?.();
    commit();
  };

  const removeSet = (i) => {
    item.sets.splice(i, 1);
    commit();
  };

  const numberField = (set, i, key) => h('input', {
    class: 'num',
    type: 'text',
    inputmode: key === 'weight' ? 'decimal' : 'numeric',
    autocomplete: 'off',
    enterkeyhint: 'done',
    maxLength: 7,
    value: fmtInput(set[key]),
    'aria-label': `${key === 'weight' ? 'Gewicht in kg' : 'Wiederholungen'}, Satz ${i + 1}, ${exercise.name}`,
    onfocus: (event) => {
      const input = event.target;
      setTimeout(() => {
        if (document.activeElement === input) input.select();
      }, 0);
    },
    oninput: (event) => {
      set[key] = key === 'weight' ? parseWeight(event.target.value) : parseReps(event.target.value);
      if (active && set.done && !set.reps) {
        set.done = false;
        syncDone(i);
      }
      ctx.changed();
      refreshHints();
      ctx.onValues?.();
    },
    onblur: (event) => {
      event.target.value = fmtInput(set[key]);
    },
  });

  item.sets.forEach((set, i) => {
    const prev = previous?.[i];
    const weight = numberField(set, i, 'weight');
    const reps = numberField(set, i, 'reps');
    const check = active && h('button', {
      class: 'check',
      'aria-label': `Satz ${i + 1} abhaken, ${exercise.name}`,
      'aria-pressed': String(!!set.done),
      onclick: () => toggleDone(i),
    }, icon('check', 20));
    const el = h('div', { class: `set-row${set.done ? ' done' : ''}` },
      h('button', {
        class: 'set-no',
        'aria-label': `Satz ${i + 1}, Optionen`,
        onclick: () => actionSheet({
          title: `Satz ${i + 1} · ${exercise.name}`,
          actions: [{ label: 'Satz löschen', icon: 'trash', danger: true, onSelect: () => removeSet(i) }],
        }),
      }, String(i + 1)),
      active && h('button', {
        class: 'set-prev',
        disabled: !prev,
        'aria-label': prev ? `Werte vom letzten Mal übernehmen: ${fmtPrevious(prev)}` : 'Kein Wert vom letzten Mal',
        onclick: () => {
          set.weight = prev.weight || null;
          set.reps = prev.reps;
          commit();
        },
      }, prev ? fmtPrevious(prev) : '–'),
      weight,
      reps,
      active ? check : h('button', {
        class: 'set-del', 'aria-label': `Satz ${i + 1} löschen`, onclick: () => removeSet(i),
      }, icon('close', 18)));
    rows.push({ el, weight, reps, check });
  });
  refreshHints();

  const move = (delta) => {
    items.splice(index + delta, 0, items.splice(index, 1)[0]);
    commit();
  };

  const menu = () => actionSheet({
    title: exercise.name,
    actions: [
      { label: 'Statistik ansehen', icon: 'chart', onSelect: () => navigate(`/exercise/${exercise.id}`) },
      index > 0 && { label: 'Nach oben schieben', icon: 'up', onSelect: () => move(-1) },
      index < items.length - 1 && { label: 'Nach unten schieben', icon: 'down', onSelect: () => move(1) },
      {
        label: 'Übung ersetzen',
        icon: 'swap',
        onSelect: async () => {
          const ids = await pickExercises({ title: 'Übung ersetzen', multiple: false });
          if (!ids) return;
          item.exerciseId = ids[0];
          commit();
        },
      },
      {
        label: 'Übung entfernen',
        icon: 'trash',
        danger: true,
        onSelect: () => {
          items.splice(index, 1);
          commit();
        },
      },
    ],
  });

  return h('section', { class: 'card ex-card', 'aria-label': exercise.name },
    h('div', { class: 'ex-head' },
      h('button', { class: 'ex-name', onclick: () => navigate(`/exercise/${exercise.id}`) }, exercise.name),
      h('button', { class: 'icon-btn', 'aria-label': `Optionen für ${exercise.name}`, onclick: menu }, icon('more'))),
    h('div', { class: `set-grid ${active ? 'cols-active' : 'cols-plan'}` },
      item.sets.length > 0 && h('div', { class: 'set-row set-head', 'aria-hidden': 'true' },
        h('span', null, 'Satz'),
        active && h('span', null, 'Vorher'),
        h('span', null, 'kg'),
        h('span', null, 'Wdh.'),
        h('span', null, active && icon('check', 14))),
      rows.map((row) => row.el)),
    h('button', {
      class: 'btn btn-quiet btn-block btn-sm',
      onclick: () => {
        item.sets.push(blankSet(mode));
        commit();
      },
    }, icon('plus', 16), 'Satz hinzufügen'));
}
