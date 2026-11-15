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
  pair(null, 'M50,4C44.5,4 41.8,8.2 41.8,14C41.8,19.5 43.4,23.8 46.2,26.6C47.3,27.6 48.6,28 50,28Z'),
  pair(null, 'M50,24L45.6,24C45.6,28 45.4,31 44.8,32.5C41,36 35,37.6 30,38.6C23.5,39.4 17,43.5 16,51'
    + 'C15.6,56 15.4,60 14.6,64C13.4,69 11.6,74 10.8,79C9.4,86 7.6,95 6.6,104C5.2,108 4.4,114 5.4,119'
    + 'C6.4,123 9.6,123.6 11.2,120C12.4,116.5 12.6,111 13,106C15.4,98 18.6,89 19.6,81C21.4,74 24,66 25.6,59'
    + 'L26.5,59C28,67 33,76 34.5,87C34.2,93 32,100 31,107C29.4,118 29.6,132 31.6,144C32.4,149 33,153 33.2,157'
    + 'C31.6,163 30.8,170 31.6,178C32.4,188 35.6,197 36.4,205C36,208 34.6,211 33.4,213.4C32.4,216 34.6,217.6 38,217.6'
    + 'L44.4,217.6C46.4,217.6 46.6,214 45.6,211C45.2,209 45,207 45,205C46,196 48,186 47,176'
    + 'C46.4,168 45.6,162 45.8,157C47,145 49,128 50,114Z'),
];

const DELTOID = 'M30.4,39.4C24,40 18,44 17,51C16.6,55 16.6,58.5 17.4,62C20.6,60 24,55.5 26,50C27.4,46.4 29.6,42.6 30.4,39.4Z';
const UPPER_ARM = 'M18.4,62.6C16.6,66 14.4,71.5 12.6,77.4C14.4,79.6 17,80 18.8,79.2C20.4,74 22.4,67 23.6,61.4C22,60 20,60.6 18.4,62.6Z';
const FOREARM = 'M11.6,81.4C10.2,88 8.6,96 7.8,103.4L12.2,104.6C14.4,97 17.2,89 18.4,82.4C16.4,83.6 13.6,83.4 11.6,81.4Z';

const FRONT = [
  ...BODY,
  pair('traps', 'M45.4,32.6C42,35.8 36.5,37.4 32,38.4C36,39.2 41,39.4 45.2,39Z'),
  pair('chest', 'M48.8,41.8C43,40.2 36,40.4 31.6,41.6C29.4,45 27.4,50 27,55.5C29,60.5 34,63.6 40,63.4C44.5,63.2 48.8,61.4 48.8,58Z'),
  pair('biceps', UPPER_ARM),
  pair('shoulders', DELTOID),
  pair('forearms', FOREARM),
  pair('abs', box(44.2, 65.5, 5.1, 6, 1.5)),
  pair('abs', box(44.2, 73, 5.1, 6, 1.5)),
  pair('abs', box(44.2, 80.5, 5.1, 6, 1.5)),
  pair('abs', 'M44.4,88L49.3,88L49.3,105.4C46.8,102.4 44.8,96 44.4,88Z'),
  pair('obliques', 'M30,65.2C33.5,66.4 38,66.2 42.6,65L42.6,90C42.6,96 41.4,101 38.6,105C36.6,101 35.6,95 35.6,88C35,80 32.4,72 30,65.2Z'),
  pair('quads', 'M32.2,109C30.8,118 30.9,132 33,145.5C34,148 35.4,149 36.6,148.4C35.6,138 35,122 36.4,110.4C35,108.6 33.4,108.2 32.2,109Z'),
  pair('quads', 'M37.8,110.6C36.4,122 36.8,137 38,147.4C39.6,148.6 41.2,148.2 42,146.6C43,136 43,122 41,112C40,110.4 38.8,110 37.8,110.6Z'),
  pair('quads', 'M43.2,130C43.6,138 43.4,144 42.8,149C43.6,151.4 45,151.2 45.6,148.6C46,142 45.4,135 43.2,130Z'),
  pair('adductors', 'M42.6,113.4C44.6,119 46.2,126 46.8,134C47.6,128 48.4,121 48.8,115.4C46.8,113.6 44.6,113 42.6,113.4Z'),
  pair('calves', 'M33.6,162C32.4,168 32.4,178 34,188C35,193 36.2,197 37,201L39.4,201C39.6,190 39.2,174 38,162.4C36.6,161 35,161 33.6,162Z'),
  pair('calves', 'M40.6,163C41.8,174 42,190 41.6,201L43.6,201C44.8,194 46,184 45.8,176C45.6,170 45,166 44.4,163C43.2,162 41.8,162 40.6,163Z'),
];

const BACK = [
  ...BODY,
  one('traps', 'M50,27.5C48.6,31 46.8,33 44.8,34.2C41,36.6 35.6,38 31.4,39C36.6,41.6 41.6,44.6 44.6,49.6C47,55.6 49,63 50,71'
    + 'C51,63 53,55.6 55.4,49.6C58.4,44.6 63.4,41.6 68.6,39C64.4,38 59,36.6 55.2,34.2C53.2,33 51.4,31 50,27.5Z'),
  pair('lats', 'M31.6,41.6C35.6,43.2 40.4,45.8 43.4,50C39.4,48.8 33.6,50.6 28.6,55.6C28.2,51 29.4,45.6 31.6,41.6Z'),
  pair('lats', 'M28,58.4C32.6,53.6 38.6,51 44,53.4C46,59.4 47.2,66 47.6,73C44.6,80.6 40,86.6 36.2,90.6C35.4,80 31.6,68 28,58.4Z'),
  pair('lowerback', 'M49.3,76.5L49.3,101.6C46,100.6 42.4,98.6 39.2,96C38.4,94.4 38,93 38,92C42.4,87.6 46.2,82 48.4,76.5Z'),
  pair('triceps', UPPER_ARM),
  pair('shoulders', DELTOID),
  pair('forearms', FOREARM),
  pair('glutes', 'M49.3,103.6C45,102 38.6,99.8 34.2,98.8C32,102.6 31.2,108 31.8,113C33.4,119.4 40,122 46,120.6C48,120 49.3,118.6 49.3,116.6Z'),
  pair('hamstrings', 'M32.4,122C31.2,131 31.8,142 33.8,150.6C35.4,152.4 37.6,152.4 39,151C39.6,142 39.6,132 39,124.4C36.6,124.4 34.2,123.6 32.4,122Z'),
  pair('hamstrings', 'M40.4,124.6C41,132 41,142 40.4,151C42,152.6 44.2,152.4 45.4,150.6C46.8,142 47.8,132 48,124C45.6,124.8 42.8,125 40.4,124.6Z'),
  pair('calves', 'M33.4,160.6C31.9,167 32.2,177 34.4,186.6C36,189 38,189.4 39.2,188C39.6,179 39.4,169 38.8,160.4C37,159.2 35,159.4 33.4,160.6Z'),
  pair('calves', 'M40.2,160.4C40.8,169 41,179 40.6,188C42,189.6 44,189.2 45.2,186.6C46.4,179 46.2,168 44.6,160.6C43.4,159.4 41.6,159.2 40.2,160.4Z'),
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
