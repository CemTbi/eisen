// The picture of an exercise: a body seen from the front and from behind,
// with the trained muscles coloured. Drawn here from simple shapes, so it works
// for every exercise (also custom ones), in every theme, and offline.

import { BUILTIN_EXERCISES } from './library.js';

const SVG = 'http://www.w3.org/2000/svg';

// Shapes of the left half of each view on a 100 × 214 canvas; `pair` shapes
// are mirrored to the right. [muscle, kind, ...numbers]:
//   r = rounded rect (x, y, width, height, radius)   e = ellipse (cx, cy, rx, ry)
//   p = polygon (x1, y1, x2, y2, ...)
const SHARED = [
  [null, 'e', 50, 15, 10, 11], // head
  [null, 'r', 45.5, 25, 9, 8, 2], // neck
  [null, 'pair', 'e', 17, 113, 4.5, 5], // hands
  [null, 'pair', 'e', 40.5, 209, 6.5, 3.5], // feet
  ['shoulders', 'pair', 'e', 25, 41, 8.5, 7.5],
  ['forearms', 'pair', 'r', 11.5, 77, 10.5, 31, 5],
  ['calves', 'pair', 'r', 35.5, 163, 10.5, 41, 5],
];

const FRONT = [
  ...SHARED,
  ['chest', 'pair', 'r', 33.5, 36, 15.5, 19, 5],
  ['biceps', 'pair', 'r', 15.5, 49, 10.5, 26, 5],
  ['abs', 'pair', 'r', 41.5, 58, 7.5, 11, 2.5],
  ['abs', 'pair', 'r', 41.5, 71, 7.5, 11, 2.5],
  ['abs', 'pair', 'r', 41.5, 84, 7.5, 13, 2.5],
  ['obliques', 'pair', 'r', 33.5, 58, 6, 39, 3],
  [null, 'r', 35, 100, 30, 8, 3], // hips
  ['quads', 'pair', 'r', 33.5, 111, 12, 48, 6],
  ['adductors', 'pair', 'r', 46.5, 111, 3, 30, 1.5],
];

const BACK = [
  ...SHARED,
  ['traps', 'p', 50, 32, 65, 40, 50, 66, 35, 40],
  ['lats', 'pair', 'p', 34, 47, 47.5, 70, 47.5, 88, 36, 80],
  ['lowerback', 'r', 41, 82, 18, 16, 3],
  ['triceps', 'pair', 'r', 15.5, 49, 10.5, 26, 5],
  ['glutes', 'pair', 'r', 33.5, 100, 15.5, 19, 6],
  ['hamstrings', 'pair', 'r', 33.5, 121, 13.5, 38, 6],
];

export const MUSCLE_KEYS = [...new Set([...FRONT, ...BACK].map((shape) => shape[0]).filter(Boolean))];

function node(tag, attrs) {
  const el = document.createElementNS(SVG, tag);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
  return el;
}

function draw(kind, n, mirror) {
  const x = (value) => (mirror ? 100 - value : value);
  if (kind === 'e') return node('ellipse', { cx: x(n[0]), cy: n[1], rx: n[2], ry: n[3] });
  if (kind === 'r') return node('rect', { x: mirror ? 100 - n[0] - n[2] : n[0], y: n[1], width: n[2], height: n[3], rx: n[4] });
  const points = [];
  for (let i = 0; i < n.length; i += 2) points.push(`${x(n[i])},${n[i + 1]}`);
  return node('polygon', { points: points.join(' ') });
}

function view(shapes, offset, level) {
  const group = node('g', { transform: `translate(${offset} 0)` });
  for (const [muscle, ...rest] of shapes) {
    const pair = rest[0] === 'pair';
    const [kind, ...numbers] = pair ? rest.slice(1) : rest;
    for (const mirror of pair ? [false, true] : [false]) {
      const shape = draw(kind, numbers, mirror);
      shape.setAttribute('class', `fig-part ${level(muscle)}`.trim());
      group.append(shape);
    }
  }
  return group;
}

/** SVG of the body with the given muscles highlighted. label is read by screen readers. */
export function muscleFigure({ primary = [], secondary = [] }, label) {
  const level = (muscle) => (primary.includes(muscle) ? 'primary' : secondary.includes(muscle) ? 'secondary' : '');
  const svg = node('svg', { class: 'fig', viewBox: '0 0 214 214', role: 'img', 'aria-label': label });
  svg.append(view(FRONT, 2, level), view(BACK, 112, level));
  return svg;
}

// A custom exercise only knows its group; these are the muscles that stands for.
const GROUP_MUSCLES = {
  chest: ['chest'],
  back: ['lats', 'traps'],
  shoulders: ['shoulders'],
  biceps: ['biceps'],
  triceps: ['triceps'],
  legs: ['quads', 'hamstrings', 'glutes'],
  abs: ['abs', 'obliques'],
  other: [],
};

const BUILTINS = new Map(BUILTIN_EXERCISES.map((e) => [e.id, e]));

/** { primary, secondary } muscle keys of an exercise. */
export function musclesOf(exercise) {
  const builtin = BUILTINS.get(exercise.id);
  // A built-in moved to another group by the user is drawn as that group.
  if (builtin && builtin.muscle === exercise.muscle) return { primary: builtin.primary, secondary: builtin.secondary };
  return { primary: GROUP_MUSCLES[exercise.muscle] ?? [], secondary: [] };
}
