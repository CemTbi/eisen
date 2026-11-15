// The picture of an exercise: a marble statue seen from the front and from
// behind, with the trained muscles coloured. It is drawn as SVG from the paths
// in js/body.js, so it works for every exercise (also custom ones) and offline.

import { BODY } from './body.js';
import { BUILTIN_EXERCISES } from './library.js';

const SVG = 'http://www.w3.org/2000/svg';

// Part of the drawing → muscle key (as in js/library.js, named under "m.<key>").
// Parts that are not listed (head, hands, knees, ...) are plain stone.
const MUSCLE_OF = {
  chest: 'chest',
  obliques: 'obliques',
  abs: 'abs',
  biceps: 'biceps',
  triceps: 'triceps',
  trapezius: 'traps',
  deltoids: 'shoulders',
  forearm: 'forearms',
  adductors: 'adductors',
  quadriceps: 'quads',
  calves: 'calves',
  'upper-back': 'lats',
  'lower-back': 'lowerback',
  gluteal: 'glutes',
  hamstring: 'hamstrings',
};

export const MUSCLE_KEYS = [...new Set(Object.values(MUSCLE_OF))];

function node(tag, attrs = {}, ...children) {
  const el = document.createElementNS(SVG, tag);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
  el.append(...children);
  return el;
}

// Light from the upper left falls on the blurred outline of every muscle, which
// rounds it like chiselled stone; a share of even light keeps the shadows
// soft. Costly to paint, so only the large picture uses it.
const RELIEF = 'fig-relief';
const relief = () => node('filter', { id: RELIEF, x: '0', y: '0', width: '100%', height: '100%', 'color-interpolation-filters': 'sRGB' },
  node('feGaussianBlur', { in: 'SourceAlpha', stdDeviation: '4.5', result: 'height' }),
  node('feDiffuseLighting', { in: 'height', surfaceScale: '4', diffuseConstant: '1.15', 'lighting-color': '#fff', result: 'light' },
    node('feDistantLight', { azimuth: '235', elevation: '58' })),
  node('feComposite', { in: 'light', in2: 'SourceGraphic', operator: 'arithmetic', k1: '0.72', k2: '0', k3: '0.34', k4: '0', result: 'lit' }),
  node('feComposite', { in: 'lit', in2: 'SourceAlpha', operator: 'in' }));

function view({ outline, parts }, level, sculpted) {
  const muscles = node('g', sculpted ? { filter: `url(#${RELIEF})` } : {});
  for (const [part, d] of parts) {
    const muscle = MUSCLE_OF[part];
    const cls = part === 'hair' ? 'fig-hair' : `fig-part ${muscle ? level(muscle) : ''}`.trim();
    muscles.append(node('path', { d, class: cls }));
  }
  return node('g', {}, node('path', { d: outline, class: 'fig-body' }), muscles);
}

/**
 * SVG of the body with the given muscles highlighted. label is read by screen
 * readers; sculpted adds the stone relief.
 */
export function muscleFigure({ primary = [], secondary = [] }, label, { sculpted = false } = {}) {
  const level = (muscle) => (primary.includes(muscle) ? 'primary' : secondary.includes(muscle) ? 'secondary' : '');
  const svg = node('svg', { class: 'fig', viewBox: '40 86 1368 1275', role: 'img', 'aria-label': label });
  if (sculpted) svg.append(node('defs', {}, relief()));
  svg.append(view(BODY.front, level, sculpted), view(BODY.back, level, sculpted));
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
