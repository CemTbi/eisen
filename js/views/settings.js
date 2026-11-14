// Settings: rest timer, backup and restore.

import { sectionHead, topbar } from '../components.js';
import { REST_OPTIONS, fromBackup, toBackup } from '../model.js';
import { back, rerender } from '../router.js';
import { replaceData, resetAll, save, state } from '../store.js';
import { confirm, toast } from '../ui.js';
import { APP_VERSION, fmtClock, fmtRelative, h, icon, isIOS, isStandalone, plural } from '../util.js';

const MAX_BACKUP_BYTES = 20 * 1024 * 1024;

export function settingsView() {
  const { settings, workouts, routines } = state.data;

  const restSelect = h('select', {
    class: 'field select',
    'aria-label': 'Pause nach jedem Satz',
    onchange: (event) => {
      settings.restSeconds = Number(event.target.value);
      save();
      rerender();
    },
  }, REST_OPTIONS.map((seconds) => h('option', { value: String(seconds) }, seconds ? `${fmtClock(seconds * 1000)} min` : 'Aus')));
  restSelect.value = String(settings.restSeconds);

  const soundToggle = h('input', {
    type: 'checkbox',
    checked: settings.sound,
    disabled: !settings.restSeconds,
    onchange: (event) => {
      settings.sound = event.target.checked;
      save();
    },
  });

  const fileInput = h('input', {
    type: 'file',
    accept: 'application/json,.json',
    hidden: true,
    onchange: (event) => {
      importBackup(event.target.files[0]);
      event.target.value = '';
    },
  });

  const reset = async () => {
    const ok = await confirm({
      title: 'Alle Daten löschen?',
      message: `${plural(workouts.length, 'Training', 'Trainings')} und ${plural(routines.length, 'Plan', 'Pläne')} `
        + 'werden unwiderruflich von diesem Gerät gelöscht.',
      confirmLabel: 'Alles löschen',
      danger: true,
    });
    if (!ok) return;
    resetAll();
    toast('Alle Daten gelöscht');
    rerender({ top: true });
  };

  const node = h('div', { class: 'page' },
    topbar({ title: 'Einstellungen', onBack: () => back('/') }),

    sectionHead('Pausentimer'),
    h('div', { class: 'list' },
      h('label', { class: 'row' },
        h('span', { class: 'row-main' },
          h('span', { class: 'row-title' }, 'Pause nach jedem Satz'),
          h('span', { class: 'meta' }, 'Startet, sobald du einen Satz abhakst')),
        restSelect),
      h('label', { class: 'row' },
        h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, 'Ton am Ende der Pause')),
        h('span', { class: 'switch' }, soundToggle, h('i')))),

    sectionHead('Backup'),
    h('p', { class: 'hint' },
      'Deine Daten liegen nur auf diesem Gerät. Sichere sie ab und zu als Datei, zum Beispiel in iCloud Drive. '
      + `Letztes Backup: ${settings.lastExport ? fmtRelative(settings.lastExport) : 'noch nie'}.`),
    h('div', { class: 'list' },
      h('button', { class: 'row', onclick: exportBackup },
        icon('download', 20), h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, 'Backup exportieren'))),
      h('button', { class: 'row', onclick: () => fileInput.click() },
        icon('upload', 20), h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, 'Backup importieren'))),
      h('button', { class: 'row danger', onclick: reset },
        icon('trash', 20), h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, 'Alle Daten löschen')))),
    fileInput,

    isIOS() && !isStandalone() && [
      sectionHead('Installation'),
      h('p', { class: 'hint' },
        'Für Vollbild und Offline-Nutzung: in Safari auf „Teilen“ tippen und „Zum Home-Bildschirm“ wählen. '
        + 'Die installierte App hat einen eigenen Speicher, übertrage vorhandene Daten per Backup.'),
    ],

    h('p', { class: 'footnote' },
      `Eisen ${APP_VERSION} · ${plural(workouts.length, 'Training', 'Trainings')} · ${plural(routines.length, 'Plan', 'Pläne')}`));
  return { node, tab: 'train' };
}

async function exportBackup() {
  const now = Date.now();
  const stamp = new Date(now - new Date(now).getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
  const name = `eisen-backup-${stamp}.json`;
  const file = new File([JSON.stringify(toBackup(state.data, now))], name, { type: 'application/json' });
  try {
    if (isIOS() && navigator.canShare?.({ files: [file] })) {
      // The share sheet offers "In Dateien sichern", AirDrop and so on.
      await navigator.share({ files: [file] });
    } else {
      const url = URL.createObjectURL(file);
      const link = h('a', { href: url, download: name });
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    }
  } catch (error) {
    if (error?.name !== 'AbortError') toast('Export fehlgeschlagen', { kind: 'error' });
    return;
  }
  state.data.settings.lastExport = now;
  save();
  rerender();
}

async function importBackup(file) {
  if (!file) return;
  let data;
  try {
    if (file.size > MAX_BACKUP_BYTES) throw new RangeError('Datei zu groß');
    data = fromBackup(JSON.parse(await file.text()));
  } catch {
    toast('Diese Datei ist kein gültiges Eisen-Backup.', { kind: 'error' });
    return;
  }
  const ok = await confirm({
    title: 'Backup einspielen?',
    message: `Das Backup enthält ${plural(data.workouts.length, 'Training', 'Trainings')} und `
      + `${plural(data.routines.length, 'Plan', 'Pläne')}. Die aktuellen Daten auf diesem Gerät werden ersetzt.`,
    confirmLabel: 'Daten ersetzen',
    danger: true,
  });
  if (!ok) return;
  if (replaceData(data)) toast('Backup eingespielt');
  rerender({ top: true });
}
