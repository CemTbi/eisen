// Overlays: bottom sheets, dialogs, action menus, confirmations and toasts.

import { t } from './i18n.js';
import { h, icon } from './util.js';

const openSheets = new Set();
let sequence = 0;

function syncLock() {
  document.documentElement.classList.toggle('sheet-open', openSheets.size > 0);
}

/**
 * Opens an overlay. variant: 'sheet' (bottom sheet), 'full' (tall bottom sheet
 * for lists) or 'dialog' (card near the top, used whenever the overlay has a
 * text field so the on-screen keyboard cannot cover it).
 */
export function openSheet({ title, body, variant = 'sheet', left, right, onClose }) {
  const titleId = `sheet-title-${++sequence}`;
  const panel = h('div', {
    class: `sheet sheet-${variant}`, role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId, tabindex: '-1',
  },
    variant !== 'dialog' && h('div', { class: 'sheet-grabber', 'aria-hidden': 'true' }),
    h('header', { class: 'sheet-head' },
      h('div', { class: 'sheet-side' }, left),
      h('h2', { id: titleId }, title),
      h('div', { class: 'sheet-side end' }, right)),
    h('div', { class: 'sheet-body' }, body));
  const backdrop = h('div', {
    class: `sheet-backdrop${variant === 'dialog' ? ' is-dialog' : ''}`,
    onclick: (event) => {
      if (event.target === backdrop) api.close();
    },
  }, panel);

  const opener = document.activeElement;
  let closed = false;
  const api = {
    el: panel,
    close({ immediate = false } = {}) {
      if (closed) return;
      closed = true;
      openSheets.delete(api);
      syncLock();
      backdrop.classList.remove('open');
      if (immediate) backdrop.remove();
      else setTimeout(() => backdrop.remove(), 240);
      // Hand focus back, but never to a text field: that would pop the keyboard.
      if (opener instanceof HTMLElement && opener.isConnected && !opener.matches('input, textarea, select')) {
        opener.focus({ preventScroll: true });
      }
      onClose?.();
    },
  };

  document.body.append(backdrop);
  openSheets.add(api);
  syncLock();
  void backdrop.offsetHeight; // commit the closed state so the transition runs
  backdrop.classList.add('open');
  panel.focus({ preventScroll: true });
  return api;
}

export function closeAllSheets() {
  for (const sheet of [...openSheets]) sheet.close({ immediate: true });
}

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || !openSheets.size) return;
  [...openSheets].at(-1).close();
});

/** Menu of actions: [{ label, icon, danger, onSelect }]. Falsy entries are skipped. */
export function actionSheet({ title, actions }) {
  const sheet = openSheet({
    title,
    body: h('div', { class: 'action-list' },
      actions.filter(Boolean).map((action) => h('button', {
        class: `action${action.danger ? ' danger' : ''}`,
        onclick: () => {
          sheet.close();
          action.onSelect();
        },
      }, action.icon && icon(action.icon, 20), action.label)),
      h('button', { class: 'action cancel', onclick: () => sheet.close() }, t('common.cancel'))),
  });
  return sheet;
}

/** Resolves true when the user confirms, false on cancel or dismissal. */
export function confirm({ title, message, confirmLabel, cancelLabel = t('common.cancel'), danger = false }) {
  return new Promise((resolve) => {
    let answer = false;
    const sheet = openSheet({
      title,
      onClose: () => resolve(answer),
      body: h('div', { class: 'action-list' },
        message && h('p', { class: 'sheet-text' }, message),
        h('button', {
          class: `btn btn-block ${danger ? 'btn-danger' : 'btn-primary'}`,
          onclick: () => {
            answer = true;
            sheet.close();
          },
        }, confirmLabel),
        h('button', { class: 'action cancel', onclick: () => sheet.close() }, cancelLabel)),
    });
  });
}

export function toast(message, { kind = 'info' } = {}) {
  const el = h('div', { class: `toast toast-${kind}` }, message);
  const host = document.getElementById('toasts');
  host.replaceChildren(el);
  setTimeout(() => el.classList.add('out'), 2400);
  setTimeout(() => el.remove(), 2800);
}
