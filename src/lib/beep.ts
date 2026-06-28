let ctx: AudioContext | null = null;
function ac() {
  if (typeof window === "undefined") return null;
  if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  return ctx;
}
export function beep(kind: "ok" | "err" = "ok") {
  const a = ac();
  if (!a) return;
  const o = a.createOscillator();
  const g = a.createGain();
  o.connect(g); g.connect(a.destination);
  o.type = "sine";
  o.frequency.value = kind === "ok" ? 880 : 220;
  g.gain.setValueAtTime(0.001, a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.3, a.currentTime + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + 0.25);
  o.start();
  o.stop(a.currentTime + 0.26);
  if (kind === "ok") {
    const o2 = a.createOscillator(); const g2 = a.createGain();
    o2.connect(g2); g2.connect(a.destination);
    o2.type = "sine"; o2.frequency.value = 1320;
    g2.gain.setValueAtTime(0.001, a.currentTime + 0.13);
    g2.gain.exponentialRampToValueAtTime(0.25, a.currentTime + 0.14);
    g2.gain.exponentialRampToValueAtTime(0.001, a.currentTime + 0.38);
    o2.start(a.currentTime + 0.13); o2.stop(a.currentTime + 0.4);
  }
}
