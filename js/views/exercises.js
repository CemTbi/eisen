// Logbook tab: every exercise with what you last lifted and your best, and
// the page of a single exercise with its records, progress chart and entries.

import { lineChart } from '../chart.js';
import { muscleFigure, musclesOf } from '../figure.js';
import { chips, emptyState, pageHead, sectionHead, segmented, tile, topbar } from '../components.js';
import { t } from '../i18n.js';
import { MUSCLES } from '../library.js';
import { exerciseForm, muscleName } from '../picker.js';
import { back, navigate, rerender } from '../router.js';
import { exerciseSessions, summarize } from '../stats.js';
import { allExercises, getExercise, overview, personalRecords, removeExercise, sessions as allSessions } from '../store.js';
import { actionSheet, confirm, toast } from '../ui.js';
import { DAY, fmtDay, fmtKg, fmtNum, fmtNum1, fmtRelative, fmtReps, fmtSet, fold, h, icon, setChildren } from '../util.js';
import { openNewEntry } from './entry.js';

// Filters survive navigating into an exercise and back.
const filter = { query: '', muscle: null };
const chartPrefs = { metric: null, days: 0 };
const ENTRIES_SHOWN = 15;
let expanded = null; // id of the exercise whose full entry list is open

export function exercisesView() {
  const list = h('div', { class: 'ex-list' });

  const row = (exercise, stats) => h('button', { class: 'row', onclick: () => navigate(`/exercise/${exercise.id}`) },
    exerciseThumb(exercise),
    h('span', { class: 'row-main' },
      h('span', { class: 'row-title' }, exercise.name),
      h('span', { class: 'meta' },
        stats ? `${muscleName(exercise.muscle)} · ${fmtRelative(stats.lastDate)}` : muscleName(exercise.muscle))),
    stats && h('span', { class: 'row-side' },
      h('span', { class: 'row-value' }, fmtSet(stats.lastTop)),
      h('span', { class: 'meta' },
        t('log.best', { value: stats.maxWeight > 0 ? fmtKg(stats.maxWeight) : fmtReps(stats.maxReps) }))),
    h('span', { class: 'row-chevron' }, icon('chevron', 16)));

  const draw = () => {
    const needle = fold(filter.query);
    const stats = overview();
    const matches = allExercises()
      .filter((e) => (!filter.muscle || e.muscle === filter.muscle) && (!needle || fold(e.name).includes(needle)));
    const logged = matches.filter((e) => stats.has(e.id)).sort((a, b) => stats.get(b.id).lastDate - stats.get(a.id).lastDate);
    const others = matches.filter((e) => !stats.has(e.id));
    setChildren(list,
      logged.length > 0 && sectionHead(t('log.yours')),
      logged.length > 0 && h('div', { class: 'list' }, logged.map((e) => row(e, stats.get(e.id)))),
      others.length > 0 && sectionHead(t(logged.length ? 'log.others' : 'log.allExercises')),
      others.length > 0 && h('div', { class: 'list' }, others.map((e) => row(e, null))),
      !matches.length && emptyState({ iconName: 'search', title: t('log.none.title'), text: t('log.none.text') }),
    );
  };
  draw();

  const create = async () => {
    const exercise = await exerciseForm({ muscle: filter.muscle });
    if (exercise) navigate(`/exercise/${exercise.id}`);
  };

  const node = h('div', { class: 'page' },
    pageHead(t('log.title'), h('button', {
      class: 'icon-btn accent', 'aria-label': t('log.newExercise'), onclick: create,
    }, icon('plus', 26))),
    h('input', {
      class: 'field search',
      type: 'text',
      inputmode: 'search',
      value: filter.query,
      placeholder: t('picker.search'),
      'aria-label': t('picker.search'),
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
      allLabel: t('common.all'),
      label: t('form.muscle'),
      labelOf: muscleName,
      onChange: (value) => {
        filter.muscle = value;
        draw();
      },
    }),
    list);
  return { node, tab: 'log' };
}

const muscleNames = (keys) => keys.map((key) => t(`m.${key}`)).join(', ');

/** Small picture for list rows. The row's text already names the exercise, so it is decorative. */
export function exerciseThumb(exercise) {
  const figure = muscleFigure(musclesOf(exercise), '');
  figure.setAttribute('aria-hidden', 'true');
  return figure;
}

/** The picture with the names of the muscles next to it. */
function muscleCard(exercise) {
  const muscles = musclesOf(exercise);
  if (!muscles.primary.length) return null;
  const all = muscleNames([...muscles.primary, ...muscles.secondary]);
  return h('section', { class: 'card muscle-card' },
    muscleFigure(muscles, t('figure.aria', { muscles: all }), { sculpted: true }),
    h('div', { class: 'muscle-legend' },
      h('div', null,
        h('span', { class: 'legend-key primary' }, t('figure.primary')),
        h('strong', null, muscleNames(muscles.primary))),
      muscles.secondary.length > 0 && h('div', null,
        h('span', { class: 'legend-key secondary' }, t('figure.secondary')),
        h('span', null, muscleNames(muscles.secondary)))));
}

// ---- one exercise ------------------------------------------------------------------------

const METRICS = {
  weight: { get: (s) => s.maxWeight, fmt: fmtKg },
  e1rm: { get: (s) => s.e1rm, fmt: (v) => `${fmtNum1(v)} kg` },
  volume: { get: (s) => s.volume, fmt: fmtKg },
  reps: { get: (s) => s.maxReps, fmt: fmtReps },
  totalReps: { get: (s) => s.totalReps, fmt: fmtReps },
};

export function exerciseView(id) {
  const exercise = getExercise(id);
  if (!exercise) return { redirect: '/exercises' };
  const entries = exerciseSessions(allSessions(), id);
  const summary = summarize(entries);

  const menu = () => actionSheet({
    title: exercise.name,
    actions: [
      {
        label: t('common.edit'),
        icon: 'edit',
        onSelect: async () => {
          if (await exerciseForm({ exercise })) rerender();
        },
      },
      {
        label: t('common.delete'),
        icon: 'trash',
        danger: true,
        onSelect: async () => {
          const ok = await confirm({
            title: t('detail.delete.title', { name: exercise.name }), confirmLabel: t('detail.delete.confirm'), danger: true,
          });
          if (!ok) return;
          if (removeExercise(exercise.id)) back('/exercises');
          else toast(t('detail.inUse'));
        },
      },
    ],
  });

  const addButton = () => h('button', { class: 'btn btn-primary btn-block', onclick: () => openNewEntry(id) },
    icon('plus', 18), t('detail.addEntry'));

  const node = h('div', { class: 'page' },
    topbar({
      onBack: () => back('/exercises'),
      backLabel: t('tab.log'),
      right: h('button', { class: 'icon-btn', 'aria-label': t('common.options'), onclick: menu }, icon('more')),
    }),
    h('div', { class: 'detail-head' },
      h('h1', null, exercise.name),
      h('p', { class: 'meta' }, muscleName(exercise.muscle))));

  node.append(muscleCard(exercise) ?? '');
  if (!summary) {
    node.append(emptyState({
      iconName: 'book', title: t('detail.empty.title'), text: t('detail.empty.text'), action: addButton(),
    }));
    return { node, tab: 'log' };
  }

  const record = (label, entry, fmt) => tile(t(label), fmt(entry.value), fmtDay(entry.date));
  node.append(
    addButton(),
    h('div', { class: 'tiles' },
      summary.weighted
        ? [
          record('detail.maxWeight', summary.maxWeight, fmtKg),
          record('detail.e1rm', summary.e1rm, METRICS.e1rm.fmt),
          record('detail.bestVolume', summary.volume, fmtKg),
        ]
        : [
          record('detail.maxRepsSet', summary.maxReps, fmtReps),
          record('detail.maxRepsEntry', summary.totalReps, fmtReps),
        ],
      tile(t('detail.entries'), fmtNum(summary.count), t('detail.last', { when: fmtRelative(summary.last.date) }))),
    progressCard(entries, summary.weighted),
    sectionHead(t('detail.allEntries')));

  const records = personalRecords();
  const all = expanded === id || entries.length <= ENTRIES_SHOWN;
  for (const entry of [...entries].reverse().slice(0, all ? entries.length : ENTRIES_SHOWN)) {
    node.append(h('button', {
      class: 'card entry',
      'aria-label': `${t('entry.edit')}: ${fmtDay(entry.date)}`,
      onclick: () => navigate(`/log/${id}/${entry.workoutId}`),
    },
      h('span', { class: 'entry-head' }, fmtDay(entry.date), icon('edit', 16)),
      h('span', { class: 'set-list' }, entry.sets.map((set, i) => h('span', null,
        h('span', { class: 'set-index' }, String(i + 1)),
        h('span', { class: 'set-value' }, fmtSet(set)),
        records.get(entry.workoutId) === i && h('span', { class: 'badge' }, icon('trophy', 13), t('detail.pr')))))));
  }
  if (!all) {
    node.append(h('button', {
      class: 'btn btn-quiet btn-block more',
      onclick: () => {
        expanded = id;
        rerender();
      },
    }, t('detail.showAll', { n: entries.length })));
  }
  return { node, tab: 'log' };
}

function progressCard(entries, weighted) {
  const metrics = weighted ? ['weight', 'e1rm', 'volume'] : ['reps', 'totalReps'];
  if (!metrics.includes(chartPrefs.metric)) chartPrefs.metric = metrics[0];
  const metric = METRICS[chartPrefs.metric];
  const title = t(`metric.${chartPrefs.metric}.title`);

  const since = chartPrefs.days ? Date.now() - chartPrefs.days * DAY : 0;
  const points = entries.filter((s) => s.date >= since).map((s) => ({ t: s.date, v: metric.get(s) }));

  let headline = null;
  let body = h('p', { class: 'chart-empty' }, t('chart.empty'));
  if (points.length) {
    const first = points[0];
    const last = points.at(-1);
    const change = last.v - first.v;
    headline = h('div', { class: 'chart-headline' },
      h('strong', null, metric.fmt(last.v)),
      points.length > 1 && h('span', { class: 'meta' },
        change === 0
          ? t('chart.unchanged', { date: fmtDay(first.t) })
          : t('chart.change', { delta: `${change > 0 ? '+' : '−'}${metric.fmt(Math.abs(change))}`, date: fmtDay(first.t) })));
    body = lineChart({
      points,
      fmtValue: metric.fmt,
      fmtDate: (ts) => fmtDay(ts),
      label: t('chart.aria', { title, n: points.length, last: metric.fmt(last.v) }),
    });
  }

  return h('section', { class: 'card chart-card' },
    segmented({
      options: metrics.map((key) => ({ value: key, label: t(`metric.${key}`) })),
      value: chartPrefs.metric,
      label: t('chart.metric'),
      onChange: (value) => {
        chartPrefs.metric = value;
        rerender();
      },
    }),
    h('div', { class: 'chart-title' }, h('span', { class: 'meta' }, title), headline),
    body,
    segmented({
      options: [{ value: 90, label: t('range.3m') }, { value: 365, label: t('range.1y') }, { value: 0, label: t('range.all') }],
      value: chartPrefs.days,
      label: t('chart.range'),
      onChange: (value) => {
        chartPrefs.days = value;
        rerender();
      },
    }));
}
