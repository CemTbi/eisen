// Training tab: the list of plans, the plan editor and the workout in progress.

import { emptyState, field, pageHead, sectionHead, tile, topbar } from '../components.js';
import { addExercises, exerciseCards } from '../editor.js';
import { MAX_NAME } from '../model.js';
import { startRest, stopRest } from '../rest.js';
import { back, navigate, rerender } from '../router.js';
import { weekSummary } from '../stats.js';
import {
  activeTotals, createRoutine, discardActive, duplicateRoutine, finishWorkout, getExercise, getPref, getRoutine,
  removeRoutine, save, saveActive, setPref, startWorkout, state,
} from '../store.js';
import { actionSheet, confirm, openSheet, toast } from '../ui.js';
import { fmtClock, fmtDuration, fmtKg, fmtRelative, h, icon, isIOS, isStandalone, plural } from '../util.js';

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

export function homeView() {
  return state.active ? activeView() : plansView();
}

// ---- plans ---------------------------------------------------------------------

function plansView() {
  const { routines, workouts } = state.data;

  const begin = (routine) => {
    startWorkout(routine);
    rerender({ top: true });
  };

  const create = () => navigate(`/routine/${createRoutine().id}`);

  const node = h('div', { class: 'page' },
    pageHead('Training', h('button', {
      class: 'icon-btn', 'aria-label': 'Einstellungen', onclick: () => navigate('/settings'),
    }, icon('settings', 24))),
    installHint(),
    weekCard(workouts),
    h('button', { class: 'btn btn-tint btn-block', onclick: () => begin(null) }, icon('plus', 18), 'Freies Training starten'),
    sectionHead('Meine Pläne', h('button', { class: 'btn-text', onclick: create }, icon('plus', 16), 'Neuer Plan')),
    routines.length
      ? routines.map((routine) => routineCard(routine, begin))
      : emptyState({
        iconName: 'dumbbell',
        title: 'Noch kein Trainingsplan',
        text: 'Leg einen Plan mit deinen Übungen, Sätzen und Gewichten an. Danach startest du ihn mit einem Tipp.',
        action: h('button', { class: 'btn btn-primary', onclick: create }, 'Plan erstellen'),
      }));
  return { node, tab: 'train' };
}

function weekCard(workouts) {
  const week = weekSummary(workouts);
  return h('section', { class: 'card week' },
    h('div', { class: 'week-text' },
      h('strong', null, plural(week.count, 'Training', 'Trainings')),
      h('span', { class: 'meta' }, 'diese Woche')),
    h('div', { class: 'week-days', 'aria-hidden': 'true' },
      WEEKDAYS.map((day, i) => h('div', {
        class: `week-day${week.days[i] ? ' on' : ''}${i === week.today ? ' today' : ''}`,
      }, h('i'), h('span', null, day)))));
}

function installHint() {
  if (!isIOS() || isStandalone() || getPref('installHint') === 'dismissed') return null;
  return h('aside', { class: 'banner' },
    h('div', null,
      h('strong', null, 'Als App installieren'),
      h('p', null, 'Tippe unten in Safari auf „Teilen“ und dann auf „Zum Home-Bildschirm“. '
        + 'Trag deine Daten erst in der installierten App ein: Sie hat einen eigenen Speicher.')),
    h('button', {
      class: 'icon-btn',
      'aria-label': 'Hinweis schließen',
      onclick: () => {
        setPref('installHint', 'dismissed');
        rerender();
      },
    }, icon('close', 18)));
}

function routineCard(routine, begin) {
  const name = routine.name || 'Unbenannter Plan';
  const sets = routine.items.reduce((sum, item) => sum + item.sets.length, 0);
  const last = state.data.workouts.find((w) => w.routineId === routine.id);
  const edit = () => navigate(`/routine/${routine.id}`);

  const menu = () => actionSheet({
    title: name,
    actions: [
      { label: 'Bearbeiten', icon: 'edit', onSelect: edit },
      {
        label: 'Duplizieren',
        icon: 'copy',
        onSelect: () => {
          duplicateRoutine(routine.id);
          rerender();
        },
      },
      {
        label: 'Löschen',
        icon: 'trash',
        danger: true,
        onSelect: async () => {
          const ok = await confirm({
            title: `„${name}“ löschen?`,
            message: 'Deine bisherigen Trainings bleiben im Verlauf erhalten.',
            confirmLabel: 'Plan löschen',
            danger: true,
          });
          if (!ok) return;
          removeRoutine(routine.id);
          rerender();
        },
      },
    ],
  });

  return h('article', { class: 'card routine' },
    h('div', { class: 'routine-head' },
      h('button', { class: 'routine-body', onclick: edit },
        h('span', { class: 'routine-name' }, name),
        h('span', { class: 'meta clamp-2' },
          routine.items.length
            ? routine.items.map((item) => getExercise(item.exerciseId).name).join(' · ')
            : 'Noch keine Übungen'),
        h('span', { class: 'meta dim' },
          [plural(routine.items.length, 'Übung', 'Übungen'), plural(sets, 'Satz', 'Sätze'), last && `zuletzt ${fmtRelative(last.start)}`]
            .filter(Boolean).join(' · '))),
      h('button', { class: 'icon-btn', 'aria-label': `Optionen für ${name}`, onclick: menu }, icon('more'))),
    routine.items.length
      ? h('button', { class: 'btn btn-primary btn-block', onclick: () => begin(routine) }, icon('play', 16), 'Training starten')
      : h('button', { class: 'btn btn-quiet btn-block', onclick: edit }, icon('plus', 16), 'Übungen hinzufügen'));
}

// ---- plan editor -----------------------------------------------------------------

export function routineView(id) {
  const routine = getRoutine(id);
  if (!routine) return { redirect: '/' };

  const ctx = { mode: 'routine', items: routine.items, changed: save, rerender };
  const nameInput = h('input', {
    class: 'title-input',
    type: 'text',
    value: routine.name,
    maxLength: MAX_NAME,
    placeholder: 'Name des Plans, z. B. Push',
    'aria-label': 'Name des Plans',
    autocomplete: 'off',
    enterkeyhint: 'done',
    oninput: (event) => {
      routine.name = event.target.value;
      save();
    },
  });

  const remove = async () => {
    const ok = await confirm({
      title: 'Plan löschen?',
      message: 'Deine bisherigen Trainings bleiben im Verlauf erhalten.',
      confirmLabel: 'Plan löschen',
      danger: true,
    });
    if (!ok) return;
    removeRoutine(routine.id);
    back('/');
  };

  const node = h('div', { class: 'page' },
    topbar({
      title: 'Trainingsplan',
      onBack: () => back('/'),
      backLabel: 'Pläne',
      right: h('button', { class: 'btn-text strong', onclick: () => back('/') }, 'Fertig'),
    }),
    nameInput,
    !routine.items.length && h('p', { class: 'hint' },
      'Füge Übungen hinzu und trag pro Satz dein Gewicht und deine Wiederholungen ein. Leere Felder kannst du später im Training füllen.'),
    exerciseCards(ctx),
    h('button', { class: 'btn btn-tint btn-block', onclick: () => addExercises(ctx) }, icon('plus', 18), 'Übung hinzufügen'),
    h('button', { class: 'btn btn-danger-quiet btn-block', onclick: remove }, 'Plan löschen'));

  return {
    node,
    tab: 'train',
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

// ---- workout in progress -----------------------------------------------------------

function activeView() {
  const active = state.active;
  const volume = h('strong');
  const sets = h('strong');
  const syncTotals = () => {
    const totals = activeTotals(active);
    volume.textContent = fmtKg(totals.volume);
    sets.textContent = `${totals.done} / ${totals.done + totals.open}`;
  };
  syncTotals();

  const ctx = {
    mode: 'active', items: active.items, changed: saveActive, rerender, onSetDone: startRest, onValues: syncTotals,
  };

  const discard = async () => {
    const ok = await confirm({
      title: 'Training verwerfen?',
      message: 'Alle Eingaben dieses Trainings gehen verloren.',
      confirmLabel: 'Verwerfen',
      danger: true,
    });
    if (!ok) return;
    stopRest();
    discardActive();
    rerender({ top: true });
  };

  const node = h('div', { class: 'page' },
    topbar({
      left: h('div', { class: 'clock', 'aria-label': 'Trainingsdauer' },
        icon('timer', 18), h('span', { dataset: { clock: '' } }, fmtClock(Date.now() - active.start))),
      right: h('button', { class: 'btn btn-primary btn-sm', onclick: finishDialog }, 'Beenden'),
    }),
    h('input', {
      class: 'title-input',
      type: 'text',
      value: active.name,
      maxLength: MAX_NAME,
      placeholder: 'Name des Trainings',
      'aria-label': 'Name des Trainings',
      autocomplete: 'off',
      enterkeyhint: 'done',
      oninput: (event) => {
        active.name = event.target.value;
        saveActive();
      },
    }),
    h('div', { class: 'live-stats' },
      h('div', null, h('span', { class: 'meta' }, 'Volumen'), volume),
      h('div', null, h('span', { class: 'meta' }, 'Sätze'), sets)),
    !active.items.length && h('p', { class: 'hint' },
      'Füge deine erste Übung hinzu. Hake jeden Satz ab, sobald du ihn geschafft hast: Nur abgehakte Sätze landen im Logbuch.'),
    exerciseCards(ctx),
    h('button', { class: 'btn btn-tint btn-block', onclick: () => addExercises(ctx) }, icon('plus', 18), 'Übung hinzufügen'),
    h('button', { class: 'btn btn-danger-quiet btn-block', onclick: discard }, 'Training verwerfen'));
  return { node, tab: 'train' };
}

async function finishDialog() {
  const active = state.active;
  const totals = activeTotals(active);

  if (!totals.done) {
    const ok = await confirm({
      title: 'Noch kein Satz abgehakt',
      message: 'Nur abgehakte Sätze werden gespeichert. Möchtest du das Training stattdessen verwerfen?',
      confirmLabel: 'Training verwerfen',
      cancelLabel: 'Weiter trainieren',
      danger: true,
    });
    if (!ok) return;
    stopRest();
    discardActive();
    rerender({ top: true });
    return;
  }

  const routine = active.routineId ? getRoutine(active.routineId) : null;
  const nameInput = h('input', {
    class: 'field', type: 'text', value: active.name, maxLength: MAX_NAME, placeholder: 'Name des Trainings', autocomplete: 'off',
  });
  const updatePlan = h('input', { type: 'checkbox' });

  const finish = () => {
    active.name = nameInput.value;
    stopRest();
    const workout = finishWorkout({ updateRoutine: updatePlan.checked });
    // Land on the saved workout, with the logbook one step back.
    navigate('/history', { replace: true });
    navigate(`/workout/${workout.id}`);
    toast('Training gespeichert');
  };

  const sheet = openSheet({
    title: 'Training beenden',
    variant: 'dialog',
    body: h('div', { class: 'stack' },
      h('div', { class: 'tiles tiles-3' },
        tile('Dauer', fmtDuration(Date.now() - active.start)),
        tile('Volumen', fmtKg(totals.volume)),
        tile('Sätze', String(totals.done))),
      totals.open > 0 && h('p', { class: 'note' },
        `${plural(totals.open, 'offener Satz wird', 'offene Sätze werden')} nicht gespeichert.`),
      field('Name', nameInput),
      routine && h('label', { class: 'check-row' },
        updatePlan,
        h('span', null, `Plan „${routine.name || 'Unbenannter Plan'}“ mit den Übungen und Werten von heute überschreiben`)),
      h('button', { class: 'btn btn-primary btn-block', onclick: finish }, 'Training speichern'),
      h('button', { class: 'action cancel', onclick: () => sheet.close() }, 'Weiter trainieren')),
  });
}
