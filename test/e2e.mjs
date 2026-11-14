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

/** Six months of Push / Pull / Beine with steady progress, for realistic screens. */
function seedData(now) {
  const plans = {
    Push: [['bench-press-barbell', 60, 8, 3], ['incline-bench-dumbbell', 22, 10, 3], ['overhead-press-dumbbell', 18, 10, 3], ['lateral-raise-dumbbell', 8, 14, 3], ['triceps-pushdown', 25, 12, 3]],
    Pull: [['pull-up', 0, 7, 3], ['barbell-row', 55, 9, 3], ['lat-pulldown', 50, 10, 3], ['face-pull', 20, 14, 2], ['curl-dumbbell', 12, 11, 3]],
    Beine: [['squat', 80, 6, 4], ['romanian-deadlift', 70, 9, 3], ['leg-press', 140, 11, 3], ['leg-curl-seated', 40, 12, 3], ['calf-raise-standing', 60, 14, 3]],
  };
  const names = Object.keys(plans);
  const routines = names.map((name) => ({
    id: `r-${name.toLowerCase()}`,
    name,
    items: plans[name].map(([exerciseId, weight, reps, count]) => ({
      exerciseId, sets: Array.from({ length: count }, () => ({ weight: weight || null, reps })),
    })),
  }));
  const workouts = [];
  const sessions = 72;
  for (let i = 0; i < sessions; i++) {
    const name = names[i % 3];
    const daysAgo = Math.round((sessions - i) * 2.4);
    const start = new Date(now - daysAgo * DAY).setHours(18, (i * 7) % 50, 0, 0);
    const round = Math.floor(i / 3);
    workouts.push({
      id: `w-${i}`,
      name,
      routineId: `r-${name.toLowerCase()}`,
      start,
      end: start + (52 + (i % 5) * 6) * 60_000,
      items: plans[name].map(([exerciseId, weight, reps, count], k) => ({
        exerciseId,
        sets: Array.from({ length: count }, (_, s) => ({
          weight: weight ? Math.round((weight * (1 + round * 0.012) + ((round + k) % 4 === 3 ? -2.5 : 0)) / 2.5) * 2.5 : 0,
          reps: Math.max(3, reps + ((round + k) % 3) - s + (weight ? 0 : Math.floor(round / 6))),
        })),
      })),
    });
  }
  return { version: 1, exercises: [], deletedBuiltins: [], routines, workouts, settings: { restSeconds: 90, sound: true, lastExport: null } };
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
  const see = (target) => (typeof target === 'string' ? page.getByText(target, { exact: true }).first() : target).waitFor();
  const gone = (target) => (typeof target === 'string' ? page.getByText(target, { exact: true }).first() : target).waitFor({ state: 'hidden' });
  const button = (name) => page.getByRole('button', { name, exact: true });
  const weight = (set, exercise) => page.getByLabel(`Gewicht in kg, Satz ${set}, ${exercise}`, { exact: true });
  const reps = (set, exercise) => page.getByLabel(`Wiederholungen, Satz ${set}, ${exercise}`, { exact: true });
  const check = (set, exercise) => button(`Satz ${set} abhaken, ${exercise}`);
  const exerciseRow = (name) => page.locator('.row').filter({ has: page.getByText(name, { exact: true }) });
  const tab = (name) => page.locator('.tabbar').getByRole('button', { name });
  const step = async (title, run) => {
    await run();
    console.log(`  ok  ${title}`);
  };

  console.log(`Eisen e2e (${engine}) against ${base}`);

  await step('starts empty', async () => {
    await page.goto(base);
    await see(page.getByRole('heading', { name: 'Training', exact: true }));
    await see('Noch kein Trainingsplan');
    await shot('01-empty');
  });

  await step('creates a plan with two exercises', async () => {
    await button('Plan erstellen').click();
    const name = page.getByLabel('Name des Plans');
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
    await weight(1, BENCH).fill('60');
    await reps(1, BENCH).fill('8');
    assert.equal(await weight(2, BENCH).getAttribute('placeholder'), '60', 'set 2 suggests the weight of set 1');
    assert.equal(await reps(3, BENCH).getAttribute('placeholder'), '8');
    await shot('03-plan-editor', true);
    await button('Fertig').click();
    await see('2 Übungen · 6 Sätze');
  });

  await step('keeps the plan after a reload', async () => {
    await page.reload();
    await see('Push');
    await see('2 Übungen · 6 Sätze');
    await shot('04-plans');
  });

  await step('an untouched new plan is discarded', async () => {
    await button('Neuer Plan').click();
    await page.getByLabel('Name des Plans').waitFor();
    await button('Pläne').click();
    await see('Push');
    assert.equal(await page.locator('.routine').count(), 1);
  });

  await step('logs sets in a workout', async () => {
    await button('Training starten').click();
    await see(check(1, BENCH));
    assert.equal(await weight(1, BENCH).getAttribute('placeholder'), '60');
    assert.equal(await weight(3, BENCH).getAttribute('placeholder'), '60');
    await check(1, BENCH).click(); // accepts the suggestion
    assert.equal(await weight(1, BENCH).inputValue(), '60');
    assert.equal(await reps(1, BENCH).inputValue(), '8');
    await see(page.locator('.restbar'));
    await see('1 / 6');
    await see('480 kg');
    await weight(2, BENCH).fill('62,5');
    await reps(2, BENCH).fill('7');
    await check(2, BENCH).click();
    await see('917,5 kg');
    await check(1, RAISE).click(); // nothing to accept: asks for reps
    await see('Trag zuerst die Wiederholungen ein.');
    assert.equal(await check(1, RAISE).getAttribute('aria-pressed'), 'false');
    await weight(1, RAISE).fill('10');
    await reps(1, RAISE).fill('12');
    await check(1, RAISE).click();
    await see('3 / 6');
    await shot('05-workout', true);
  });

  await step('rest timer counts down and can be skipped', async () => {
    const time = page.locator('.restbar-time');
    assert.match(await time.textContent(), /^1:(30|[0-2]\d)$/);
    await button('15 Sekunden mehr').click();
    assert.match(await time.textContent(), /^1:4[0-5]$/);
    await page.locator('.restbar').getByRole('button', { name: 'Weiter' }).click();
    await gone(page.locator('.restbar'));
  });

  await step('editing a ticked set updates the totals; clearing reps unticks it', async () => {
    await reps(1, RAISE).fill('15');
    await see('1.067,5 kg');
    await reps(1, RAISE).fill('');
    await see('2 / 6');
    assert.equal(await check(1, RAISE).getAttribute('aria-pressed'), 'false');
    await reps(1, RAISE).fill('12');
    await check(1, RAISE).click();
    await see('1.037,5 kg');
    await page.locator('.restbar').getByRole('button', { name: 'Weiter' }).click();
  });

  await step('survives a reload in the middle of a workout', async () => {
    await page.reload();
    await see('3 / 6');
    assert.equal(await weight(2, BENCH).inputValue(), '62,5');
    assert.equal(await check(2, BENCH).getAttribute('aria-pressed'), 'true');
    assert.equal(await tab('Training').evaluate((el) => el.classList.contains('live')), true);
  });

  await step('adds and removes sets and exercises', async () => {
    const card = page.locator('.ex-card', { hasText: RAISE });
    await card.getByRole('button', { name: 'Satz hinzufügen' }).click();
    await see(weight(4, RAISE));
    await button('Satz 4, Optionen').nth(0).click();
    await button('Satz löschen').click();
    await gone(weight(4, RAISE));
    await button(`Optionen für ${RAISE}`).click();
    await button('Nach oben schieben').click();
    assert.equal(await page.locator('.ex-card').first().getAttribute('aria-label'), RAISE);
    await button(`Optionen für ${RAISE}`).click();
    await button('Nach unten schieben').click();
    assert.equal(await page.locator('.ex-card').first().getAttribute('aria-label'), BENCH);
  });

  let firstWorkoutUrl = '';
  await step('finishes the workout and saves only ticked sets', async () => {
    await button('Beenden').click();
    await see('3 offene Sätze werden nicht gespeichert.');
    await shot('06-finish');
    await button('Training speichern').click();
    await see(page.getByRole('heading', { name: 'Push', exact: true }));
    await see('1.037,5 kg');
    assert.equal(await page.locator('.set-list li').count(), 3);
    assert.equal(await page.getByText('Bestwert').count(), 0, 'a first workout has no records');
    firstWorkoutUrl = page.url();
    assert.match(firstWorkoutUrl, /#\/workout\//);
    await page.locator('.topbar-back').click();
    await see('1 Training');
    assert.equal(await page.locator('.workout-card').count(), 1);
  });

  await step('shows the exercise overview and progress', async () => {
    await tab('Übungen').click();
    await see('Deine Übungen');
    const row = exerciseRow(BENCH);
    await see(row.getByText('62,5 kg × 7'));
    await see(row.getByText('Bestwert 62,5 kg'));
    await row.click();
    await see(page.getByRole('heading', { name: BENCH, exact: true }));
    await see('Höchstes Gewicht');
    await page.locator('.chart svg').waitFor();
    assert.equal(await page.locator('.chart-dot:not(.chart-focus)').count(), 1);
  });

  await step('second workout: shows last time, flags records, updates the plan', async () => {
    await tab('Training').click();
    await button('Training starten').click();
    await see(button('Werte vom letzten Mal übernehmen: 60 × 8'));
    await see(button('Werte vom letzten Mal übernehmen: 62,5 × 7'));
    assert.equal(await weight(2, BENCH).getAttribute('placeholder'), '62,5');
    await weight(1, BENCH).fill('65');
    await reps(1, BENCH).fill('8');
    await check(1, BENCH).click();
    await button('Werte vom letzten Mal übernehmen: 62,5 × 7').click();
    assert.equal(await weight(2, BENCH).inputValue(), '62,5');
    await check(2, BENCH).click();
    await button('Beenden').click();
    await page.getByRole('checkbox').check();
    await button('Training speichern').click();
    await see(page.getByRole('heading', { name: 'Push', exact: true }));
    assert.equal(await page.locator('.badge', { hasText: 'Bestwert' }).count(), 1);
    await tab('Training').click();
    await page.locator('.routine-body').click();
    assert.equal(await weight(1, BENCH).inputValue(), '65');
    assert.equal(await weight(2, BENCH).inputValue(), '62,5');
    assert.equal(await weight(3, BENCH).inputValue(), '', 'a set that was open in the plan and not done stays open');
    assert.equal(await weight(3, BENCH).getAttribute('placeholder'), '62,5');
    await button('Fertig').click();
    await see('Meine Pläne'); // going back is asynchronous; wait for it before the next page load
  });

  await step('edits and deletes a logged workout', async () => {
    await page.goto(firstWorkoutUrl);
    await button('Optionen').click();
    await button('Bearbeiten').click();
    await weight(1, BENCH).fill('61');
    await button('Fertig').click();
    await see('61 kg × 8');
    await button('Optionen').click();
    await button('Löschen').click();
    await button('Training löschen').click();
    await see(page.getByRole('heading', { name: 'Verlauf', exact: true }));
    assert.equal(await page.locator('.workout-card').count(), 1);
  });

  await step('creates, renames and deletes a custom exercise', async () => {
    await tab('Übungen').click();
    await button('Neue Übung').click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('textbox').fill('kniebeugen');
    await dialog.getByRole('button', { name: 'Speichern' }).click();
    await see('Eine Übung mit diesem Namen gibt es schon.');
    await dialog.getByRole('textbox').fill('Landmine Press');
    await dialog.getByRole('button', { name: 'Schultern' }).click();
    await dialog.getByRole('button', { name: 'Speichern' }).click();
    await page.getByLabel('Übung suchen').fill('landmine');
    await page.locator('.row', { hasText: 'Landmine Press' }).click();
    await see('Noch keine Daten');
    await button('Optionen').click();
    await button('Löschen').click();
    await button('Übung löschen').click();
    await see('Keine Übung gefunden');
    await page.getByLabel('Übung suchen').fill('');
    await exerciseRow(BENCH).click();
    await button('Optionen').click();
    await button('Löschen').click();
    await button('Übung löschen').click();
    await see('Die Übung wird in Plänen oder Trainings verwendet.');
  });

  await step('renders six months of history', async () => {
    const data = seedData(Date.now());
    await page.goto(base);
    await page.evaluate((json) => {
      localStorage.clear();
      localStorage.setItem('eisen.data.v1', json);
    }, JSON.stringify(data));
    await page.reload();
    await see('Beine');
    await shot('07-home', true);
    await tab('Verlauf').click();
    await see(page.getByRole('heading', { name: 'Verlauf', exact: true }));
    assert.equal(await page.locator('.workout-card').count(), 40, 'the logbook shows one page at first');
    await button('Ältere Trainings anzeigen').click();
    assert.equal(await page.locator('.workout-card').count(), 72);
    await page.evaluate(() => window.scrollTo(0, 0));
    await shot('08-history');
    await page.locator('.workout-card').first().click();
    await see('Dauer');
    await shot('09-workout-detail', true);
    await tab('Übungen').click();
    await see('Deine Übungen');
    await shot('10-exercises');
    await button('Beine').click();
    assert.equal(await page.locator('.list').first().locator('.row').count(), 5);
    await button('Alle').click();
    await exerciseRow(BENCH).click();
    await page.locator('.chart svg').waitFor();
    assert.equal(await page.locator('.set-list').count(), 15);
    await shot('11-exercise');
    await button('Alle 24 Trainings anzeigen').click();
    assert.equal(await page.locator('.set-list').count(), 24);
    await page.evaluate(() => window.scrollTo(0, 0));
  });

  await step('chart: metric, range and tooltip', async () => {
    const dots = page.locator('.chart-dot:not(.chart-focus)');
    assert.equal(await dots.count(), 24);
    await button('3 Monate').click();
    await page.locator('.chart svg').waitFor();
    const recent = await dots.count();
    assert.ok(recent > 5 && recent < 24, `${recent} sessions in three months`);
    await button('Volumen').click();
    await see('Volumen pro Training');
    const box = await page.locator('.chart svg').boundingBox();
    await page.mouse.move(box.x + box.width * 0.6, box.y + box.height / 2);
    await see(page.locator('.chart-tip'));
    assert.match(await page.locator('.chart-tip strong').textContent(), /kg$/);
    await shot('12-chart-tooltip');
    await button('Alles').click();
    await button('Gewicht').click();
  });

  await step('bodyweight exercises track reps', async () => {
    await page.locator('.topbar-back').click();
    await page.locator('.row', { hasText: /^Klimmzüge/ }).first().click();
    await see('Meiste Wdh. (Satz)');
    await see('Meiste Wiederholungen in einem Satz');
    await shot('13-bodyweight', true);
  });

  await step('backup export and import', async () => {
    await tab('Training').click();
    await button('Einstellungen').click();
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
    assert.equal(backup.data.workouts.length, 72);
    await page.getByText('Letztes Backup: heute.', { exact: false }).waitFor();
    await shot('14-settings', true);

    await button('Alle Daten löschen').click();
    await button('Alles löschen').click();
    await page.getByText('· 0 Trainings ·', { exact: false }).waitFor();

    const upload = { name: 'backup.json', mimeType: 'application/json' };
    await page.locator('input[type=file]').setInputFiles({ ...upload, buffer: Buffer.from('{"app":"other"}') });
    await see('Diese Datei ist kein gültiges Eisen-Backup.');
    await page.locator('input[type=file]').setInputFiles({ ...upload, buffer: Buffer.from(JSON.stringify(backup)) });
    await button('Daten ersetzen').click();
    await page.getByText('· 72 Trainings ·', { exact: false }).waitFor();
  });

  await step('settings: rest timer off means no countdown', async () => {
    await page.getByLabel('Pause nach jedem Satz').selectOption('0');
    await button('Zurück').click();
    await button('Freies Training starten').click();
    await button('Übung hinzufügen').click();
    await button('Kniebeugen Beine').click();
    await button('Hinzufügen (1)').click();
    assert.equal(await page.locator('.ex-card .check').count(), 4, 'starts with as many sets as last time');
    await check(1, 'Kniebeugen').click();
    await see('1 / 4');
    assert.equal(await page.locator('.restbar').isHidden(), true);
    await button('Training verwerfen').click();
    await button('Verwerfen').click();
    await see('Meine Pläne');
  });

  await step('unknown routes fall back to the start page', async () => {
    await page.goto(`${base}#/nope/123`);
    await see(page.getByRole('heading', { name: 'Training', exact: true }));
    await page.goto(`${base}#/workout/does-not-exist`);
    await see(page.getByRole('heading', { name: 'Verlauf', exact: true }));
  });

  await step('layout fits a small phone without sideways scrolling', async () => {
    await page.setViewportSize({ width: 320, height: 568 });
    for (const path of ['#/', '#/history', '#/exercises', '#/exercise/bench-press-barbell', '#/settings']) {
      await page.goto(base + path);
      await page.locator('.page').waitFor();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      assert.ok(overflow <= 0, `${path} overflows by ${overflow}px`);
    }
    await page.goto(base);
    await button('Training starten').first().click();
    await page.locator('.ex-card').first().waitFor();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(overflow <= 0, `workout overflows by ${overflow}px`);
    await shot('15-small-phone');
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
    await offlinePage.getByRole('heading', { name: 'Training', exact: true }).waitFor({ timeout: 6000 });
    await offlinePage.getByRole('button', { name: 'Einstellungen' }).click();
    await offlinePage.getByText('Pausentimer').waitFor({ timeout: 6000 });
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
