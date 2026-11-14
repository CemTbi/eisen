// Translations. Every visible string goes through t(). A new language is one
// file in js/locales/ plus one line in LOCALES below.

import de from './locales/de.js';
import en from './locales/en.js';

export const LOCALES = {
  de: { strings: de, locale: 'de-DE' },
  en: { strings: en, locale: 'en-GB' },
};

const FALLBACK = 'en';
let current = 'de';

/** pref is a language code or 'auto' (follow the device). */
export function setLang(pref) {
  let lang = pref;
  if (!LOCALES[lang]) {
    const wanted = (globalThis.navigator?.languages ?? [globalThis.navigator?.language ?? '']).map((l) => l.slice(0, 2).toLowerCase());
    lang = wanted.find((l) => LOCALES[l]) ?? FALLBACK;
  }
  current = lang;
  if (globalThis.document) document.documentElement.lang = lang;
  return lang;
}

export const getLang = () => current;
export const locale = () => LOCALES[current].locale;

/** Translated string with {placeholders} filled in. Plural entries come back as [one, many]. */
export function t(key, vars) {
  const value = LOCALES[current].strings[key] ?? LOCALES[FALLBACK].strings[key] ?? key;
  if (!vars || typeof value !== 'string') return value;
  return value.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? vars[name] : match));
}

/** All translations of one key, e.g. to recognise a built-in exercise name in any language. */
export const translations = (key) => Object.values(LOCALES).map((l) => l.strings[key]).filter(Boolean);
