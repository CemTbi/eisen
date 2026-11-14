// Weight picker: two scroll wheels (whole kilograms and quarter steps) in a
// bottom sheet. The wheels are plain scroll containers with scroll snapping,
// so they get the phone's native momentum scrolling.

import { getLang, t } from './i18n.js';
import { openSheet } from './ui.js';
import { fmtInput, h } from './util.js';

const ROW = 44; // px, must match .wheel-item in styles.css
const MAX_KG = 500;
const FRACTIONS = [0, 0.25, 0.5, 0.75];

function wheel(labels, index, ariaLabel) {
  const el = h('div', { class: 'wheel-col', tabindex: '0', role: 'listbox', 'aria-label': ariaLabel },
    labels.map((label) => h('div', { class: 'wheel-item', role: 'option' }, label)));
  const selected = () => Math.min(labels.length - 1, Math.max(0, Math.round(el.scrollTop / ROW)));
  let marked = -1;
  const mark = () => {
    const now = selected();
    if (now === marked) return;
    el.children[marked]?.classList.remove('on');
    el.children[marked]?.removeAttribute('aria-selected');
    el.children[now].classList.add('on');
    el.children[now].setAttribute('aria-selected', 'true');
    marked = now;
  };
  el.addEventListener('scroll', mark, { passive: true });
  el.addEventListener('keydown', (event) => {
    const step = { ArrowDown: 1, ArrowUp: -1, PageDown: 5, PageUp: -5 }[event.key];
    if (!step) return;
    event.preventDefault();
    el.scrollTop = (selected() + step) * ROW;
  });
  // Tapping a row above or below the middle moves the wheel to it.
  el.addEventListener('click', (event) => {
    const item = event.target.closest('.wheel-item');
    if (item) el.scrollTo({ top: [...el.children].indexOf(item) * ROW, behavior: 'smooth' });
  });
  return {
    el,
    selected,
    place: () => {
      el.scrollTop = index * ROW;
      mark();
    },
  };
}

/**
 * Asks for a weight in kg. Resolves with the number, with null when the user
 * cleared the field, or with undefined when the sheet was dismissed.
 * start is where the wheels stand when there is no value yet.
 */
export function pickWeight({ title, value, start = 20 }) {
  return new Promise((resolve) => {
    let result;
    const initial = Math.min(value ?? start ?? 20, MAX_KG + 0.75);
    const mark = getLang() === 'de' ? ',' : '.';
    const kg = wheel(Array.from({ length: MAX_KG + 1 }, (_, i) => String(i)), Math.floor(initial), t('wheel.kg'));
    const fraction = wheel(
      FRACTIONS.map((f) => mark + String(f * 100).padStart(2, '0')),
      Math.min(FRACTIONS.length - 1, Math.round((initial % 1) * 4)),
      t('wheel.fraction'),
    );

    const sheet = openSheet({
      title,
      left: h('button', { class: 'btn-text', onclick: () => sheet.close() }, t('common.cancel')),
      right: h('button', {
        class: 'btn-text strong',
        onclick: () => {
          result = kg.selected() + FRACTIONS[fraction.selected()];
          sheet.close();
        },
      }, t('common.done')),
      onClose: () => resolve(result),
      body: [
        h('div', { class: 'wheel' },
          h('div', { class: 'wheel-band', 'aria-hidden': 'true' }),
          kg.el,
          fraction.el,
          h('span', { class: 'wheel-unit' }, 'kg')),
        value != null && h('button', {
          class: 'action cancel',
          onclick: () => {
            result = null;
            sheet.close();
          },
        }, t('wheel.clear', { value: `${fmtInput(value)} kg` })),
      ],
    });
    kg.place();
    fraction.place();
  });
}
