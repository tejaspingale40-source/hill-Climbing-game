// Tiny WebAudio sfx + looping background music (no audio files needed)
let ctx, master, timer, step = 0, muted = false;
const scale = [0, 2, 4, 7, 9, 12, 9, 7, 4, 2];
function tone(f, d, type = 'square', v = 0.12, slide = 0, delay = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + delay, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + d);
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
  o.connect(g).connect(master); o.start(t); o.stop(t + d);
}
export const sfx = {
  init() {
    if (ctx) { ctx.resume(); return; }
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.6; master.connect(ctx.destination);
  },
  jump: () => tone(300, 0.18, 'square', 0.1, 400),
  coin: () => { tone(988, 0.08, 'square', 0.1); tone(1319, 0.2, 'square', 0.1, 0, 0.07); },
  hurt: () => tone(220, 0.4, 'sawtooth', 0.16, -170),
  thud: () => tone(90, 0.2, 'sine', 0.2, -50),
  check: () => [523, 659, 784].forEach((f, i) => tone(f, 0.18, 'triangle', 0.14, 0, i * 0.09)),
  win: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.3, 'triangle', 0.15, 0, i * 0.12)),
  lose: () => [392, 330, 262, 196].forEach((f, i) => tone(f, 0.3, 'sawtooth', 0.12, 0, i * 0.18)),
  startMusic() {
    if (!ctx || timer) return;
    timer = setInterval(() => {
      const n = scale[step % scale.length], base = 220 * Math.pow(2, n / 12);
      tone(base, 0.35, 'triangle', 0.05);
      if (step % 4 === 0) tone(base / 2, 0.8, 'sine', 0.06);
      step++;
    }, 280);
  },
  stopMusic() { clearInterval(timer); timer = null; },
  toggleMute() { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.6; return muted; },
};
