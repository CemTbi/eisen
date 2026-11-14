// Exercises tab: the overview of what you lift on which exercise, and the
// progress page of a single exercise.

import { lineChart } from '../chart.js';
import { chips, emptyState, pageHead, sectionHead, segmented, tile, topbar } from '../components.js';
import { MUSCLES } from '../library.js';
import { exerciseForm } from '../picker.js';
import { back, navigate, rerender } from '../router.js';
import { exerciseSessions, summarize } from '../stats.js';
import { getExercise, overview, removeExercise, sortedExercises, state } from '../store.js';
import { actionSheet, confirm, toast } from '../ui.js';
import { DAY, fmtDay, fmtKg, fmtNum, fmtNum1, fmtRelative, fmtSet, fold, h, icon, plural, setChildren } from '../util.js';

// Filters survive navigating into an exercise and back.
const filter = { query: '', muscle: null };
const chartPrefs = { metric: null, days: 0 };
const SESSIONS_SHOWN = 15;
let expanded = null; // id of the exercise whose full session list is open

export function exercisesView() {
  const list = h('div', { class: 'ex-list' });

  const row = (exercise, stats) => h('button', { class: 'row', onclick: () => navigate(`/exercise/${exercise.id}`) },
    h('span', { class: 'row-main' },
      h('span', { class: 'row-title' }, exercise.name),
      h('span', { class: 'meta' }, stats ? `${exercise.muscle} · ${fmtRelative(stats.lastDate)}` : exercise.muscle)),
    stats && h('span', { class: 'row-side' },
      h('span', { class: 'row-value' }, fmtSet(stats.lastTop)),
      h('span', { class: 'meta' }, stats.maxWeight > 0 ? `Bestwert ${fmtKg(stats.maxWeight)}` : `Bestwert ${stats.maxReps} Wdh.`)),
    h('span', { class: 'row-chevron' }, icon('chevron', 16)));

  const draw = () => {
    const needle = fold(filter.query);
    const stats = overview();
    const matches = sortedExercises()
      .filter((e) => (!filter.muscle || e.muscle === filter.muscle) && (!needle || fold(e.name).includes(needle)));
    const trained = matches.filter((e) => stats.has(e.id)).sort((a, b) => stats.get(b.id).lastDate - stats.get(a.id).lastDate);
    const others = matches.filter((e) => !stats.has(e.id));
    setChildren(list,
      trained.length > 0 && sectionHead('Deine Übungen'),
      trained.length > 0 && h('div', { class: 'list' }, trained.map((e) => row(e, stats.get(e.id)))),
      others.length > 0 && sectionHead(trained.length ? 'Weitere Übungen' : 'Alle Übungen'),
      others.length > 0 && h('div', { class: 'list' }, others.map((e) => row(e, null))),
      !matches.length && emptyState({ iconName: 'search', title: 'Keine Übung gefunden', text: 'Ändere die Suche oder leg die Übung neu an.' }),
    );
  };
  draw();

  const create = async () => {
    const exercise = await exerciseForm({ muscle: filter.muscle });
    if (exercise) rerender();
  };

  const node = h('div', { class: 'page' },
    pageHead('Übungen', h('button', { class: 'icon-btn accent', 'aria-label': 'Neue Übung', onclick: create }, icon('plus', 26))),
    h('input', {
      class: 'field search',
      type: 'text',
      inputmode: 'search',
      value: filter.query,
      placeholder: 'Übung suchen',
      'aria-label': 'Übung suchen',
      autocomplete: 'off',
      enterkeyhint: 'search',
      oninput: (event) => {
        filter.query = event.target.value;
        draw();
      },
    }),
    chips({
      options: MUSCLES,
      value: filter.muscle,
      allLabel: 'Alle',
      label: 'Muskelgruppe',
      onChange: (value) => {
        filter.muscle = value;
        draw();
      },
    }),
    list);
  return { node, tab: 'exercises' };
}

// ---- one exercise ------------------------------------------------------------------------

const METRICS = {
  weight: { label: 'Gewicht', title: 'Höchstes Gewicht pro Training', get: (s) => s.maxWeight, fmt: fmtKg },
  e1rm: { label: '1RM', title: 'Geschätztes 1RM pro Training', get: (s) => s.e1rm, fmt: (v) => `${fmtNum1(v)} kg` },
  volume: { label: 'Volumen', title: 'Volumen pro Training', get: (s) => s.volume, fmt: fmtKg },
  reps: { label: 'Max. Wdh.', title: 'Meiste Wiederholungen in einem Satz', get: (s) => s.maxReps, fmt: (v) => `${fmtNum(v)} Wdh.` },
  totalReps: { label: 'Wdh. gesamt', title: 'Wiederholungen pro Training', get: (s) => s.totalReps, fmt: (v) => `${fmtNum(v)} Wdh.` },
};

const RANGES = [{ value: 90, label: '3 Monate' }, { value: 365, label: '1 Jahr' }, { value: 0, label: 'Alles' }];

export function exerciseView(id) {
  const exercise = getExercise(id);
  if (!exercise.id) return { redirect: '/exercises' };
  const sessions = exerciseSessions(state.data.workouts, id);
  const summary = summarize(sessions);

  const menu = () => actionSheet({
    title: exercise.name,
    actions: [
      {
        label: 'Bearbeiten',
        icon: 'edit',
        onSelect: async () => {
          if (await exerciseForm({ exercise })) rerender();
        },
      },
      {
        label: 'Löschen',
        icon: 'trash',
        danger: true,
        onSelect: async () => {
          const ok = await confirm({ title: `„${exercise.name}“ löschen?`, confirmLabel: 'Übung löschen', danger: true });
          if (!ok) return;
          if (removeExercise(exercise.id)) back('/exercises');
          else toast('Die Übung wird in Plänen oder Trainings verwendet.');
        },
      },
    ],
  });

  const node = h('div', { class: 'page' },
    topbar({
      onBack: () => back('/exercises'),
      backLabel: 'Übungen',
      right: h('button', { class: 'icon-btn', 'aria-label': 'Optionen', onclick: menu }, icon('more')),
    }),
    h('div', { class: 'detail-head' },
      h('h1', null, exercise.name),
      h('p', { class: 'meta' }, exercise.muscle)));

  if (!summary) {
    node.append(emptyState({
      iconName: 'chart',
      title: 'Noch keine Daten',
      text: 'Sobald du diese Übung in einem Training abhakst, siehst du hier deinen Fortschritt.',
    }));
    return { node, tab: 'exercises' };
  }

  const record = (label, entry, fmt) => tile(label, fmt(entry.value), fmtDay(entry.date));
  node.append(h('div', { class: 'tiles' },
    summary.weighted
      ? [
        record('Höchstes Gewicht', summary.maxWeight, fmtKg),
        record('Geschätztes 1RM', summary.e1rm, METRICS.e1rm.fmt),
        record('Bestes Volumen', summary.volume, fmtKg),
      ]
      : [
        record('Meiste Wdh. (Satz)', summary.maxReps, METRICS.reps.fmt),
        record('Meiste Wdh. (Training)', summary.totalReps, METRICS.totalReps.fmt),
      ],
    tile('Trainings', fmtNum(summary.count), `zuletzt ${fmtRelative(summary.last.date)}`)));

  node.append(progressCard(sessions, summary.weighted));

  node.append(sectionHead('Alle Trainings'));
  const all = expanded === id || sessions.length <= SESSIONS_SHOWN;
  for (const session of [...sessions].reverse().slice(0, all ? sessions.length : SESSIONS_SHOWN)) {
    node.append(h('section', { class: 'card' },
      h('button', { class: 'ex-name link', onclick: () => navigate(`/workout/${session.workoutId}`) },
        h('span', null, fmtDay(session.date), h('span', { class: 'meta' }, ` · ${session.name}`)),
        icon('chevron', 16)),
      h('ol', { class: 'set-list' }, session.sets.map((set, i) => h('li', null,
        h('span', { class: 'set-index' }, String(i + 1)),
        h('span', { class: 'set-value' }, fmtSet(set)),
        set === session.top && session.sets.length > 1 && h('span', { class: 'badge quiet' }, 'Top-Satz'))))));
  }
  if (!all) {
    node.append(h('button', {
      class: 'btn btn-quiet btn-block more',
      onclick: () => {
        expanded = id;
        rerender();
      },
    }, `Alle ${sessions.length} Trainings anzeigen`));
  }
  return { node, tab: 'exercises' };
}

function progressCard(sessions, weighted) {
  const metrics = weighted ? ['weight', 'e1rm', 'volume'] : ['reps', 'totalReps'];
  if (!metrics.includes(chartPrefs.metric)) chartPrefs.metric = metrics[0];
  const metric = METRICS[chartPrefs.metric];

  const since = chartPrefs.days ? Date.now() - chartPrefs.days * DAY : 0;
  const points = sessions.filter((s) => s.date >= since).map((s) => ({ t: s.date, v: metric.get(s) }));

  let headline = null;
  let body = h('p', { class: 'chart-empty' }, 'In diesem Zeitraum hast du diese Übung nicht trainiert.');
  if (points.length) {
    const first = points[0];
    const last = points.at(-1);
    const change = last.v - first.v;
    headline = h('div', { class: 'chart-headline' },
      h('strong', null, metric.fmt(last.v)),
      points.length > 1 && h('span', { class: 'meta' },
        change === 0
          ? `unverändert seit ${fmtDay(first.t)}`
          : `${change > 0 ? '+' : '−'}${metric.fmt(Math.abs(change))} seit ${fmtDay(first.t)}`));
    body = lineChart({
      points,
      fmtValue: metric.fmt,
      fmtDate: (t) => fmtDay(t),
      label: `${metric.title}: ${points.length} Trainings, zuletzt ${metric.fmt(last.v)}. Mit den Pfeiltasten durch die Trainings blättern.`,
    });
  }

  return h('section', { class: 'card chart-card' },
    segmented({
      options: metrics.map((key) => ({ value: key, label: METRICS[key].label })),
      value: chartPrefs.metric,
      label: 'Kennzahl',
      onChange: (value) => {
        chartPrefs.metric = value;
        rerender();
      },
    }),
    h('div', { class: 'chart-title' }, h('span', { class: 'meta' }, metric.title), headline),
    body,
    segmented({
      options: RANGES,
      value: chartPrefs.days,
      label: 'Zeitraum',
      onChange: (value) => {
        chartPrefs.days = value;
        rerender();
      },
    }));
}
