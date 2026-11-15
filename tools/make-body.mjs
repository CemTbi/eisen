// Writes js/body.js, the drawing behind the exercise picture: the body artwork
// of react-native-body-highlighter (MIT), bent from its neutral stance into the
// contrapposto of a Greek statue, with a face added. Only needed to change the
// drawing or the pose:
//
//   npm pack react-native-body-highlighter@3.2.0 && tar xzf react-native-body-highlighter-3.2.0.tgz
//   node tools/make-body.mjs package
//
// The package is read as text, not installed or run: the app has no build step
// and only needs the path data.

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import svgpath from 'svgpath';

const source = process.argv[2];
if (!source) throw new Error('usage: node tools/make-body.mjs <extracted package directory>');
const read = (file) => readFile(`${source}/dist/${file}`, 'utf8');

// ---- the pose --------------------------------------------------------------------------
//
// Everything is measured on the front view (724 wide, the figure centred on
// x = 362). L is the left of the picture: the leg that carries the weight and
// the arm that hangs. R is the free leg and the bent arm. Angles are degrees,
// clockwise on screen, each relative to the limb it hangs on.

const CENTRE = 362;
const POSE = {
  pelvis: { tilt: 5, shift: -12 }, // the hip over the standing leg rises
  chest: { tilt: -4.5 }, // the shoulders answer the other way
  head: { tilt: -4 },
  L: { upperArm: -2, forearm: -6, thigh: -9.5, shank: 1, foot: 2 },
  R: { upperArm: 9, forearm: 11, thigh: -11.5, shank: 13, foot: -16 },
};

// Joints of the neutral drawing, for the left side; the right side mirrors them.
const JOINT = {
  waist: [CENTRE, 560], hips: [CENTRE, 690], neck: [CENTRE, 292],
  shoulder: [236, 345], elbow: [193, 500], wrist: [140, 690],
  hip: [298, 690], knee: [296, 1004], ankle: [290, 1250],
};

const ARM = new Set(['deltoids', 'biceps', 'triceps', 'forearm', 'hands']);
const LEG = new Set(['quadriceps', 'adductors', 'hamstring', 'knees', 'tibialis', 'calves', 'ankles', 'feet']);
const HEAD = new Set(['neck', 'head', 'hair', 'face']);

const rotate = ([x, y], [cx, cy], degrees) => {
  const a = (degrees * Math.PI) / 180;
  const dx = x - cx;
  const dy = y - cy;
  return [cx + dx * Math.cos(a) - dy * Math.sin(a), cy + dx * Math.sin(a) + dy * Math.cos(a)];
};
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const smooth = (from, to, value) => {
  const t = Math.min(1, Math.max(0, (value - from) / (to - from)));
  return t * t * (3 - 2 * t);
};
const along = (p, from, to) => {
  const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
  return ((p[0] - from[0]) * (to[0] - from[0]) + (p[1] - from[1]) * (to[1] - from[1])) / length;
};

// Each limb moves with the one it hangs on, then turns about its own joint.
const pelvis = (p) => { const q = rotate(p, JOINT.hips, POSE.pelvis.tilt); return [q[0] + POSE.pelvis.shift, q[1]]; };
const chest = (p) => {
  const waist = pelvis(JOINT.waist);
  const q = rotate(p, JOINT.waist, POSE.chest.tilt);
  return [q[0] + waist[0] - JOINT.waist[0], q[1] + waist[1] - JOINT.waist[1]];
};
const trunk = (p) => mix(chest(p), pelvis(p), smooth(450, 670, p[1]));
const head = (p) => chest(rotate(p, JOINT.neck, POSE.head.tilt));

/** Where a point of the neutral front view ends up. part names the piece of the drawing it belongs to. */
function pose(p, part) {
  const right = p[0] > CENTRE;
  const side = POSE[right ? 'R' : 'L'];
  const joint = (name) => (right ? [2 * CENTRE - JOINT[name][0], JOINT[name][1]] : JOINT[name]);

  if (HEAD.has(part)) return mix(head(p), chest(p), smooth(238, 300, p[1]));

  if (ARM.has(part)) {
    const upperArm = (q) => chest(rotate(q, joint('shoulder'), side.upperArm));
    const forearm = (q) => upperArm(rotate(q, joint('elbow'), side.forearm));
    const shoulderToArm = smooth(-50, 30, along(p, joint('shoulder'), joint('elbow')));
    const armToForearm = part === 'hands' ? 1 : part === 'deltoids' ? 0 : smooth(-34, 34, along(p, joint('elbow'), joint('wrist')));
    return mix(mix(chest(p), upperArm(p), shoulderToArm), forearm(p), armToForearm);
  }

  if (LEG.has(part)) {
    const thigh = (q) => pelvis(rotate(q, joint('hip'), side.thigh));
    const shank = (q) => thigh(rotate(q, joint('knee'), side.shank));
    const foot = (q) => shank(rotate(q, joint('ankle'), side.foot));
    const y = p[1];
    let q = mix(pelvis(p), thigh(p), smooth(640, 770, y));
    q = mix(q, shank(p), smooth(955, 1055, y));
    return mix(q, foot(p), smooth(1215, 1285, y));
  }

  return trunk(p);
}

// ---- paths -----------------------------------------------------------------------------

/** Moves every point of a path with fn([x, y]) → [x, y]. */
function movePath(d, fn) {
  const moved = svgpath(d).abs().unarc().unshort().iterate((segment, index, x, y) => {
    const [command, ...numbers] = segment;
    if (command === 'Z' || command === 'z') return undefined;
    if (command === 'H') return [['L', ...fn([numbers[0], y])]];
    if (command === 'V') return [['L', ...fn([x, numbers[0]])]];
    const out = [command];
    for (let i = 0; i < numbers.length; i += 2) out.push(...fn([numbers[i], numbers[i + 1]]));
    return [out];
  });
  return moved.rel().round(1).toString();
}

/** The points of a path (control points included). */
function pointsOf(d) {
  const points = [];
  movePath(d, (p) => { points.push(p); return p; });
  return points;
}

/** [[slug, path data], ...] in drawing order; the shapes of one part are joined into one path. */
function parts(text) {
  return text.split(/slug:\s*"/).slice(1).map((chunk) => {
    const slug = chunk.slice(0, chunk.indexOf('"'));
    const paths = [...chunk.matchAll(/"([Mm][^"]+)"/g)].map((match) => match[1].trim());
    if (!paths.length) throw new Error(`no shapes for ${slug}`);
    return [slug, paths.join('')];
  });
}

// The face, drawn on the neutral front view: [kind, path, mirrored?]. "shade" is
// a filled shadow, "line" a chiselled line, "curl" a row of curls in the hair.
const FACE = [
  ['curl', 'M316,147q5.75,-8 11.5,0q5.75,-8 11.5,0q5.75,-8 11.5,0q5.75,-8 11.5,0q5.75,-8 11.5,0q5.75,-8 11.5,0q5.75,-8 11.5,0q5.75,-8 11.5,0', false],
  ['curl', 'M321,133q5.85,-8 11.7,0q5.85,-8 11.7,0q5.85,-8 11.7,0q5.85,-8 11.7,0q5.85,-8 11.7,0q5.85,-8 11.7,0q5.85,-8 11.7,0', false],
  ['curl', 'M329,120q5.5,-8 11,0q5.5,-8 11,0q5.5,-8 11,0q5.5,-8 11,0q5.5,-8 11,0q5.5,-8 11,0', false],
  ['curl', 'M340,108q5.5,-8 11,0q5.5,-8 11,0q5.5,-8 11,0q5.5,-8 11,0', false],
  ['shade', 'M323,182Q338,172 357,180Q357,186 354,191Q339,183 323,182Z', true], // under the brow
  ['line', 'M329,190Q339,184 350,190Q339,195 329,190Z', true], // eye
  ['line', 'M320,178Q337,167 357,176', true], // brow
  ['shade', 'M362,180L366,180Q368,200 373,211Q376,220 366,221L362,222Z', false], // side of the nose
  ['line', 'M358,181Q357,200 351,212Q349,220 357,221', false], // nose
  ['shade', 'M352,223Q362,227 372,223Q362,229 352,223Z', false], // under the nose
  ['line', 'M346,233Q355,229 362,231.5Q369,229 378,233', false], // mouth
  ['shade', 'M351,238Q362,242 373,238Q362,247 351,238Z', false], // under the lower lip
  ['line', 'M351,253Q362,258 373,253', false], // chin
];

// The back shows the same pose from behind, so it is the front's mirror image.
const BACK_OFFSET = 724;
const fromBack = ([x, y]) => [2 * CENTRE - (x - BACK_OFFSET), y];
const toBack = ([x, y]) => [2 * CENTRE - x + BACK_OFFSET, y];

function view(partList, outline, isBack) {
  const posed = (part) => (p) => (isBack ? toBack(pose(fromBack(p), part)) : pose(p, part));

  // The outline is one path around the whole body: each of its points follows
  // the nearest points of the parts.
  const anchors = partList.flatMap(([part, d]) => pointsOf(d).map((p) => ({ p, to: posed(part)(p) })));
  const follow = (p) => {
    const near = anchors.map((a) => ({ a, distance: Math.hypot(a.p[0] - p[0], a.p[1] - p[1]) }))
      .sort((a, b) => a.distance - b.distance).slice(0, 4);
    let total = 0;
    let dx = 0;
    let dy = 0;
    for (const { a, distance } of near) {
      const weight = 1 / (distance + 0.5) ** 2;
      total += weight;
      dx += (a.to[0] - a.p[0]) * weight;
      dy += (a.to[1] - a.p[1]) * weight;
    }
    return [p[0] + dx / total, p[1] + dy / total];
  };

  return {
    outline: movePath(outline, follow),
    parts: partList.map(([part, d]) => [part, movePath(d, posed(part))]),
  };
}

const outlines = [...(await read('components/SvgMaleWrapper.js')).matchAll(/ d="(M[^"]+)"/g)].map((match) => match[1]);
if (outlines.length !== 2) throw new Error(`expected a front and a back outline, found ${outlines.length}`);

const mirrored = (d) => movePath(d, ([x, y]) => [2 * CENTRE - x, y]);
const body = {
  front: {
    ...view(parts(await read('assets/bodyFront.js')), outlines[0], false),
    face: FACE.flatMap(([kind, d, both]) => (both ? [d, mirrored(d)] : [d]).map((path) => [kind, movePath(path, (p) => pose(p, 'face'))])),
  },
  back: view(parts(await read('assets/bodyBack.js')), outlines[1], true),
};

const licence = (await readFile(`${source}/LICENSE`, 'utf8')).trim().split('\n').map((line) => ` * ${line}`.trimEnd()).join('\n');
const out = `/*
 * Generated by tools/make-body.mjs; do not edit by hand.
 *
 * Body artwork from react-native-body-highlighter 3.2.0
 * (https://github.com/HichamELBSI/react-native-body-highlighter), posed and
 * given a face by tools/make-body.mjs:
 *
${licence}
 */

// Both views share one canvas: the front on x 0–724, the back on x 724–1448.
export const BODY = ${JSON.stringify(body, null, 1)};
`;
await writeFile(fileURLToPath(new URL('../js/body.js', import.meta.url)), out);
console.log(`js/body.js: ${out.length} bytes, front ${body.front.parts.length} parts, back ${body.back.parts.length} parts`);
