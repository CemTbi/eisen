// Entry point: loads the data, builds the shell (view and tab bar) and wires
// up the routes.

import { applyAppearance } from './appearance.js';
import { t } from './i18n.js';
import { navigate, route, start } from './router.js';
import { load, onStorageError } from './store.js';
import { toast } from './ui.js';
import { h, icon } from './util.js';
import { entryView } from './views/entry.js';
import { exerciseView, exercisesView } from './views/exercises.js';
import { plansView, routineView } from './views/home.js';
import { settingsView } from './views/settings.js';

const TABS = [
  { id: 'plans', path: '/', icon: 'list' },
  { id: 'log', path: '/exercises', icon: 'book' },
  { id: 'settings', path: '/settings', icon: 'settings' },
];

onStorageError(() => toast(t('error.storage'), { kind: 'error' }));
load();
applyAppearance();

const view = h('main', { id: 'view' });
const tabbar = h('nav', { class: 'tabbar' },
  TABS.map((tab) => h('button', {
    class: 'tab',
    dataset: { tab: tab.id },
    onclick: () => navigate(tab.path, { replace: true }),
  }, icon(tab.icon, 24), h('span'))));
document.getElementById('app').append(view, tabbar);

route(/^\/$/, plansView);
route(/^\/routine\/([\w-]+)$/, routineView);
route(/^\/exercises$/, exercisesView);
route(/^\/exercise\/([\w-]+)$/, exerciseView);
route(/^\/log\/([\w-]+)\/([\w-]+)$/, entryView);
route(/^\/settings$/, settingsView);

start({
  view,
  onRender: ({ tab }) => {
    for (const button of tabbar.children) {
      const on = button.dataset.tab === tab;
      button.classList.toggle('on', on);
      // Labels are set on every render so a language change shows at once.
      button.lastElementChild.textContent = t(`tab.${button.dataset.tab}`);
      if (on) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    }
  },
});

// Ask the browser not to evict the logbook under storage pressure.
navigator.storage?.persist?.().catch(() => {});

const local = ['localhost', '127.0.0.1'].includes(window.location.hostname);
if ('serviceWorker' in navigator && (window.location.protocol === 'https:' || local)) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
