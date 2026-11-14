// Hash router. Each view is a function that returns
//   { node, tab?, leave?, mounted? }  or  { redirect: '/path' }.
// History entries carry their depth in history.state, so "back" knows whether
// there is an in-app page to return to (also after the iOS edge-swipe gesture).

import { closeAllSheets } from './ui.js';

const routes = [];
const scrollMemory = new Map();
let host = null;
let afterRender = () => {};
let current = null;

export function route(pattern, view) {
  routes.push({ pattern, view });
}

export const currentPath = () => decodeURI(window.location.hash.slice(1)) || '/';

const depth = () => window.history.state?.i ?? 0;

export function navigate(path, { replace = false } = {}) {
  scrollMemory.set(currentPath(), window.scrollY);
  if (replace) window.history.replaceState({ i: depth() }, '', `#${path}`);
  else window.history.pushState({ i: depth() + 1 }, '', `#${path}`);
  render('top');
}

/** Goes back one page; falls back to the given path when the app was opened on this page. */
export function back(fallback = '/') {
  if (depth() > 0) window.history.back();
  else navigate(fallback, { replace: true });
}

/** Redraws the current view, keeping the scroll position unless top is set. */
export function rerender({ top = false } = {}) {
  render(top ? 'top' : 'keep');
}

function resolve(path) {
  for (const { pattern, view } of routes) {
    const match = pattern.exec(path);
    if (match) return view(...match.slice(1));
  }
  return { redirect: '/' };
}

function render(scroll) {
  closeAllSheets();
  let path = currentPath();
  if (current && current.path !== path) current.leave?.();

  let result = resolve(path);
  for (let hops = 0; result.redirect && hops < 3; hops++) {
    path = result.redirect;
    window.history.replaceState({ i: depth() }, '', `#${path}`);
    result = resolve(path);
  }

  const y = scroll === 'keep' ? window.scrollY : scroll === 'restore' ? scrollMemory.get(path) ?? 0 : 0;
  host.replaceChildren(result.node);
  current = { path, leave: result.leave };
  afterRender(result);
  window.scrollTo(0, y);
  result.mounted?.();
}

export function start({ view, onRender }) {
  host = view;
  afterRender = onRender;
  if (!window.history.state) window.history.replaceState({ i: 0 }, '', window.location.hash || '#/');
  window.addEventListener('popstate', () => render('restore'));
  // A typed or pasted #link: browsers differ on whether popstate covers it.
  window.addEventListener('hashchange', () => {
    if (current?.path !== currentPath()) render('top');
  });
  render('top');
}
