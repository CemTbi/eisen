// Plans tab: the list of training plans and the plan editor.

import { emptyState, pageHead, topbar } from '../components.js';
import { addExercises, exerciseCards } from '../editor.js';
import { t } from '../i18n.js';
import { MAX_NAME } from '../model.js';
import { back, navigate, rerender } from '../router.js';
import { placeholders } from '../stats.js';
import { createRoutine, duplicateRoutine, getExercise, getPref, getRoutine, removeRoutine, save, setPref, state } from '../store.js';
import { actionSheet, confirm } from '../ui.js';
import { count, h, icon, isIOS, isStandalone } from '../util.js';
import { openNewEntry } from './entry.js';

export function plansView() {
  const { routines } = state.data;
  const create = () => navigate(`/routine/${createRoutine().id}`);

  const node = h('div', { class: 'page' },
    pageHead(t('plans.title'), h('button', {
      class: 'icon-btn accent', 'aria-label': t('plans.new'), onclick: create,
    }, icon('plus', 26))),
    installHint(),
    routines.length
      ? routines.map(routineCard)
      : emptyState({
        iconName: 'list',
        title: t('plans.empty.title'),
        text: t('plans.empty.text'),
        action: h('button', { class: 'btn btn-primary', onclick: create }, t('plans.create')),
      }));
  return { node, tab: 'plans' };
}

function installHint() {
  if (!isIOS() || isStandalone() || getPref('installHint') === 'dismissed') return null;
  return h('aside', { class: 'banner' },
    h('div', null, h('strong', null, t('install.title')), h('p', null, t('install.text'))),
    h('button', {
      class: 'icon-btn',
      'aria-label': t('install.dismiss'),
      onclick: () => {
        setPref('installHint', 'dismissed');
        rerender();
      },
    }, icon('close', 18)));
}

const confirmDelete = (name) => confirm({
  title: t('plans.delete.title', { name }),
  message: t('plans.delete.text'),
  confirmLabel: t('plans.delete.confirm'),
  danger: true,
});

function routineCard(routine) {
  const name = routine.name || t('plans.unnamed');
  const sets = routine.items.reduce((sum, item) => sum + item.sets.length, 0);
  const edit = () => navigate(`/routine/${routine.id}`);

  const menu = () => actionSheet({
    title: name,
    actions: [
      { label: t('common.edit'), icon: 'edit', onSelect: edit },
      {
        label: t('common.duplicate'),
        icon: 'copy',
        onSelect: () => {
          duplicateRoutine(routine.id);
          rerender();
        },
      },
      {
        label: t('common.delete'),
        icon: 'trash',
        danger: true,
        onSelect: async () => {
          if (!await confirmDelete(name)) return;
          removeRoutine(routine.id);
          rerender();
        },
      },
    ],
  });

  return h('article', { class: 'card routine' },
    h('button', { class: 'routine-body', onclick: edit },
      h('span', { class: 'routine-name' }, name),
      h('span', { class: 'meta clamp-2' },
        routine.items.length
          ? routine.items.map((item) => getExercise(item.exerciseId).name).join(' · ')
          : t('plans.noExercises')),
      h('span', { class: 'meta dim' }, `${count(routine.items.length, 'n.exercises')} · ${count(sets, 'n.sets')}`)),
    h('button', { class: 'icon-btn', 'aria-label': t('common.optionsFor', { name }), onclick: menu }, icon('more')));
}

// ---- plan editor -----------------------------------------------------------------

export function routineView(id) {
  const routine = getRoutine(id);
  if (!routine) return { redirect: '/' };

  const ctx = {
    items: routine.items,
    changed: save,
    rerender,
    // Logging from a plan starts the entry with the plan's values ("same as above" filled in).
    onLog: (item) => {
      const hints = placeholders(item.sets, null);
      openNewEntry(item.exerciseId, item.sets.map((set, i) => ({
        weight: set.weight ?? hints[i].weight, reps: set.reps ?? hints[i].reps,
      })));
    },
  };

  const nameInput = h('input', {
    class: 'title-input',
    type: 'text',
    value: routine.name,
    maxLength: MAX_NAME,
    placeholder: t('plan.namePlaceholder'),
    'aria-label': t('plan.name'),
    autocomplete: 'off',
    enterkeyhint: 'done',
    oninput: (event) => {
      routine.name = event.target.value;
      save();
    },
  });

  const remove = async () => {
    if (!await confirmDelete(routine.name || t('plans.unnamed'))) return;
    removeRoutine(routine.id);
    back('/');
  };

  const node = h('div', { class: 'page' },
    topbar({
      title: t('plan.title'),
      onBack: () => back('/'),
      backLabel: t('tab.plans'),
      right: h('button', { class: 'btn-text strong', onclick: () => back('/') }, t('common.done')),
    }),
    nameInput,
    !routine.items.length && h('p', { class: 'hint' }, t('plan.hint')),
    exerciseCards(ctx),
    h('button', { class: 'btn btn-primary btn-block', onclick: () => addExercises(ctx) }, icon('plus', 18), t('plan.addExercise')),
    h('button', { class: 'btn btn-danger-quiet btn-block', onclick: remove }, t('plan.delete')));

  return {
    node,
    tab: 'plans',
    mounted: () => {
      if (!routine.name && !routine.items.length) nameInput.focus();
    },
    leave: () => {
      if (!getRoutine(routine.id)) return;
      routine.name = routine.name.replace(/\s+/g, ' ').trim();
      // A plan that was opened and left completely empty was never wanted.
      if (!routine.name && !routine.items.length) removeRoutine(routine.id);
      else save();
    },
  };
}
