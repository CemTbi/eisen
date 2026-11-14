// Rest timer between sets. The end time is stored with the workout in
// progress, so the countdown survives the app being suspended or reloaded.

import { saveActive, state } from './store.js';
import { fmtClock, h } from './util.js';

let bar = null;
let label = null;
let time = null;
let fill = null;
let audio = null;
let overUntil = 0;

export function restBar() {
  label = h('span', { class: 'restbar-label' }, 'Pause');
  time = h('strong', { class: 'restbar-time' }, '0:00');
  fill = h('i');
  bar = h('div', { class: 'restbar', hidden: true },
    h('div', { class: 'restbar-inner' },
      h('div', { class: 'restbar-progress', 'aria-hidden': 'true' }, fill),
      label,
      time,
      h('div', { class: 'restbar-actions' },
        h('button', { class: 'restbar-btn', 'aria-label': '15 Sekunden weniger', onclick: () => adjust(-15) }, '−15'),
        h('button', { class: 'restbar-btn', 'aria-label': '15 Sekunden mehr', onclick: () => adjust(15) }, '+15'),
        h('button', { class: 'restbar-btn strong', onclick: stopRest }, 'Weiter'))));
  return bar;
}

/** Browsers only allow sound after a tap, so this is called from tap handlers. */
export function primeAudio() {
  if (!state.data.settings.sound) return;
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
  } catch {
    audio = null;
  }
}

function beep() {
  if (!audio || !state.data.settings.sound) return;
  try {
    const now = audio.currentTime;
    for (const [offset, frequency] of [[0, 880], [0.2, 1175]]) {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.3, now + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.18);
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start(now + offset);
      oscillator.stop(now + offset + 0.2);
    }
  } catch {
    // Sound is a nicety; the bar already shows that the rest is over.
  }
}

export function startRest() {
  const seconds = state.data.settings.restSeconds;
  if (!state.active || !seconds) return;
  state.active.rest = { end: Date.now() + seconds * 1000, total: seconds };
  overUntil = 0;
  saveActive();
  tickRest();
}

export function stopRest() {
  overUntil = 0;
  if (state.active?.rest) {
    state.active.rest = null;
    saveActive();
  }
  tickRest();
}

function adjust(seconds) {
  const rest = state.active?.rest;
  if (!rest) return;
  rest.end += seconds * 1000;
  rest.total = Math.max(rest.total + seconds, 1);
  if (rest.end <= Date.now()) {
    stopRest();
    return;
  }
  saveActive();
  tickRest();
}

/** Called a few times per second by the app. */
export function tickRest() {
  if (!bar) return;
  const now = Date.now();
  if (state.active?.rest && state.active.rest.end <= now) {
    // Only announce the end if it just happened, not when reopening the app later.
    if (now - state.active.rest.end < 3000) {
      beep();
      overUntil = now + 2500;
    }
    state.active.rest = null;
    saveActive();
  }
  const rest = state.active?.rest;
  const over = !rest && now < overUntil && !!state.active;
  bar.hidden = !rest && !over;
  bar.classList.toggle('is-over', over);
  document.body.classList.toggle('has-rest', !bar.hidden);
  if (rest) {
    const left = rest.end - now;
    label.textContent = 'Pause';
    time.textContent = fmtClock(left + 999);
    fill.style.transform = `scaleX(${Math.min(1, Math.max(0, left / (rest.total * 1000)))})`;
  } else if (over) {
    label.textContent = 'Pause vorbei';
    time.textContent = 'Weiter geht’s';
  }
}
