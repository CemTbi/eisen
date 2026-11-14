// Applies the language and theme chosen in the settings to the document.

import { setLang } from './i18n.js';
import { state } from './store.js';

// Page background per theme; the browser paints the status bar area with it.
const BACKGROUND = { midnight: '#0a0f1e', black: '#000000' };

export function applyAppearance() {
  const { lang, theme } = state.data.settings;
  setLang(lang);
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BACKGROUND[theme]);
}
