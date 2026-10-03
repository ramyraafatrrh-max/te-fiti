// Sound effects generated with the Web Audio API (no audio files needed).
// Audio is unlocked on the first tap/click (required by mobile browsers).

let ctx = null;
let master = null;
let muted = false;

export function init() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume();
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 0.9;
  return muted;
}
export const isMuted = () => muted;

function tone(freq, start, dur, { type = "sine", gain = 0.18, glideTo = null, filter = null } = {}) {
  if (!ctx) return;
  const t0 = ctx.currentTime + start;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  let node = osc;
  if (filter) {
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = filter;
    osc.connect(f);
    node = f;
  }
  node.connect(g);
  g.connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

function noiseBurst(start, dur, gain = 0.25, cutoff = 400) {
  if (!ctx) return;
  const t0 = ctx.currentTime + start;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = cutoff;
  const g = ctx.createGain();
  g.gain.value = gain;
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t0);
}

export function click() {
  tone(660, 0, 0.08, { type: "triangle", gain: 0.08 });
}

export function correct() {
  // rising island chime
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
    tone(f, i * 0.09, 0.6, { type: "triangle", gain: 0.16 })
  );
  tone(1567.98, 0.36, 0.9, { type: "sine", gain: 0.07 });
}

export function wrong() {
  // lava rumble
  noiseBurst(0, 0.7, 0.45, 260);
  tone(110, 0, 0.6, { type: "sawtooth", gain: 0.18, glideTo: 55, filter: 500 });
}

export function victory() {
  // log-drum hits
  [0, 0.25, 0.5, 0.62, 0.75].forEach((t) => tone(90, t, 0.25, { type: "sine", gain: 0.35, glideTo: 60 }));
  // pentatonic run
  const run = [392, 440, 523.25, 587.33, 659.25, 783.99, 880, 1046.5];
  run.forEach((f, i) => tone(f, 0.9 + i * 0.1, 0.5, { type: "triangle", gain: 0.14 }));
  // warm final chord
  [523.25, 659.25, 783.99, 1046.5].forEach((f) => tone(f, 1.8, 2.6, { type: "sine", gain: 0.1 }));
  [261.63, 392].forEach((f) => tone(f, 1.8, 2.8, { type: "triangle", gain: 0.08 }));
}

export function ding() {
  tone(880, 0, 0.4, { type: "sine", gain: 0.15 });
  tone(1318.5, 0.12, 0.6, { type: "sine", gain: 0.12 });
}
