'use client';
// Notification sounds, synthesised with the Web Audio API (no audio files to load).
// Browsers only allow sound after the user has interacted with the page, so the
// AudioContext is created/unlocked on the first click, tap or key press.

const KEY = 'nebeng_sound'; // '0' = muted
const LAST = 'nebeng_sound_last'; // de-duplicates the same notification across open tabs

let ctx = null;
const listeners = new Set();

export function soundEnabled() {
  try {
    return localStorage.getItem(KEY) !== '0';
  } catch {
    return true;
  }
}

export function setSoundEnabled(on) {
  try {
    localStorage.setItem(KEY, on ? '1' : '0');
  } catch {
    /* storage blocked */
  }
  listeners.forEach((fn) => fn(on));
  if (on) playSound('default', { force: true });
}

export function onSoundChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function audio() {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

if (typeof window !== 'undefined') {
  const unlock = () => {
    audio();
    ['pointerdown', 'keydown', 'touchstart'].forEach((e) => window.removeEventListener(e, unlock, true));
  };
  ['pointerdown', 'keydown', 'touchstart'].forEach((e) => window.addEventListener(e, unlock, true));
}

// Each pattern: [frequency Hz, start s, duration s, gain]
const PATTERNS = {
  // bright two-note chime: accepted, trip started, boarded…
  good: [
    [880, 0, 0.18, 0.22],
    [1318.5, 0.11, 0.32, 0.2],
  ],
  // soft single "pop": chat
  chat: [
    [1046.5, 0, 0.12, 0.2],
    [1568, 0.05, 0.14, 0.08],
  ],
  // neutral ding: new request, offer, new trip
  default: [
    [987.8, 0, 0.16, 0.2],
    [1318.5, 0.12, 0.26, 0.16],
    [1975.5, 0.12, 0.2, 0.04],
  ],
  // attention, slightly lower: counter offer, reminder, rating
  attention: [
    [659.3, 0, 0.16, 0.22],
    [880, 0.14, 0.16, 0.2],
    [659.3, 0.28, 0.26, 0.16],
  ],
  // falling tone: rejected, cancelled, report
  bad: [
    [740, 0, 0.18, 0.22],
    [523.3, 0.15, 0.34, 0.2],
  ],
};

const TONE_TO_PATTERN = { mint: 'good', red: 'bad', amber: 'attention', primary: 'default' };

export function patternFor(type, tone) {
  if (type === 'chat') return 'chat';
  return TONE_TO_PATTERN[tone] || 'default';
}

export function playSound(pattern = 'default', { force = false, dedupeKey } = {}) {
  if (!force && !soundEnabled()) return;
  if (dedupeKey) {
    try {
      const last = localStorage.getItem(LAST);
      if (last === dedupeKey) return;
      localStorage.setItem(LAST, dedupeKey);
    } catch {
      /* ignore */
    }
  }
  const ac = audio();
  if (!ac || ac.state !== 'running') return;
  const now = ac.currentTime + 0.01;
  const master = ac.createGain();
  master.gain.value = 0.9;
  master.connect(ac.destination);
  for (const [freq, start, dur, gain] of PATTERNS[pattern] || PATTERNS.default) {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const t0 = now + start;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }
}
