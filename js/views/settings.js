// Settings tab: language, theme, backup and restore.

import { applyAppearance } from '../appearance.js';
import { pageHead, sectionHead, segmented } from '../components.js';
import { LOCALES, t } from '../i18n.js';
import { THEMES, fromBackup, toBackup } from '../model.js';
import { rerender } from '../router.js';
import { replaceData, resetAll, save, state } from '../store.js';
import { confirm, toast } from '../ui.js';
import { APP_VERSION, count, fmtRelative, h, icon, isIOS, isStandalone } from '../util.js';

const MAX_BACKUP_BYTES = 20 * 1024 * 1024;

const contents = (data) => ({ entries: count(data.logs.length, 'n.entries'), plans: count(data.routines.length, 'n.plans') });

export function settingsView() {
  const { settings } = state.data;

  const restyle = () => {
    save();
    applyAppearance();
    rerender();
  };

  const language = h('select', {
    class: 'field select',
    'aria-label': t('settings.language'),
    onchange: (event) => {
      settings.lang = event.target.value;
      restyle();
    },
  },
    h('option', { value: 'auto' }, t('settings.language.auto')),
    Object.entries(LOCALES).map(([code, entry]) => h('option', { value: code }, entry.strings['lang.name'])));
  language.value = settings.lang;

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
      title: t('settings.reset.title'),
      message: t('settings.reset.text', contents(state.data)),
      confirmLabel: t('settings.reset.confirm'),
      danger: true,
    });
    if (!ok) return;
    resetAll();
    toast(t('settings.reset.done'));
    rerender({ top: true });
  };

  const action = (iconName, label, onclick, danger = false) => h('button', { class: `row${danger ? ' danger' : ''}`, onclick },
    icon(iconName, 20), h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, label)));

  const node = h('div', { class: 'page' },
    pageHead(t('tab.settings')),

    sectionHead(t('settings.appearance')),
    h('div', { class: 'list' },
      h('label', { class: 'row' },
        h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, t('settings.language'))),
        language),
      h('div', { class: 'row' },
        h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, t('settings.theme'))),
        segmented({
          options: THEMES.map((theme) => ({ value: theme, label: t(`theme.${theme}`) })),
          value: settings.theme,
          label: t('settings.theme'),
          onChange: (value) => {
            settings.theme = value;
            restyle();
          },
        }))),

    sectionHead(t('settings.backup')),
    h('p', { class: 'hint' },
      t('settings.backup.hint', { when: settings.lastExport ? fmtRelative(settings.lastExport) : t('settings.never') })),
    h('div', { class: 'list' },
      action('download', t('settings.export'), exportBackup),
      action('upload', t('settings.import'), () => fileInput.click()),
      action('trash', t('settings.reset'), reset, true)),
    fileInput,

    isIOS() && !isStandalone() && [sectionHead(t('install.title')), h('p', { class: 'hint' }, t('install.text'))],

    h('p', { class: 'footnote' }, `Eisen ${APP_VERSION} · ${Object.values(contents(state.data)).join(' · ')}`));
  return { node, tab: 'settings' };
}

async function exportBackup() {
  const now = Date.now();
  const stamp = new Date(now - new Date(now).getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
  const name = `eisen-backup-${stamp}.json`;
  const file = new File([JSON.stringify(toBackup(state.data, now))], name, { type: 'application/json' });
  try {
    if (isIOS() && navigator.canShare?.({ files: [file] })) {
      // The share sheet offers "Save to Files", AirDrop and so on.
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
    if (error?.name !== 'AbortError') toast(t('settings.export.failed'), { kind: 'error' });
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
    if (file.size > MAX_BACKUP_BYTES) throw new RangeError('file too large');
    data = fromBackup(JSON.parse(await file.text()));
  } catch {
    toast(t('settings.import.invalid'), { kind: 'error' });
    return;
  }
  const ok = await confirm({
    title: t('settings.import.title'),
    message: t('settings.import.text', contents(data)),
    confirmLabel: t('settings.import.confirm'),
    danger: true,
  });
  if (!ok) return;
  // Language and theme belong to this device, not to the backup.
  data.settings.lang = state.data.settings.lang;
  data.settings.theme = state.data.settings.theme;
  if (replaceData(data)) toast(t('settings.import.done'));
  rerender({ top: true });
}
