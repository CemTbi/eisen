import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { test } from 'node:test';
import {
  fmtClock, fmtDuration, fmtInput, fmtRelative, fmtSet, fold, fromLocalInput, parseNum, parseReps, parseWeight, plural,
  toLocalInput,
} from '../../js/util.js';

test('parseNum accepts comma and dot decimals', () => {
  assert.equal(parseNum('62,5'), 62.5);
  assert.equal(parseNum('62.5'), 62.5);
  assert.equal(parseNum(' 80 '), 80);
  assert.equal(parseNum(',5'), 0.5);
  assert.equal(parseNum('0'), 0);
});

test('parseNum rejects anything that is not a plain positive number', () => {
  for (const bad of ['', ' ', '.', ',', '-5', '1e3', '1,2,3', 'abc', '12kg', null, undefined, 5]) {
    assert.equal(parseNum(bad), null, String(bad));
  }
});

test('parseWeight rounds to two decimals and caps absurd values', () => {
  assert.equal(parseWeight('62,555'), 62.56);
  assert.equal(parseWeight('99999'), 2000);
  assert.equal(parseWeight('0'), 0);
  assert.equal(parseWeight(''), null);
});

test('parseReps yields whole reps of at least one', () => {
  assert.equal(parseReps('8'), 8);
  assert.equal(parseReps('8,9'), 8);
  assert.equal(parseReps('0'), null);
  assert.equal(parseReps(''), null);
  assert.equal(parseReps('5000'), 1000);
});

test('fmtInput mirrors what parseWeight reads', () => {
  assert.equal(fmtInput(62.5), '62,5');
  assert.equal(fmtInput(1000), '1000');
  assert.equal(fmtInput(null), '');
  assert.equal(fmtInput(undefined), '');
  assert.equal(parseWeight(fmtInput(62.5)), 62.5);
});

test('fmtSet distinguishes weighted and bodyweight sets', () => {
  assert.equal(fmtSet({ weight: 62.5, reps: 8 }), '62,5 kg × 8');
  assert.equal(fmtSet({ weight: 1250, reps: 1 }), '1.250 kg × 1');
  assert.equal(fmtSet({ weight: 0, reps: 12 }), '12 Wdh.');
});

test('fmtDuration and fmtClock', () => {
  assert.equal(fmtDuration(0), '1 min');
  assert.equal(fmtDuration(45 * 60_000), '45 min');
  assert.equal(fmtDuration(60 * 60_000), '1 h');
  assert.equal(fmtDuration(65 * 60_000), '1 h 5 min');
  assert.equal(fmtClock(0), '0:00');
  assert.equal(fmtClock(247_000), '4:07');
  assert.equal(fmtClock(3_847_000), '1:04:07');
  assert.equal(fmtClock(-500), '0:00');
});

test('fmtRelative works on calendar days', () => {
  const now = new Date(2026, 10, 14, 9, 0).getTime();
  assert.equal(fmtRelative(new Date(2026, 10, 14, 0, 5).getTime(), now), 'heute');
  assert.equal(fmtRelative(new Date(2026, 10, 13, 23, 55).getTime(), now), 'gestern');
  assert.equal(fmtRelative(new Date(2026, 10, 10, 12, 0).getTime(), now), 'vor 4 Tagen');
  assert.match(fmtRelative(new Date(2026, 9, 1, 12, 0).getTime(), now), /1\. Okt/);
  assert.match(fmtRelative(new Date(2025, 9, 1, 12, 0).getTime(), now), /2025/);
});

test('datetime-local values round-trip', () => {
  const ts = new Date(2026, 10, 4, 7, 5).getTime();
  assert.equal(toLocalInput(ts), '2026-11-04T07:05');
  assert.equal(fromLocalInput('2026-11-04T07:05'), ts);
  assert.equal(fromLocalInput(''), null);
});

test('fold ignores case and umlauts for searching', () => {
  assert.equal(fold('  Bankdrücken '), 'bankdrucken');
  assert.ok(fold('Überzüge am Kabelzug').includes(fold('uberzu')));
});

test('plural', () => {
  assert.equal(plural(1, 'Satz', 'Sätze'), '1 Satz');
  assert.equal(plural(0, 'Satz', 'Sätze'), '0 Sätze');
  assert.equal(plural(1200, 'Training', 'Trainings'), '1.200 Trainings');
});

test('the service worker precaches every file the app loads', async () => {
  const root = new URL('../../', import.meta.url);
  const sw = await readFile(new URL('sw.js', root), 'utf8');
  const listed = new Set([...sw.matchAll(/^\s+'([^']+)',$/gm)].map((m) => m[1]));
  const expected = ['./', 'styles.css', 'manifest.webmanifest'];
  for (const dir of ['js', 'js/views', 'icons']) {
    for (const entry of await readdir(new URL(`${dir}/`, root), { withFileTypes: true })) {
      if (entry.isFile()) expected.push(`${dir}/${entry.name}`);
    }
  }
  assert.deepEqual([...listed].sort(), expected.sort());
});
