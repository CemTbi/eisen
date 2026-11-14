// DOM helper, icons and formatting. No app state in here.

export const APP_VERSION = '1.0.0';
export const DAY = 86_400_000;

/**
 * Tiny hyperscript helper. Text children become text nodes, so user-entered
 * strings can never be parsed as markup.
 */
export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value == null || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (key.startsWith('on')) el.addEventListener(key.slice(2), value);
    else if (key in el) el[key] = value;
    else el.setAttribute(key, value === true ? '' : value);
  }
  append(el, children);
  return el;
}

/** Replaces an element's children; like h(), it skips null and false. */
export function setChildren(el, ...children) {
  el.replaceChildren();
  append(el, children);
}

function append(el, child) {
  if (child == null || child === false || child === true) return;
  if (Array.isArray(child)) {
    for (const c of child) append(el, c);
    return;
  }
  el.append(child instanceof Node ? child : String(child));
}

const dot = (cx) => `<circle cx="${cx}" cy="12" r="1.7" fill="currentColor" stroke="none"/>`;

const ICONS = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  chevron: '<path d="M9 5l7 7-7 7"/>',
  up: '<path d="M6 14l6-6 6 6"/>',
  down: '<path d="M6 10l6 6 6-6"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  more: dot(5) + dot(12) + dot(19),
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  trash: '<path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 12.5h9l1-12.5M10 11v5M14 11v5"/>',
  dumbbell: '<path d="M3 9.5v5M6.5 6.5v11M17.5 6.5v11M21 9.5v5M6.5 12h11"/>',
  history: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  chart: '<path d="M4 19.5h16M5 15l4.5-5 3.5 3L19 6.5M14.5 6.5H19V11"/>',
  settings: '<path d="M4 7h7M17 7h3M4 17h3M13 17h7"/><circle cx="14" cy="7" r="2.5"/><circle cx="10" cy="17" r="2.5"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z" fill="currentColor" stroke="none"/>',
  timer: '<circle cx="12" cy="13.5" r="7"/><path d="M12 10v3.5l2 1.5M9.5 3h5"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7"/>',
  edit: '<path d="M4 20l1-4L16.5 4.5l3 3L8 19zM14.5 6.5l3 3"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  download: '<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 20h14"/>',
  upload: '<path d="M12 15V4M7.5 8.5L12 4l4.5 4.5M5 20h14"/>',
  swap: '<path d="M4 8h14l-3-3M20 16H6l3 3"/>',
};

export function icon(name, size = 22) {
  const template = document.createElement('template');
  template.innerHTML = `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" `
    + 'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" '
    + `aria-hidden="true">${ICONS[name]}</svg>`;
  return template.content.firstChild;
}

// ---- numbers -------------------------------------------------------------

const numberFormat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 });
const numberFormat1 = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 });

export const fmtNum = (n) => numberFormat.format(n);
export const fmtNum1 = (n) => numberFormat1.format(n);
export const fmtKg = (n) => `${fmtNum(n)} kg`;

/** A logged set as text: "80 kg × 8", or "12 Wdh." for bodyweight sets. */
export function fmtSet(set) {
  return set.weight > 0 ? `${fmtNum(set.weight)} kg × ${set.reps}` : `${set.reps} Wdh.`;
}

/** Number as it appears in an input field: German decimal comma, no grouping. */
export const fmtInput = (n) => (n == null ? '' : String(n).replace('.', ','));

/** Parses "62,5" or "62.5". Returns null for empty, negative or malformed input. */
export function parseNum(str) {
  if (typeof str !== 'string') return null;
  const s = str.trim().replace(',', '.');
  if (!/^\d*\.?\d*$/.test(s) || s === '' || s === '.') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export const MAX_WEIGHT = 2000;
export const MAX_REPS = 1000;

export function parseWeight(str) {
  const n = parseNum(str);
  return n == null ? null : Math.min(Math.round(n * 100) / 100, MAX_WEIGHT);
}

export function parseReps(str) {
  const n = parseNum(str);
  if (n == null) return null;
  const reps = Math.min(Math.floor(n), MAX_REPS);
  return reps > 0 ? reps : null;
}

// ---- time ----------------------------------------------------------------

const pad = (n) => String(n).padStart(2, '0');
const dayFormat = new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: 'numeric', month: 'short' });
const dayYearFormat = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'short', year: 'numeric' });
const longFormat = new Intl.DateTimeFormat('de-DE', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
});
const monthFormat = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' });

export function fmtDay(ts, now = Date.now()) {
  const date = new Date(ts);
  return date.getFullYear() === new Date(now).getFullYear() ? dayFormat.format(date) : dayYearFormat.format(date);
}

export const fmtDateLong = (ts) => longFormat.format(new Date(ts));
export const fmtMonth = (ts) => monthFormat.format(new Date(ts));

const startOfDay = (ts) => new Date(ts).setHours(0, 0, 0, 0);

export function fmtRelative(ts, now = Date.now()) {
  const days = Math.round((startOfDay(now) - startOfDay(ts)) / DAY);
  if (days <= 0) return 'heute';
  if (days === 1) return 'gestern';
  if (days < 14) return `vor ${days} Tagen`;
  return fmtDay(ts, now);
}

/** "45 min" or "1 h 5 min". */
export function fmtDuration(ms) {
  const minutes = Math.max(1, Math.round(ms / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const rest = minutes % 60;
  return rest ? `${Math.floor(minutes / 60)} h ${rest} min` : `${minutes / 60} h`;
}

/** Running clock: "4:07" or "1:04:07". */
export function fmtClock(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  return hours ? `${hours}:${pad(minutes)}:${pad(s % 60)}` : `${minutes}:${pad(s % 60)}`;
}

/** Timestamp to the value of an <input type="datetime-local">, and back. */
export function toLocalInput(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInput(value) {
  const ts = new Date(value).getTime();
  return Number.isFinite(ts) ? ts : null;
}

// ---- text ----------------------------------------------------------------

/** Case- and accent-insensitive form for searching and duplicate checks. */
export const fold = (s) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();

export const plural = (n, one, many) => `${fmtNum(n)} ${n === 1 ? one : many}`;

// ---- platform --------------------------------------------------------------

export const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

export const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent)
  || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
