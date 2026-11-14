// Small building blocks shared by the views.

import { h, icon } from './util.js';

/** Compact sticky bar for sub-pages: back button, title, optional action. */
export function topbar({ title = '', onBack, backLabel = 'Zurück', left, right }) {
  return h('header', { class: 'topbar' },
    h('div', { class: 'topbar-side' },
      onBack && h('button', { class: 'topbar-back', onclick: onBack }, icon('back', 22), backLabel),
      left),
    h('div', { class: 'topbar-title' }, title),
    h('div', { class: 'topbar-side end' }, right));
}

/** Large title for the three main tabs. */
export function pageHead(title, right) {
  return h('header', { class: 'page-head' }, h('h1', null, title), right);
}

export function sectionHead(title, right) {
  return h('div', { class: 'section-head' }, h('h2', null, title), right);
}

export function emptyState({ iconName, title, text, action }) {
  return h('div', { class: 'empty' },
    iconName && h('div', { class: 'empty-icon' }, icon(iconName, 28)),
    h('h3', null, title),
    text && h('p', null, text),
    action);
}

export function tile(label, value, sub) {
  return h('div', { class: 'tile' },
    h('div', { class: 'tile-label' }, label),
    h('div', { class: 'tile-value' }, value),
    sub && h('div', { class: 'tile-sub' }, sub));
}

/**
 * Single-choice chip row. With allLabel set, a leading chip selects "no filter"
 * (value null).
 */
export function chips({ options, value, onChange, allLabel = null, label }) {
  const el = h('div', { class: 'chips', role: 'group', 'aria-label': label });
  const entries = allLabel ? [null, ...options] : options;
  const draw = () => el.replaceChildren(...entries.map((option) => h('button', {
    class: `chip${option === value ? ' on' : ''}`,
    'aria-pressed': String(option === value),
    onclick: () => {
      value = option;
      draw();
      onChange(option);
    },
  }, option ?? allLabel)));
  draw();
  return el;
}

/** Segmented control: options are [{ value, label }]. */
export function segmented({ options, value, onChange, label }) {
  return h('div', { class: 'segmented', role: 'group', 'aria-label': label },
    options.map((option) => h('button', {
      class: option.value === value ? 'on' : '',
      'aria-pressed': String(option.value === value),
      onclick: () => {
        if (option.value !== value) onChange(option.value);
      },
    }, option.label)));
}

export function field(label, control) {
  return h('label', { class: 'form-field' }, h('span', { class: 'form-label' }, label), control);
}
