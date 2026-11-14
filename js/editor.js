// The set table: rows of weight and reps. Used by the plan editor (one card
// per exercise) and by the logbook entry page.
//
// Typing never redraws the view (that would close the keyboard); only adding
// or removing rows calls rerender().

import { t } from './i18n.js';
import { pickExercises } from './picker.js';
import { navigate } from './router.js';
import { placeholders } from './stats.js';
import { getExercise } from './store.js';
import { actionSheet } from './ui.js';
import { fmtInput, h, icon, parseReps, parseWeight } from './util.js';

export const blankSet = () => ({ weight: null, reps: null });

/**
 * Editable rows for sets. With hints on, an empty field shows in grey the value
 * of the set above it (in a plan, an empty set means "same as above").
 */
export function setTable({ sets, name, changed, rerender, hints = false }) {
  const rows = [];
  const refreshHints = () => {
    if (!hints) return;
    const values = placeholders(sets, null);
    rows.forEach((row, i) => {
      row.weight.placeholder = fmtInput(values[i].weight);
      row.reps.placeholder = fmtInput(values[i].reps);
    });
  };

  const numberField = (set, i, key) => h('input', {
    class: 'num',
    type: 'text',
    inputmode: key === 'weight' ? 'decimal' : 'numeric',
    autocomplete: 'off',
    enterkeyhint: 'done',
    maxLength: 7,
    value: fmtInput(set[key]),
    'aria-label': `${t(key === 'weight' ? 'set.weightAria' : 'set.repsAria', { n: i + 1 })}, ${name}`,
    onfocus: (event) => {
      const input = event.target;
      setTimeout(() => {
        if (document.activeElement === input) input.select();
      }, 0);
    },
    oninput: (event) => {
      set[key] = key === 'weight' ? parseWeight(event.target.value) : parseReps(event.target.value);
      changed();
      refreshHints();
    },
    onblur: (event) => {
      event.target.value = fmtInput(set[key]);
    },
  });

  sets.forEach((set, i) => {
    const weight = numberField(set, i, 'weight');
    const reps = numberField(set, i, 'reps');
    rows.push({
      weight,
      reps,
      el: h('div', { class: 'set-row' },
        h('span', { class: 'set-no' }, String(i + 1)),
        weight,
        reps,
        h('button', {
          class: 'set-del',
          'aria-label': `${t('set.deleteAria', { n: i + 1 })}, ${name}`,
          onclick: () => {
            sets.splice(i, 1);
            changed();
            rerender();
          },
        }, icon('close', 18))),
    });
  });
  refreshHints();

  return h('div', { class: 'set-grid' },
    sets.length > 0 && h('div', { class: 'set-row set-head', 'aria-hidden': 'true' },
      h('span', null, t('set.header')), h('span', null, t('set.weight')), h('span', null, t('set.reps')), h('span')),
    rows.map((row) => row.el));
}

// ---- plan editor -----------------------------------------------------------------
// ctx = { items, changed(), rerender(), onLog(item) }

/** Opens the picker and appends the chosen exercises with three empty sets each. */
export async function addExercises(ctx) {
  const ids = await pickExercises();
  if (!ids?.length) return;
  for (const id of ids) ctx.items.push({ exerciseId: id, sets: [blankSet(), blankSet(), blankSet()] });
  ctx.changed();
  ctx.rerender();
}

export function exerciseCards(ctx) {
  return ctx.items.map((item, index) => exerciseCard(ctx, item, index));
}

function exerciseCard(ctx, item, index) {
  const { items } = ctx;
  const exercise = getExercise(item.exerciseId);
  const commit = () => {
    ctx.changed();
    ctx.rerender();
  };
  const move = (delta) => {
    items.splice(index + delta, 0, items.splice(index, 1)[0]);
    commit();
  };
  const open = () => navigate(`/exercise/${exercise.id}`);

  const menu = () => actionSheet({
    title: exercise.name,
    actions: [
      { label: t('card.stats'), icon: 'chart', onSelect: open },
      index > 0 && { label: t('card.up'), icon: 'up', onSelect: () => move(-1) },
      index < items.length - 1 && { label: t('card.down'), icon: 'down', onSelect: () => move(1) },
      {
        label: t('card.replace'),
        icon: 'swap',
        onSelect: async () => {
          const ids = await pickExercises({ title: t('picker.replace'), multiple: false });
          if (!ids) return;
          item.exerciseId = ids[0];
          commit();
        },
      },
      {
        label: t('card.remove'),
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
      h('button', { class: 'ex-name', onclick: open }, exercise.name),
      h('button', {
        class: 'icon-btn', 'aria-label': t('common.optionsFor', { name: exercise.name }), onclick: menu,
      }, icon('more'))),
    setTable({ sets: item.sets, name: exercise.name, changed: ctx.changed, rerender: ctx.rerender, hints: true }),
    h('div', { class: 'card-actions' },
      h('button', {
        class: 'btn btn-quiet btn-sm',
        onclick: () => {
          item.sets.push(blankSet());
          commit();
        },
      }, icon('plus', 16), t('plan.addSet')),
      h('button', { class: 'btn btn-tint btn-sm', onclick: () => ctx.onLog(item) }, icon('book', 16), t('plan.log'))));
}
