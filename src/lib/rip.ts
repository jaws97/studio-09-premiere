"use client";

/**
 * Paper-rip sound synthesised from filtered noise, so the tear works before
 * any audio assets exist. Must be unlocked from a user gesture (pointerdown).
 */
let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;

export function unlockRip() {
  if (ctx) {
    if (ctx.state === "suspended") void ctx.resume();
    return;
  }
  try {
    ctx = new AudioContext();
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch {
    ctx = null;
  }
}

function burst(duration: number, gain: number, freq: number) {
  if (!ctx || !noise) return;
  const src = ctx.createBufferSource();
  src.buffer = noise;
  src.loopStart = Math.random() * 0.5;
  src.playbackRate.value = 0.8 + Math.random() * 0.6;
  const band = ctx.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = freq;
  band.Q.value = 0.7;
  const g = ctx.createGain();
  const t = ctx.currentTime;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  src.connect(band).connect(g).connect(ctx.destination);
  src.start(t, Math.random() * 0.5);
  src.stop(t + duration + 0.02);
}

/** one perforation giving way */
export const ripTick = () => burst(0.07, 0.5, 2600 + Math.random() * 1800);
/** the stub coming free */
export const ripFinish = () => {
  burst(0.32, 0.8, 1800);
  burst(0.18, 0.5, 4200);
};

export function buzz(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {}
}
