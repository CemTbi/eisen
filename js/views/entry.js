// One logbook entry: what was done on one exercise on one day. Used both to
// add an entry (also for a past date, e.g. an old personal record) and to edit one.

import { field, topbar } from '../components.js';
import { blankSet, setTable } from '../editor.js';
import { t } from '../i18n.js';
import { loggedSets } from '../model.js';
import { back, navigate, rerender } from '../router.js';
import { addLog, getExercise, getLog, lastLog, personalRecords, removeLog, updateLog } from '../store.js';
import { confirm, toast } from '../ui.js';
import { fmtDay, fromDateInput, h, icon, toDateInput } from '../util.js';

// The entry being typed. It lives outside the view so adding a row (which
// redraws) does not lose it; it is dropped when the page is left.
let draft = null;
let preset = null;

const copySets = (sets) => sets.map((s) => ({ weight: s.weight || null, reps: s.reps ?? null }));

/** Opens a new entry for the exercise, optionally starting from the given sets (e.g. a plan's). */
export function openNewEntry(exerciseId, sets = null) {
  draft = null;
  preset = sets?.length ? copySets(sets) : null;
  navigate(`/log/${exerciseId}/new`);
}

function newDraft(key, exerciseId, entry) {
  if (entry) return { key, date: toDateInput(entry.date), sets: copySets(entry.sets), note: null };
  if (preset) return { key, date: toDateInput(Date.now()), sets: preset, note: t('entry.fromPlan') };
  const last = lastLog(exerciseId);
  if (last) {
    return { key, date: toDateInput(Date.now()), sets: copySets(last.sets), note: t('entry.fromLast', { date: fmtDay(last.date) }) };
  }
  return { key, date: toDateInput(Date.now()), sets: [blankSet(), blankSet(), blankSet()], note: null };
}

export function entryView(exerciseId, entryId) {
  const exercise = getExercise(exerciseId);
  if (!exercise) return { redirect: '/exercises' };
  const entry = entryId === 'new' ? null : getLog(entryId);
  const home = `/exercise/${exerciseId}`;
  if (entryId !== 'new' && entry?.exerciseId !== exerciseId) return { redirect: home };

  const key = `${exerciseId}/${entryId}`;
  if (draft?.key !== key) draft = newDraft(key, exerciseId, entry);
  preset = null;
  const current = draft;

  const submit = () => {
    const sets = loggedSets(current.sets);
    if (!sets.length) {
      toast(t('entry.needSet'));
      return;
    }
    // Editing without touching the day keeps the entry's original time.
    const date = entry && current.date === toDateInput(entry.date) ? entry.date : fromDateInput(current.date);
    if (!date) {
      dateInput.focus();
      return;
    }
    const saved = entry ? updateLog(entry.id, { date, sets }) : addLog({ exerciseId, date, sets });
    const record = personalRecords().has(saved.id);
    back(home);
    toast(t(record ? 'entry.savedPr' : 'entry.saved'));
  };

  const remove = async () => {
    const ok = await confirm({ title: t('entry.delete.title'), confirmLabel: t('entry.delete'), danger: true });
    if (!ok) return;
    removeLog(entry.id);
    back(home);
    toast(t('entry.deleted'));
  };

  const dateInput = h('input', {
    class: 'field',
    type: 'date',
    value: current.date,
    max: toDateInput(Date.now()),
    onchange: (event) => {
      if (fromDateInput(event.target.value)) current.date = event.target.value;
      else event.target.value = current.date;
    },
  });

  const node = h('div', { class: 'page' },
    topbar({
      title: t(entry ? 'entry.edit' : 'entry.new'),
      onBack: () => back(home),
      backLabel: t('common.cancel'),
      right: h('button', { class: 'btn-text strong', onclick: submit }, t('common.save')),
    }),
    h('div', { class: 'detail-head' }, h('h1', null, exercise.name)),
    current.note && h('p', { class: 'hint' }, current.note),
    h('div', { class: 'card' }, field(t('entry.date'), dateInput)),
    h('section', { class: 'card ex-card' },
      setTable({ sets: current.sets, name: exercise.name, changed: () => {}, rerender }),
      h('button', {
        class: 'btn btn-quiet btn-block btn-sm',
        onclick: () => {
          // A new row repeats the last one: sets usually differ only a little.
          current.sets.push(current.sets.length ? { ...current.sets.at(-1) } : blankSet());
          rerender();
        },
      }, icon('plus', 16), t('entry.addSet'))),
    h('button', { class: 'btn btn-primary btn-block', onclick: submit }, t('entry.save')),
    entry && h('button', { class: 'btn btn-danger-quiet btn-block', onclick: remove }, t('entry.delete')));

  return {
    node,
    tab: 'log',
    leave: () => {
      draft = null;
    },
  };
}
