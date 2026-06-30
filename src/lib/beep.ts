// Audio feedback for QR attendance scanner.
// Uses preloaded HTML5 Audio for instant playback on Android, with a
// WebAudio oscillator fallback when an asset fails to load.

export type BeepKind = "ok" | "err" | "duplicate" | "warning";

const FILES: Record<BeepKind, string> = {
  ok: "/sounds/success.mp3",
  err: "/sounds/error.mp3",
  duplicate: "/sounds/duplicate.mp3",
  warning: "/sounds/warning.mp3",
};

const cache: Partial<Record<BeepKind, HTMLAudioElement>> = {};
let primed = false;

function load(kind: BeepKind) {
  if (typeof window === "undefined") return null;
  if (!cache[kind]) {
    const a = new Audio(FILES[kind]);
    a.preload = "auto";
    a.volume = 0.9;
    cache[kind] = a;
  }
  return cache[kind]!;
}

// Preload all sound files. Call once at app/page mount.
export function preloadBeeps() {
  if (typeof window === "undefined") return;
  (Object.keys(FILES) as BeepKind[]).forEach((k) => {
    const a = load(k);
    try { a?.load(); } catch { /* ignore */ }
  });
}

// Mobile browsers require a user gesture before audio playback.
// Call from a tap/click handler to unlock playback.
export function primeAudio() {
  if (primed) return;
  primed = true;
  (Object.keys(FILES) as BeepKind[]).forEach((k) => {
    const a = load(k);
    if (!a) return;
    const v = a.volume;
    a.volume = 0;
    a.play().then(() => { a.pause(); a.currentTime = 0; a.volume = v; }).catch(() => { a.volume = v; });
  });
}

let ctx: AudioContext | null = null;
function fallbackTone(kind: BeepKind) {
  if (typeof window === "undefined") return;
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const freq = kind === "ok" ? 880 : kind === "duplicate" ? 600 : kind === "warning" ? 500 : 220;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = "sine"; o.frequency.value = freq;
    g.gain.setValueAtTime(0.001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    o.start(); o.stop(ctx.currentTime + 0.32);
  } catch { /* ignore */ }
}

export function beep(kind: BeepKind = "ok") {
  const a = load(kind);
  if (!a) { fallbackTone(kind); return; }
  try {
    a.currentTime = 0;
    const p = a.play();
    if (p && typeof p.catch === "function") p.catch(() => fallbackTone(kind));
  } catch {
    fallbackTone(kind);
  }
}

export function vibrate(pattern: number | number[]) {
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    try { navigator.vibrate(pattern); } catch { /* ignore */ }
  }
}
