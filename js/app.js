// Entry point: loads the data, builds the shell (view, rest timer, tab bar)
// and wires up the routes.

import { restBar, tickRest } from './rest.js';
import { navigate, route, start } from './router.js';
import { load, onStorageError, state } from './store.js';
import { toast } from './ui.js';
import { fmtClock, h, icon } from './util.js';
import { exerciseView, exercisesView } from './views/exercises.js';
import { historyView, workoutEditView, workoutView } from './views/history.js';
import { homeView, routineView } from './views/home.js';
import { settingsView } from './views/settings.js';

const TABS = [
  { id: 'train', path: '/', label: 'Training', icon: 'dumbbell' },
  { id: 'history', path: '/history', label: 'Verlauf', icon: 'history' },
  { id: 'exercises', path: '/exercises', label: 'Übungen', icon: 'chart' },
];

onStorageError(() => toast('Speichern fehlgeschlagen. Ist der Gerätespeicher voll?', { kind: 'error' }));
load();

const view = h('main', { id: 'view' });
const tabbar = h('nav', { class: 'tabbar', 'aria-label': 'Hauptnavigation' },
  TABS.map((tab) => h('button', {
    class: 'tab',
    dataset: { tab: tab.id },
    onclick: () => navigate(tab.path, { replace: true }),
  }, icon(tab.icon, 24), h('span', null, tab.label))));
document.getElementById('app').append(view, restBar(), tabbar);

route(/^\/$/, homeView);
route(/^\/routine\/([\w-]+)$/, routineView);
route(/^\/history$/, historyView);
route(/^\/workout\/([\w-]+)$/, workoutView);
route(/^\/workout\/([\w-]+)\/edit$/, workoutEditView);
route(/^\/exercises$/, exercisesView);
route(/^\/exercise\/([\w-]+)$/, exerciseView);
route(/^\/settings$/, settingsView);

function tick() {
  if (state.active) {
    const clock = document.querySelector('[data-clock]');
    if (clock) clock.textContent = fmtClock(Date.now() - state.active.start);
  }
  tickRest();
}

start({
  view,
  onRender: ({ tab }) => {
    for (const button of tabbar.children) {
      const on = button.dataset.tab === tab;
      button.classList.toggle('on', on);
      if (on) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    }
    // A dot on the Training tab shows that a workout is running.
    tabbar.firstElementChild.classList.toggle('live', !!state.active);
    tick();
  },
});

setInterval(tick, 250);
document.addEventListener('visibilitychange', tick);

// Ask the browser not to evict the logbook under storage pressure.
navigator.storage?.persist?.().catch(() => {});

const local = ['localhost', '127.0.0.1'].includes(window.location.hostname);
if ('serviceWorker' in navigator && (window.location.protocol === 'https:' || local)) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
