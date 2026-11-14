// Single-series line chart drawn as SVG. It redraws to the pixel width of its
// container, so text is never scaled. Touch or hover shows a crosshair that
// snaps to the nearest session; arrow keys step through the points.

import { niceScale } from './stats.js';
import { fmtNum, h } from './util.js';

const SVG = 'http://www.w3.org/2000/svg';

function s(tag, attrs, ...children) {
  const el = document.createElementNS(SVG, tag);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
  el.append(...children);
  return el;
}

const HEIGHT = 190;
const MAX_MARKERS = 24;

/**
 * points: [{ t: timestamp, v: number }] sorted by t, at least one.
 * fmtValue / fmtDate turn a value / timestamp into tooltip text.
 */
export function lineChart({ points, fmtValue, fmtDate, label }) {
  const tipValue = h('strong');
  const tipDate = h('span');
  const tip = h('div', { class: 'chart-tip', hidden: true }, tipValue, tipDate);
  const wrap = h('div', { class: 'chart', tabindex: '0', role: 'group', 'aria-label': label });
  let select = () => {};
  let selected = -1;
  let hideTimer = 0;

  function draw() {
    const width = Math.floor(wrap.clientWidth);
    if (!width) return;
    const values = points.map((p) => p.v);
    const { lo, hi, ticks } = niceScale(Math.min(...values), Math.max(...values));
    const tickLabels = ticks.map(fmtNum);
    const margin = { top: 12, right: 12, bottom: 26, left: Math.max(...tickLabels.map((t) => t.length)) * 7 + 14 };
    const innerW = width - margin.left - margin.right;
    const innerH = HEIGHT - margin.top - margin.bottom;
    const t0 = points[0].t;
    const t1 = points.at(-1).t;
    const x = (t) => margin.left + (t1 === t0 ? innerW / 2 : ((t - t0) / (t1 - t0)) * innerW);
    const y = (v) => margin.top + (1 - (v - lo) / (hi - lo)) * innerH;
    const px = points.map((p) => x(p.t));
    const py = points.map((p) => y(p.v));
    const base = margin.top + innerH;

    const svg = s('svg', { width, height: HEIGHT, viewBox: `0 0 ${width} ${HEIGHT}`, 'aria-hidden': 'true' });
    ticks.forEach((tick, i) => {
      svg.append(
        s('line', { class: 'chart-grid', x1: margin.left, x2: width - margin.right, y1: y(tick), y2: y(tick) }),
        s('text', { class: 'chart-tick', x: margin.left - 8, y: y(tick), dy: '0.32em', 'text-anchor': 'end' }, tickLabels[i]),
      );
    });

    if (points.length === 1) {
      svg.append(s('text', { class: 'chart-tick', x: px[0], y: HEIGHT - 6, 'text-anchor': 'middle' }, fmtDate(t0)));
    } else {
      svg.append(
        s('text', { class: 'chart-tick', x: margin.left, y: HEIGHT - 6 }, fmtDate(t0)),
        s('text', { class: 'chart-tick', x: width - margin.right, y: HEIGHT - 6, 'text-anchor': 'end' }, fmtDate(t1)),
      );
      const path = px.map((value, i) => `${i ? 'L' : 'M'}${value.toFixed(1)} ${py[i].toFixed(1)}`).join('');
      svg.append(
        s('path', { class: 'chart-area', d: `${path}L${px.at(-1).toFixed(1)} ${base}L${px[0].toFixed(1)} ${base}Z` }),
        s('path', { class: 'chart-line', d: path }),
      );
    }

    const crosshair = s('line', { class: 'chart-cross', y1: margin.top, y2: base, visibility: 'hidden' });
    svg.append(crosshair);
    const markers = points.length <= MAX_MARKERS ? points.map((_, i) => i) : [points.length - 1];
    for (const i of markers) svg.append(s('circle', { class: 'chart-dot', cx: px[i], cy: py[i], r: 4 }));
    const focus = s('circle', { class: 'chart-dot chart-focus', r: 5.5, visibility: 'hidden' });
    svg.append(focus);

    select = (i) => {
      selected = i;
      const on = i >= 0;
      crosshair.setAttribute('visibility', on ? 'visible' : 'hidden');
      focus.setAttribute('visibility', on ? 'visible' : 'hidden');
      tip.hidden = !on;
      if (!on) return;
      crosshair.setAttribute('x1', px[i]);
      crosshair.setAttribute('x2', px[i]);
      focus.setAttribute('cx', px[i]);
      focus.setAttribute('cy', py[i]);
      tipValue.textContent = fmtValue(points[i].v);
      tipDate.textContent = fmtDate(points[i].t);
      const left = Math.min(Math.max(px[i] - tip.offsetWidth / 2, 0), width - tip.offsetWidth);
      // Above the point when there is room, otherwise below it.
      const above = py[i] - tip.offsetHeight - 12;
      tip.style.left = `${left}px`;
      tip.style.top = `${above >= 0 ? above : py[i] + 14}px`;
    };

    const nearest = (clientX) => {
      const offset = clientX - svg.getBoundingClientRect().left;
      let best = 0;
      for (let i = 1; i < px.length; i++) if (Math.abs(px[i] - offset) < Math.abs(px[best] - offset)) best = i;
      return best;
    };
    const track = (event) => {
      clearTimeout(hideTimer);
      select(nearest(event.clientX));
    };
    svg.addEventListener('pointerdown', track);
    svg.addEventListener('pointermove', track);
    svg.addEventListener('pointerleave', () => select(-1));
    svg.addEventListener('pointercancel', () => select(-1));
    svg.addEventListener('pointerup', (event) => {
      if (event.pointerType !== 'mouse') hideTimer = setTimeout(() => select(-1), 2500);
    });

    wrap.replaceChildren(svg, tip);
    select(-1);
  }

  wrap.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      const step = event.key === 'ArrowRight' ? 1 : -1;
      select(selected < 0 ? points.length - 1 : Math.min(points.length - 1, Math.max(0, selected + step)));
    } else if (event.key === 'Escape') {
      select(-1);
    }
  });
  wrap.addEventListener('blur', () => select(-1));

  new ResizeObserver(draw).observe(wrap);
  return wrap;
}
