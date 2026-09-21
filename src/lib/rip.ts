"use client";

/**
 * Paper-rip sound synthesised from filtered noise, so the tear works before
 * any audio assets exist.
 *
 * Phones only let a page start audio after a COMPLETED gesture (tap / touchend),
 * and the audio hardware then takes a few hundred ms to wake. Unlocking at the
 * start of the swipe is too late: the first half of the tear would be silent.
 * So we unlock on the earliest tap we can get (`armRipOnFirstTouch`, and the
 * "Print my ticket" tap) and play a silent sample to warm the output up.
 */
let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;

export function unlockRip() {
  try {
    if (!ctx) {
      ctx = new AudioContext();
      noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state !== "running") void ctx.resume();
    // one silent sample: wakes the audio hardware now instead of on the first perforation
    const warm = ctx.createBufferSource();
    warm.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
    warm.connect(ctx.destination);
    warm.start();
  } catch {
    ctx = null;
  }
}

/** Unlock on the first completed touch anywhere on the page, then stop listening. */
export function armRipOnFirstTouch() {
  const events = ["pointerup", "touchend", "click", "keydown"] as const;
  const once = () => {
    unlockRip();
    events.forEach((e) => document.removeEventListener(e, once));
  };
  events.forEach((e) => document.addEventListener(e, once, { passive: true }));
  return () => events.forEach((e) => document.removeEventListener(e, once));
}

function burst(duration: number, gain: number, freq: number) {
  if (!ctx || !noise) return;
  // while suspended the clock is frozen: anything scheduled now would pile up and fire at once later
  if (ctx.state !== "running") return void ctx.resume();
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
