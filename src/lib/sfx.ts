"use client";

/**
 * Show sound for /screen, synthesised with WebAudio so the whole run of show
 * has audio before a single asset exists. Each cue is a function; swapping one
 * for a recorded file later (announcer VO, ident sting) doesn't touch callers.
 * Browsers only allow audio after a user gesture: call `arm()` from a click.
 */
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;

export const isArmed = () => !!ctx && ctx.state === "running";

export async function arm() {
  try {
    if (!ctx) {
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = 0.9;
      const comp = ctx.createDynamicsCompressor();
      master.connect(comp).connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state !== "running") await ctx.resume();
  } catch {}
  return isArmed();
}

export function setMuted(muted: boolean) {
  if (ctx && master) master.gain.setTargetAtTime(muted ? 0 : 0.9, ctx.currentTime, 0.05);
}

/* ------------------------------------------------------------ primitives */

type Env = { a?: number; d: number; peak: number; at?: number };

function envGain({ a = 0.01, d, peak, at = 0 }: Env) {
  const g = ctx!.createGain();
  const t = ctx!.currentTime + at;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  g.connect(master!);
  return g;
}

function tone(freq: number, type: OscillatorType, env: Env, glideTo?: number) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const t = ctx.currentTime + (env.at ?? 0);
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + (env.a ?? 0.01) + env.d);
  o.connect(envGain(env));
  o.start(t);
  o.stop(t + (env.a ?? 0.01) + env.d + 0.05);
}

function noise(filter: BiquadFilterType, freq: number, q: number, env: Env, sweepTo?: number) {
  if (!ctx || !noiseBuf) return;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const f = ctx.createBiquadFilter();
  const t = ctx.currentTime + (env.at ?? 0);
  f.type = filter;
  f.Q.value = q;
  f.frequency.setValueAtTime(freq, t);
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + (env.a ?? 0.01) + env.d);
  src.connect(f).connect(envGain(env));
  src.start(t, Math.random());
  src.stop(t + (env.a ?? 0.01) + env.d + 0.05);
}

/* ------------------------------------------------------------------ cues */

/** film-leader beep, one per number */
export const beep = (last = false) => tone(1000, "sine", { d: last ? 0.5 : 0.16, peak: 0.35 });

/** guest seated on the doors screen */
export function chime(star: boolean) {
  const notes = star ? [1318.5, 1760, 2637] : [1318.5, 1760];
  notes.forEach((f, i) => tone(f, "sine", { at: i * 0.09, d: 0.7, peak: 0.16 }));
}

/** velvet curtain drawing open */
export function swoosh() {
  noise("bandpass", 260, 0.8, { a: 0.5, d: 1.4, peak: 0.5 }, 1800);
  noise("lowpass", 180, 0.5, { a: 0.3, d: 1.6, peak: 0.35 });
}

/** clapperboard */
export function snap() {
  noise("highpass", 1800, 0.7, { a: 0.002, d: 0.09, peak: 0.9 });
  tone(140, "sine", { a: 0.002, d: 0.16, peak: 0.7 }, 60);
}

/** poster reveal: a quick rising sparkle over a soft boom */
export function reveal() {
  tone(70, "sine", { a: 0.01, d: 1.4, peak: 0.6 }, 38);
  [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568].forEach((f, i) =>
    tone(f, "triangle", { at: 0.25 + i * 0.07, d: 0.9, peak: 0.11 }),
  );
  noise("highpass", 5000, 0.5, { at: 0.2, a: 0.4, d: 1.2, peak: 0.08 });
}

/** studio ident: a brass-ish swell landing on a major chord, until the real sting is generated */
export function fanfare() {
  const chord = [130.81, 196, 261.63, 329.63, 392, 523.25];
  chord.forEach((f, i) => {
    tone(f, "sawtooth", { at: i * 0.12, a: 1.2, d: 3.2, peak: 0.07 });
    tone(f * 1.003, "sawtooth", { at: i * 0.12, a: 1.2, d: 3.2, peak: 0.05 });
  });
  tone(65.41, "sine", { a: 0.8, d: 3.8, peak: 0.5 });
  noise("highpass", 6000, 0.5, { at: 0.9, a: 0.6, d: 2.4, peak: 0.05 });
}

/* ---------------------------------------------------------------- loops */

type Loop = { stop: () => void; level?: (v: number) => void };

/** projector running: motor hum, shutter flutter, the odd sprocket tick */
export function projector(): Loop {
  if (!ctx || !noiseBuf || !master) return { stop() {} };
  const out = ctx.createGain();
  out.gain.value = 0;
  out.gain.setTargetAtTime(0.22, ctx.currentTime, 0.4);
  out.connect(master);

  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const band = ctx.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = 900;
  band.Q.value = 0.6;
  // 24 frames a second
  const flutter = ctx.createGain();
  flutter.gain.value = 0.55;
  const lfo = ctx.createOscillator();
  lfo.type = "square";
  lfo.frequency.value = 24;
  const lfoDepth = ctx.createGain();
  lfoDepth.gain.value = 0.45;
  lfo.connect(lfoDepth).connect(flutter.gain);
  src.connect(band).connect(flutter).connect(out);

  const hum = ctx.createOscillator();
  hum.type = "sawtooth";
  hum.frequency.value = 96;
  const humGain = ctx.createGain();
  humGain.gain.value = 0.05;
  hum.connect(humGain).connect(out);

  src.start();
  lfo.start();
  hum.start();
  return {
    stop() {
      if (!ctx) return;
      out.gain.setTargetAtTime(0, ctx.currentTime, 0.25);
      setTimeout(() => [src, lfo, hum].forEach((n) => n.stop()), 1200);
    },
  };
}

/** applause bed whose size follows the meter (0..1) */
export function applause(): Loop {
  if (!ctx || !noiseBuf || !master) return { stop() {}, level() {} };
  const out = ctx.createGain();
  out.gain.value = 0;
  out.connect(master);
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const band = ctx.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = 2200;
  band.Q.value = 0.4;
  src.connect(band).connect(out);
  src.start();

  let lvl = 0;
  // individual claps on top of the wash, denser as the room gets louder
  const timer = setInterval(() => {
    const hits = Math.round(lvl * 6 + Math.random() * lvl * 4);
    for (let i = 0; i < hits; i++)
      noise("bandpass", 1500 + Math.random() * 1800, 1.2, { at: Math.random() * 0.1, a: 0.002, d: 0.05, peak: 0.12 * lvl + 0.03 });
  }, 100);

  return {
    level(v) {
      lvl = Math.max(0, Math.min(1, v));
      if (ctx) out.gain.setTargetAtTime(lvl * 0.5, ctx.currentTime, 0.15);
    },
    stop() {
      clearInterval(timer);
      if (!ctx) return;
      out.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
      setTimeout(() => src.stop(), 1500);
    },
  };
}
