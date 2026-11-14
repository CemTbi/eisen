import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { test } from 'node:test';
import { setLang } from '../../js/i18n.js';
import {
  count, fmtInput, fmtRelative, fmtSet, fold, fromDateInput, parseNum, parseReps, parseWeight, toDateInput,
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

test('numbers and sets follow the language', () => {
  setLang('de');
  assert.equal(fmtInput(62.5), '62,5');
  assert.equal(fmtSet({ weight: 1250.5, reps: 1 }), '1.250,5 kg × 1');
  assert.equal(fmtSet({ weight: 0, reps: 12 }), '12 Wdh.');
  assert.equal(count(1, 'n.sets'), '1 Satz');
  assert.equal(count(0, 'n.sets'), '0 Sätze');
  assert.equal(parseWeight(fmtInput(62.5)), 62.5);
  setLang('en');
  assert.equal(fmtInput(62.5), '62.5');
  assert.equal(fmtSet({ weight: 1250.5, reps: 1 }), '1,250.5 kg × 1');
  assert.equal(fmtSet({ weight: 0, reps: 12 }), '12 reps');
  assert.equal(count(3, 'n.entries'), '3 entries');
  assert.equal(fmtInput(null), '');
  assert.equal(parseWeight(fmtInput(62.5)), 62.5);
  setLang('de');
});

test('fmtRelative works on calendar days, in the current language', () => {
  const now = new Date(2026, 10, 14, 9, 0).getTime();
  setLang('de');
  assert.equal(fmtRelative(new Date(2026, 10, 14, 0, 5).getTime(), now), 'heute');
  assert.equal(fmtRelative(new Date(2026, 10, 13, 23, 55).getTime(), now), 'gestern');
  assert.equal(fmtRelative(new Date(2026, 10, 10, 12, 0).getTime(), now), 'vor 4 Tagen');
  assert.match(fmtRelative(new Date(2026, 9, 1, 12, 0).getTime(), now), /1\. Okt/);
  assert.match(fmtRelative(new Date(2025, 9, 1, 12, 0).getTime(), now), /2025/);
  setLang('en');
  assert.equal(fmtRelative(new Date(2026, 10, 13, 23, 55).getTime(), now), 'yesterday');
  assert.match(fmtRelative(new Date(2026, 9, 1, 12, 0).getTime(), now), /1 Oct/);
  setLang('de');
});

test('date fields: today keeps the time, other days are noon, the future is refused', () => {
  const now = new Date(2026, 10, 14, 18, 30).getTime();
  assert.equal(toDateInput(now), '2026-11-14');
  assert.equal(fromDateInput('2026-11-14', now), now);
  assert.equal(fromDateInput('2026-03-02', now), new Date(2026, 2, 2, 12).getTime());
  assert.equal(fromDateInput('2026-11-15', now), null);
  for (const bad of ['', null, '2026-02-31', '14.11.2026', 'x']) assert.equal(fromDateInput(bad, now), null, String(bad));
});

test('fold ignores case and umlauts for searching', () => {
  assert.equal(fold('  Bankdrücken '), 'bankdrucken');
  assert.ok(fold('Überzüge am Kabelzug').includes(fold('uberzu')));
});

test('the service worker precaches every file the app loads', async () => {
  const root = new URL('../../', import.meta.url);
  const sw = await readFile(new URL('sw.js', root), 'utf8');
  const listed = new Set([...sw.matchAll(/^\s+'([^']+)',$/gm)].map((m) => m[1]));
  const expected = ['./', 'styles.css', 'manifest.webmanifest'];
  for (const dir of ['js', 'js/views', 'js/locales', 'icons']) {
    for (const entry of await readdir(new URL(`${dir}/`, root), { withFileTypes: true })) {
      if (entry.isFile()) expected.push(`${dir}/${entry.name}`);
    }
  }
  assert.deepEqual([...listed].sort(), expected.sort());
});
