// End-to-end test: drives the real app in a phone-sized browser.
// Usage: npm run test:e2e            (WebKit if installed, else Edge/Chrome)
//        BROWSER=chromium npm run test:e2e
//        BASE_URL=https://example.org/eisen/ npm run test:e2e   (test a deployed copy)
// Screenshots of every screen land in test/screenshots/.

import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium, devices, webkit } from 'playwright';
import { createStaticServer } from '../tools/serve.mjs';

const SHOTS = fileURLToPath(new URL('./screenshots/', import.meta.url));
const DAY = 86_400_000;
const BENCH = 'Bankdrücken (Langhantel)';
const RAISE = 'Seitheben (Kurzhantel)';

async function launch() {
  const wanted = process.env.BROWSER;
  const candidates = [
    ['webkit', () => webkit.launch()],
    ['chromium', () => chromium.launch({ channel: 'msedge' })],
    ['chromium', () => chromium.launch({ channel: 'chrome' })],
    ['chromium', () => chromium.launch()],
  ].filter(([name]) => !wanted || wanted === name);
  for (const [name, start] of candidates) {
    try {
      return { name, browser: await start() };
    } catch {
      // try the next engine
    }
  }
  throw new Error('No browser available. Run: npx playwright install webkit');
}

const PLANS = {
  Push: [['bench-press-barbell', 60, 8, 3], ['incline-bench-dumbbell', 22, 10, 3], ['overhead-press-dumbbell', 18, 10, 3], ['lateral-raise-dumbbell', 8, 14, 3], ['triceps-pushdown', 25, 12, 3]],
  Pull: [['pull-up', 0, 7, 3], ['barbell-row', 55, 9, 3], ['lat-pulldown', 50, 10, 3], ['face-pull', 20, 14, 2], ['curl-dumbbell', 12, 11, 3]],
  Beine: [['squat', 80, 6, 4], ['romanian-deadlift', 70, 9, 3], ['leg-press', 140, 11, 3], ['leg-curl-seated', 40, 12, 3], ['calf-raise-standing', 60, 14, 3]],
};

/** Six months of Push / Pull / Beine with steady progress, for realistic screens. */
function seedData(now) {
  const names = Object.keys(PLANS);
  const routines = names.map((name) => ({
    id: `r-${name.toLowerCase()}`,
    name,
    items: PLANS[name].map(([exerciseId, weight, reps, sets]) => ({
      exerciseId, sets: Array.from({ length: sets }, () => ({ weight: weight || null, reps })),
    })),
  }));
  const logs = [];
  const days = 72;
  for (let i = 0; i < days; i++) {
    const date = new Date(now - Math.round((days - i) * 2.4) * DAY).setHours(18, (i * 7) % 50, 0, 0);
    const round = Math.floor(i / 3);
    PLANS[names[i % 3]].forEach(([exerciseId, weight, reps, sets], k) => logs.push({
      id: `l-${i}-${k}`,
      exerciseId,
      date,
      sets: Array.from({ length: sets }, (_, s) => ({
        weight: weight ? Math.round((weight * (1 + round * 0.012) + ((round + k) % 4 === 3 ? -2.5 : 0)) / 2.5) * 2.5 : 0,
        reps: Math.max(3, reps + ((round + k) % 3) - s + (weight ? 0 : Math.floor(round / 6))),
      })),
    }));
  }
  return { version: 2, exercises: [], deletedBuiltins: [], routines, logs, settings: { lang: 'de', theme: 'midnight', lastExport: null } };
}

const { name: engine, browser } = await launch();
// BASE_URL runs the same checks against a deployed copy instead of a local server.
const server = process.env.BASE_URL ? null : createStaticServer().listen(0);
const base = process.env.BASE_URL ?? `http://localhost:${server.address().port}/`;
await mkdir(SHOTS, { recursive: true });

const problems = [];
// Playwright injects a <style> while taking a screenshot. The app's CSP blocks
// it (as it should) and logs an error; that one message is not the app's fault.
let lastShot = 0;
const fromScreenshot = (text) => /Refused to apply a stylesheet/.test(text) && Date.now() - lastShot < 1000;
const watch = (page) => {
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error' && !fromScreenshot(message.text())) problems.push(`console: ${message.text()}`);
  });
};

let failed = false;
let activePage = null;
try {
  const context = await browser.newContext({ ...devices['iPhone 14'], locale: 'de-DE', serviceWorkers: 'block', acceptDownloads: true });
  const page = await context.newPage();
  activePage = page;
  page.setDefaultTimeout(6000);
  watch(page);

  const shot = async (name, fullPage = false) => {
    await page.waitForTimeout(350); // let sheet and toast transitions finish
    lastShot = Date.now();
    await page.screenshot({ path: `${SHOTS}${name}.png`, fullPage });
    lastShot = Date.now();
  };
  const text = (value) => page.getByText(value, { exact: true }).first();
  const see = (target) => (typeof target === 'string' ? text(target) : target).waitFor();
  const heading = (name) => page.getByRole('heading', { name, exact: true });
  const button = (name) => page.getByRole('button', { name, exact: true });
  const weight = (set, exercise) => page.getByLabel(`Gewicht in kg, Satz ${set}, ${exercise}`, { exact: true });
  const reps = (set, exercise) => page.getByLabel(`Wiederholungen, Satz ${set}, ${exercise}`, { exact: true });
  // Sets a weight on the wheel: open it, turn both columns, confirm.
  const spin = async (field, value) => {
    await field.click();
    const columns = page.locator('.wheel-col');
    await columns.first().waitFor();
    await columns.nth(0).evaluate((el, index) => { el.scrollTop = index * 44; }, Math.floor(value));
    await columns.nth(1).evaluate((el, index) => { el.scrollTop = index * 44; }, Math.round((value % 1) * 4));
    await page.getByRole('dialog').getByRole('button', { name: 'Fertig', exact: true }).click();
    await columns.first().waitFor({ state: 'hidden' });
  };
  const tab = (name) => page.locator('.tabbar').getByRole('button', { name });
  const goBack = () => page.locator('.topbar-back').click();
  const exerciseRow = (name) => page.locator('.row').filter({ has: page.getByText(name, { exact: true }) });
  const entries = () => page.locator('.entry');
  const top = () => page.evaluate(() => window.scrollTo(0, 0));
  const step = async (title, run) => {
    await run();
    console.log(`  ok  ${title}`);
  };

  console.log(`Eisen e2e (${engine}) against ${base}`);

  await step('starts empty, in German and in the midnight theme', async () => {
    await page.goto(base);
    await see(heading('Trainingsplan'));
    await see('Noch kein Trainingsplan');
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'midnight');
    assert.equal(await page.evaluate(() => document.documentElement.lang), 'de');
    await shot('01-empty');
  });

  await step('creates a plan with exercises, sets, reps and weights', async () => {
    await button('Plan erstellen').click();
    const name = page.getByLabel('Name des Plans', { exact: true });
    await name.waitFor();
    assert.equal(await name.evaluate((el) => el === document.activeElement), true, 'name field is focused');
    await name.fill('Push');
    await button('Übung hinzufügen').click();
    await page.getByLabel('Übung suchen').fill('bankdru');
    await button(`${BENCH} Brust`).click();
    await page.getByLabel('Übung suchen').fill('SEITH');
    await button(`${RAISE} Schultern`).click();
    await shot('02-picker');
    await button('Hinzufügen (2)').click();
    await see(weight(3, RAISE));
    await spin(weight(1, BENCH), 60);
    assert.equal(await weight(1, BENCH).textContent(), '60');
    await weight(2, BENCH).click(); // an empty set opens the wheel where the set above stands
    await page.locator('.wheel-item.on').first().waitFor();
    assert.deepEqual(await page.locator('.wheel-item.on').allTextContents(), ['60', ',00']);
    await shot('03-wheel');
    await button('Abbrechen').click();
    await page.locator('.wheel-col').first().waitFor({ state: 'hidden' });
    await reps(1, BENCH).fill('8');
    assert.equal(await weight(2, BENCH).textContent(), '60', 'an empty set means "same as above"');
    assert.match(await weight(2, BENCH).getAttribute('class'), /hint/);
    assert.equal(await reps(3, BENCH).getAttribute('placeholder'), '8');
    await button(`Satz 3 löschen, ${RAISE}`).click();
    await weight(3, RAISE).waitFor({ state: 'hidden' });
    await shot('03-plan', true);
    await button('Fertig').click();
    await see('2 Übungen · 5 Sätze');
  });

  await step('keeps the plan after a reload; an untouched new plan is discarded', async () => {
    await page.reload();
    await see('2 Übungen · 5 Sätze');
    await button('Neuer Plan').click();
    await page.getByLabel('Name des Plans', { exact: true }).waitFor();
    await goBack();
    await see('Push');
    assert.equal(await page.locator('.routine').count(), 1);
  });

  await step('logs an exercise from the plan, starting with the plan values', async () => {
    await page.locator('.routine-body').click();
    await page.locator('.ex-card', { hasText: BENCH }).getByRole('button', { name: 'Ins Logbuch' }).click();
    await see(heading(BENCH));
    await see('Vorausgefüllt mit den Werten aus deinem Plan. Passe an, was du wirklich geschafft hast.');
    assert.equal(await weight(3, BENCH).textContent(), '60');
    assert.equal(await reps(3, BENCH).inputValue(), '8');
    await spin(weight(2, BENCH), 62.5);
    assert.equal(await weight(2, BENCH).textContent(), '62,5');
    await reps(2, BENCH).fill('7');
    await button(`Satz 3 löschen, ${BENCH}`).click();
    await shot('04-entry');
    await button('Eintrag speichern').click();
    await see('Eintrag gespeichert');
    await see(page.locator('.topbar-title', { hasText: 'Plan' }));
    assert.match(await weight(2, BENCH).getAttribute('class'), /hint/, 'logging does not change the plan');
    await goBack();
    await see(heading('Trainingsplan'));
  });

  await step('the logbook shows what was lifted on which exercise', async () => {
    await tab('Logbuch').click();
    await see('Deine Übungen');
    assert.equal(await page.locator('.row .fig').count(), await page.locator('.row').count(), 'every exercise has a picture');
    await see(exerciseRow(BENCH).getByText('62,5 kg × 7'));
    await see(exerciseRow(BENCH).getByText('Bestwert 62,5 kg'));
    await exerciseRow(BENCH).click();
    await see(heading(BENCH));
    await see('Höchstes Gewicht');
    // The picture: chest is the main muscle (two shapes), triceps and shoulders support (six).
    const figure = page.getByRole('img', { name: 'Trainierte Muskeln: Brust, Trizeps, Schultern' });
    await figure.waitFor();
    assert.equal(await figure.locator('.primary').count(), 2);
    assert.equal(await figure.locator('.secondary').count(), 6);
    await see('Hauptmuskeln');
    await page.locator('.chart svg').waitFor();
    assert.equal(await page.locator('.chart-dot:not(.chart-focus)').count(), 1);
    assert.equal(await entries().count(), 1);
  });

  await step('adds an old personal record by hand, with its date', async () => {
    await button('Eintrag hinzufügen').click();
    await page.getByText('Vorausgefüllt mit deinem letzten Eintrag', { exact: false }).waitFor();
    assert.equal(await weight(2, BENCH).textContent(), '62,5');
    await page.getByLabel('Datum').fill('2024-05-01');
    await spin(weight(1, BENCH), 100);
    await weight(2, BENCH).click(); // a set with a value can be cleared again
    await button('62,5 kg entfernen').click();
    assert.equal(await weight(2, BENCH).textContent(), '–');
    await reps(1, BENCH).fill('1');
    await button(`Satz 2 löschen, ${BENCH}`).click();
    await button('Speichern').click();
    await see('Eintrag gespeichert');
    await see('100 kg × 1');
    assert.equal(await entries().count(), 2);
    await see(page.locator('.tile', { hasText: 'Höchstes Gewicht' }).getByText('100 kg'));
    await see(page.locator('.tile', { hasText: 'Höchstes Gewicht' }).getByText('1. Mai 2024'));
    assert.equal(await page.locator('.badge').count(), 0, 'nothing beats the old record yet');
  });

  await step('a heavier entry is flagged as a record; entries can be edited and deleted', async () => {
    await button('Eintrag hinzufügen').click();
    await spin(weight(1, BENCH), 105);
    await reps(1, BENCH).fill('1');
    await button(`Satz 2 löschen, ${BENCH}`).click();
    await button('Eintrag speichern').click();
    await see('Neuer Bestwert!');
    assert.equal(await entries().count(), 3);
    assert.equal(await page.locator('.badge', { hasText: 'Bestwert' }).count(), 1);

    await entries().first().click();
    await see(heading(BENCH));
    await see('Eintrag bearbeiten');
    await spin(weight(1, BENCH), 106.25);
    await button('Speichern').click();
    await see('106,25 kg × 1');

    await entries().first().click();
    await button('Eintrag löschen').click();
    await page.getByRole('dialog').getByRole('button', { name: 'Eintrag löschen' }).click();
    await see('Eintrag gelöscht');
    assert.equal(await entries().count(), 2);
    assert.equal(await page.getByText('106,25 kg × 1').count(), 0);
  });

  await step('an entry needs at least one set with reps; cancelling keeps nothing', async () => {
    await button('Eintrag hinzufügen').click();
    await reps(1, BENCH).fill('');
    await reps(2, BENCH).fill('');
    await button('Eintrag speichern').click();
    await see('Trag mindestens einen Satz mit Wiederholungen ein.');
    await button('Satz hinzufügen').click();
    await see(weight(3, BENCH));
    await goBack();
    await see('Höchstes Gewicht');
    assert.equal(await entries().count(), 2);
    await button('Eintrag hinzufügen').click();
    await weight(2, BENCH).waitFor();
    assert.equal(await weight(3, BENCH).count(), 0, 'a cancelled draft is not kept');
    await goBack();
    await see('Höchstes Gewicht');
  });

  await step('bodyweight exercises are logged with reps only', async () => {
    await goBack();
    await page.getByLabel('Übung suchen').fill('klimmzüge');
    await exerciseRow('Klimmzüge').click();
    await see('Noch keine Einträge');
    await button('Eintrag hinzufügen').click();
    await reps(1, 'Klimmzüge').fill('8');
    await reps(2, 'Klimmzüge').fill('6');
    await button('Eintrag speichern').click();
    await see('8 Wdh.');
    await see('Meiste Wdh. (Satz)');
    await see('Meiste Wiederholungen in einem Satz');
    await goBack();
    await page.getByLabel('Übung suchen').fill('');
  });

  await step('creates and deletes a custom exercise; used exercises cannot be deleted', async () => {
    await button('Neue Übung').click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('textbox').fill('kniebeugen');
    await dialog.getByRole('button', { name: 'Speichern' }).click();
    await see('Eine Übung mit diesem Namen gibt es schon.');
    await dialog.getByRole('textbox').fill('Landmine Press');
    await dialog.getByRole('button', { name: 'Schultern' }).click();
    await dialog.getByRole('button', { name: 'Speichern' }).click();
    await see(heading('Landmine Press'));
    await page.getByRole('img', { name: 'Trainierte Muskeln: Schultern' }).waitFor(); // custom exercises show their group
    await button('Optionen').click();
    await button('Löschen').click();
    await button('Übung löschen').click();
    await see(heading('Logbuch'));
    await exerciseRow(BENCH).click();
    await button('Optionen').click();
    await button('Löschen').click();
    await button('Übung löschen').click();
    await see('Die Übung hat Einträge oder steht in einem Plan.');
  });

  await step('language: English translates the interface, exercises and numbers', async () => {
    await tab('Einstellungen').click();
    await page.getByLabel('Sprache').selectOption('en');
    await see(heading('Settings'));
    assert.equal(await page.evaluate(() => document.documentElement.lang), 'en');
    await tab('Logbook').click();
    await see('Your exercises');
    await see(exerciseRow('Bench press (barbell)').getByText('Best 100 kg'));
    await exerciseRow('Bench press (barbell)').click();
    await see('Heaviest weight');
    await button('Add entry').click();
    assert.equal(await page.getByLabel('Weight in kg, set 2, Bench press (barbell)').textContent(), '62.5');
    await shot('05-english');
    await goBack();
    await see('Heaviest weight');
    await page.reload();
    await see('Heaviest weight');
    await tab('Settings').click();
    await page.getByLabel('Language').selectOption('de');
    await see(heading('Einstellungen'));
  });

  await step('theme: black can be chosen and is remembered', async () => {
    const background = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    assert.equal(await background(), 'rgb(10, 15, 30)');
    await button('Schwarz').click();
    assert.equal(await background(), 'rgb(0, 0, 0)');
    assert.equal(await page.locator('meta[name=theme-color]').getAttribute('content'), '#000000');
    await page.reload();
    await see(heading('Einstellungen'));
    assert.equal(await background(), 'rgb(0, 0, 0)');
    await button('Midnight').click();
    assert.equal(await background(), 'rgb(10, 15, 30)');
  });

  await step('renders six months of entries', async () => {
    await page.goto(base);
    await page.evaluate((json) => {
      localStorage.clear();
      localStorage.setItem('eisen.data.v1', json);
    }, JSON.stringify(seedData(Date.now())));
    await page.reload();
    await see('Beine');
    await shot('06-plans');
    await page.locator('.routine-body').first().click();
    await see(page.locator('.topbar-title', { hasText: 'Plan' }));
    await shot('07-plan', true);
    await top();
    await tab('Logbuch').click();
    await see('Deine Übungen');
    await shot('08-logbook');
    await button('Beine').click();
    assert.equal(await page.locator('.list').first().locator('.row').count(), 5);
    await button('Alle').click();
    await exerciseRow(BENCH).click();
    await page.locator('.chart svg').waitFor();
    assert.equal(await entries().count(), 15, 'the entry list shows one page at first');
    await shot('09-exercise');
    await shot('10-exercise-full', true);
    await button('Alle 24 Einträge anzeigen').click();
    assert.equal(await entries().count(), 24);
    await top();
  });

  await step('chart: metric, range and tooltip', async () => {
    const dots = page.locator('.chart-dot:not(.chart-focus)');
    assert.equal(await dots.count(), 24);
    await button('3 Monate').click();
    await page.locator('.chart svg').waitFor();
    const recent = await dots.count();
    assert.ok(recent > 5 && recent < 24, `${recent} entries in three months`);
    await button('Volumen').click();
    await see('Volumen pro Eintrag');
    await page.locator('.chart svg').evaluate((el) => el.scrollIntoView({ block: 'center' }));
    const box = await page.locator('.chart svg').boundingBox();
    await page.mouse.move(box.x + box.width * 0.6, box.y + box.height / 2);
    await see(page.locator('.chart-tip'));
    assert.match(await page.locator('.chart-tip strong').textContent(), /kg$/);
    await button('Alles').click();
    await button('Gewicht').click();
  });

  await step('the black theme renders the same screens', async () => {
    await tab('Einstellungen').click();
    await button('Schwarz').click();
    await shot('11-settings-black', true);
    await top();
    await tab('Logbuch').click();
    await exerciseRow(BENCH).click();
    await page.locator('.chart svg').waitFor();
    await shot('12-exercise-black');
    await tab('Pläne').click();
    await shot('13-plans-black');
    await tab('Einstellungen').click();
    await button('Midnight').click();
  });

  await step('backup export and import, delete all data', async () => {
    await page.getByText('Letztes Backup: noch nie.', { exact: false }).waitFor();
    // With an iPhone user agent the app hands the file to the share sheet when
    // the engine supports sharing files; otherwise it downloads it.
    const canShare = await page.evaluate(() => typeof navigator.canShare === 'function'
      && navigator.canShare({ files: [new File(['{}'], 'x.json', { type: 'application/json' })] }));
    let file;
    if (canShare) {
      await page.evaluate(() => Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: async ({ files }) => {
          window.sharedBackup = { name: files[0].name, text: await files[0].text() };
        },
      }));
      await button('Backup exportieren').click();
      file = await (await page.waitForFunction(() => window.sharedBackup)).jsonValue();
    } else {
      const [download] = await Promise.all([page.waitForEvent('download'), button('Backup exportieren').click()]);
      file = { name: download.suggestedFilename(), text: await readFile(await download.path(), 'utf8') };
    }
    assert.match(file.name, /^eisen-backup-\d{4}-\d\d-\d\d\.json$/);
    const backup = JSON.parse(file.text);
    assert.equal(backup.app, 'eisen');
    assert.equal(backup.data.logs.length, 360);
    await page.getByText('Letztes Backup: heute.', { exact: false }).waitFor();

    await button('Alle Daten löschen').click();
    await button('Alles löschen').click();
    await page.getByText('· 0 Einträge · 0 Pläne', { exact: false }).waitFor();

    const upload = { name: 'backup.json', mimeType: 'application/json' };
    await page.locator('input[type=file]').setInputFiles({ ...upload, buffer: Buffer.from('{"app":"other"}') });
    await see('Diese Datei ist kein gültiges Eisen-Backup.');
    await page.locator('input[type=file]').setInputFiles({ ...upload, buffer: Buffer.from(JSON.stringify(backup)) });
    await button('Daten ersetzen').click();
    await page.getByText('· 360 Einträge · 3 Pläne', { exact: false }).waitFor();
  });

  await step('data of the first version (workouts) is migrated to entries', async () => {
    const v1 = {
      version: 1,
      exercises: [{ id: 'squat', name: 'Kniebeugen', muscle: 'Beine' }, { id: 'c-1', name: 'Landmine Press', muscle: 'Schultern', custom: true }],
      routines: [{ id: 'r1', name: 'Beine', items: [{ exerciseId: 'squat', sets: [{ weight: 100, reps: 5 }] }] }],
      workouts: [{
        id: 'w1', name: 'Beine', routineId: 'r1', start: Date.now() - DAY, end: Date.now() - DAY + 3_600_000,
        items: [{ exerciseId: 'squat', sets: [{ weight: 100, reps: 5 }] }, { exerciseId: 'c-1', sets: [{ weight: 30, reps: 8 }] }],
      }],
      settings: { restSeconds: 90, sound: true, lastExport: null },
    };
    await page.evaluate((json) => localStorage.setItem('eisen.data.v1', json), JSON.stringify(v1));
    await page.goto(`${base}#/exercises`);
    await page.reload();
    await see('Deine Übungen');
    await see(exerciseRow('Kniebeugen').getByText('100 kg × 5'));
    await see(exerciseRow('Landmine Press').getByText('Schultern · gestern'));
  });

  await step('unknown routes fall back to the start page', async () => {
    await page.goto(`${base}#/nope/123`);
    await see(heading('Trainingsplan'));
    await page.goto(`${base}#/exercise/does-not-exist`);
    await see(heading('Logbuch'));
    await page.goto(`${base}#/log/squat/does-not-exist`);
    await see(heading('Kniebeugen'));
  });

  await step('layout fits a small phone without sideways scrolling', async () => {
    await page.setViewportSize({ width: 320, height: 568 });
    for (const path of ['#/', '#/routine/r1', '#/exercises', '#/exercise/squat', '#/log/squat/new', '#/settings']) {
      await page.goto(base + path);
      await page.locator('.page').waitFor();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      assert.ok(overflow <= 0, `${path} overflows by ${overflow}px`);
    }
    await shot('14-small-phone');
  });
  await context.close();

  // Offline: with the service worker active, the app must load without a network.
  const offline = await browser.newContext({ ...devices['iPhone 14'], locale: 'de-DE' });
  const offlinePage = await offline.newPage();
  watch(offlinePage);
  try {
    await offlinePage.goto(base);
    await offlinePage.evaluate(async () => {
      await navigator.serviceWorker.ready;
      for (let i = 0; i < 100 && !navigator.serviceWorker.controller; i++) await new Promise((r) => setTimeout(r, 50));
    });
    await offline.setOffline(true);
    await offlinePage.reload();
    await offlinePage.getByRole('heading', { name: 'Trainingsplan', exact: true }).waitFor({ timeout: 6000 });
    await offlinePage.locator('.tabbar').getByRole('button', { name: 'Logbuch' }).click();
    await offlinePage.getByText('Alle Übungen', { exact: true }).waitFor({ timeout: 6000 });
    console.log('  ok  loads and navigates offline');
  } finally {
    await offline.close();
  }

  assert.deepEqual(problems, [], 'no console errors');
  console.log('All e2e steps passed.');
} catch (error) {
  failed = true;
  await activePage?.screenshot({ path: `${SHOTS}failure.png` }).catch(() => {});
  console.error(`Page: ${activePage?.url()}`);
  console.error(`\nFAILED: ${error.stack ?? error}`);
  if (problems.length) console.error(`Browser problems:\n${problems.join('\n')}`);
} finally {
  await browser.close();
  server?.close();
}
process.exit(failed ? 1 : 0);
