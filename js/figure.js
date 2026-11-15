// The picture of an exercise: a body seen from the front and from behind,
// with the trained muscles coloured. Drawn here as SVG, so it works for every
// exercise (also custom ones), in every theme, and offline.

import { BUILTIN_EXERCISES } from './library.js';

const SVG = 'http://www.w3.org/2000/svg';

// Each view is drawn on a 100 × 220 canvas. Paths describe the left half of
// the picture; `pair` mirrors them to the right.
const pair = (muscle, d) => ({ muscle, d, mirrored: true });
const one = (muscle, d) => ({ muscle, d, mirrored: false });

const box = (x, y, w, h, r) => `M${x + r},${y}h${w - 2 * r}a${r},${r} 0 0 1 ${r},${r}v${h - 2 * r}a${r},${r} 0 0 1 ${-r},${r}`
  + `h${-(w - 2 * r)}a${r},${r} 0 0 1 ${-r},${-r}v${-(h - 2 * r)}a${r},${r} 0 0 1 ${r},${-r}z`;

// The outline: head, then neck, shoulder, arm, hand, flank, leg and foot.
const BODY = [
  one(null, 'M41,16a9,11.5 0 1 0 18,0a9,11.5 0 1 0 -18,0z'),
  pair(null, 'M50,26L44.5,26L44.5,34C41,37.5 33,38.5 28,39.5C22,40.5 17.5,45 17.5,52C17.5,60 15,68 13.5,76'
    + 'C11.5,84 9.5,96 8.5,107C7,112 6.5,118 8.5,122C10.5,125 14,124 15,119C16,114 16.5,111 16.5,108'
    + 'C19,98 21.5,88 22.5,79C24.5,72 26.5,64 27.5,58C29,68 32,76 33,86C32,94 30.5,102 30,110'
    + 'C29,124 30,140 32.5,156C32,160 30.5,168 31,176C31.5,188 35,198 36,206L35,211C33,215 36,217 41,217'
    + 'L46,217C47.5,215 46,210 45.5,206C46.5,196 48,184 47,174C46.5,166 46,160 46.5,156C48,140 49.5,124 50,113Z'),
];

const DELTOID = 'M29,40.3C23,41 18.6,45.5 18.6,52C18.6,55 19,57.5 20,59.5C23,57 26,52 27.5,47C28.5,44 29.5,42 29,40.3Z';
const UPPER_ARM = 'M19,61C17.5,66 16,71 15,76C16.5,78.5 19.5,79 21.5,78C23,72 25,65 26,60C24,57.5 21,58.5 19,61Z';
const FOREARM = 'M14.2,80.5C12.5,88 10.5,98 9.8,106L15.6,107C17.5,99 20,89 21.3,81.5C19,83 16,82.5 14.2,80.5Z';

const FRONT = [
  ...BODY,
  pair('traps', 'M45,33.5C42,36.5 36,38 31,39.2L44.8,40Z'),
  pair('chest', 'M48.6,42.5C42,40.8 35,41.2 30.8,42.8C29.8,47 29,51 29,56C31.5,61 37,63.3 43,62.5C46.5,62 48.6,60.5 48.6,58Z'),
  pair('biceps', UPPER_ARM),
  pair('shoulders', DELTOID),
  pair('forearms', FOREARM),
  pair('abs', box(43.6, 65, 5.6, 6.6, 1.6)),
  pair('abs', box(43.6, 73, 5.6, 6.6, 1.6)),
  pair('abs', box(43.6, 81, 5.6, 6.6, 1.6)),
  pair('abs', 'M43.8,89L49.2,89L49.2,106C46.5,103 44.3,97 43.8,89Z'),
  pair('obliques', 'M30,63.5C33.5,66 38,66.5 42,65.5L42,90C42,96 40,101 37,104C35,100 33.8,95 34.2,86C33.5,78 31,70 30,63.5Z'),
  pair('quads', 'M31.5,108C30.5,120 31,138 33.5,150C36,153.5 41,153.5 44,150C45.5,140 45,125 41,112C38,108 34,106.5 31.5,108Z'),
  pair('adductors', 'M43,113C46,124 46.8,136 46.2,146C47.5,138 48.5,124 48.8,114.5C47,113 45,112.5 43,113Z'),
  pair('calves', 'M33.5,162C32,168 32,178 34,190C35,196 36.5,200 37.5,203L44,203C45,196 46.2,184 45.8,174C45.5,168 45.5,164 45.5,162C42,160 37,160 33.5,162Z'),
];

const BACK = [
  ...BODY,
  one('traps', 'M50,29C48,33 46,35 44,36C40,38 34,39 30,40C36,43 42,46 45.5,52C47.5,58 49,64 50,70'
    + 'C51,64 52.5,58 54.5,52C58,46 64,43 70,40C66,39 60,38 56,36C54,35 52,33 50,29Z'),
  pair('lats', 'M31,42.8C35,44.3 40,46.8 43.6,51C39,49.3 33.5,51 29.6,55C29.2,51 29.6,46.5 31,42.8Z'),
  pair('lats', 'M29.6,57.5C33,53.3 39,51 44.3,53.8C46,59 47,66 47.2,72C44,80 39,86 35,90C33.8,80 31,66 29.6,57.5Z'),
  pair('lowerback', 'M49.2,75L49.2,101C46,100 42.5,98 39,95.5C38,93.5 37.5,92 37.5,90.8C42,86.5 46,81 48.2,75Z'),
  pair('triceps', UPPER_ARM),
  pair('shoulders', DELTOID),
  pair('forearms', FOREARM),
  pair('glutes', 'M49.2,103C45,101.5 38,99 33,98.2C31.2,102 30.8,108 31.4,113C33,119 40,121.5 46,120C48,119.5 49.2,118 49.2,116Z'),
  pair('hamstrings', 'M32,121.5C31,132 32,143 34,151C37,153 42,153 45.5,151C47,142 48,131 48,123C43,125 36,124.5 32,121.5Z'),
  pair('calves', 'M33.5,160C31.8,167 32,178 34.5,188C37,191 42,191 45,188C46.3,180 46,168 45.5,160C42,158.5 37,158.5 33.5,160Z'),
];

export const MUSCLE_KEYS = [...new Set([...FRONT, ...BACK].map((shape) => shape.muscle).filter(Boolean))];

function node(tag, attrs) {
  const el = document.createElementNS(SVG, tag);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
  return el;
}

function view(shapes, offset, level) {
  const group = node('g', { transform: `translate(${offset} 0)` });
  for (const { muscle, d, mirrored } of shapes) {
    const cls = muscle ? `fig-part ${level(muscle)}`.trim() : 'fig-body';
    group.append(node('path', { d, class: cls }));
    if (mirrored) group.append(node('path', { d, class: cls, transform: 'translate(100 0) scale(-1 1)' }));
  }
  return group;
}

/** SVG of the body with the given muscles highlighted. label is read by screen readers. */
export function muscleFigure({ primary = [], secondary = [] }, label) {
  const level = (muscle) => (primary.includes(muscle) ? 'primary' : secondary.includes(muscle) ? 'secondary' : '');
  const svg = node('svg', { class: 'fig', viewBox: '0 0 192 220', role: 'img', 'aria-label': label });
  svg.append(view(FRONT, -4, level), view(BACK, 96, level));
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
