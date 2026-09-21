"use client";

import type { VoLine } from "@/data/vo";

/**
 * Announcer playback. Recorded file first (`/media/vo/<id>.mp3`), browser
 * speech as the stand-in. Only one line speaks at a time; a new cue cuts the
 * previous one off, which is what a host skipping ahead expects.
 */
let current: HTMLAudioElement | null = null;
let muted = false;
const missing = new Set<string>();

export function setVoMuted(m: boolean) {
  muted = m;
  if (m) stopVo();
}

export function stopVo() {
  current?.pause();
  current = null;
  try {
    speechSynthesis.cancel();
  } catch {}
}

function pickVoice() {
  const voices = speechSynthesis.getVoices().filter((v) => v.lang.startsWith("en"));
  const prefer = [/india/i, /ravi|prabhat|rishi/i, /david|daniel|george|guy|male/i];
  for (const re of prefer) {
    const v = voices.find((x) => re.test(x.name) || re.test(x.lang));
    if (v) return v;
  }
  return voices[0];
}

function speakFallback(text: string) {
  try {
    const u = new SpeechSynthesisUtterance(text);
    const v = pickVoice();
    if (v) u.voice = v;
    u.rate = 0.92;
    u.pitch = 0.7;
    speechSynthesis.speak(u);
  } catch {}
}

export function say(line: VoLine) {
  stopVo();
  if (muted) return;
  if (missing.has(line.id)) return speakFallback(line.text);
  const a = new Audio(`/media/vo/${line.id}.mp3`);
  current = a;
  const fallback = () => {
    if (current !== a) return; // already superseded by a newer cue
    missing.add(line.id);
    current = null;
    if (!muted) speakFallback(line.text);
  };
  a.addEventListener("error", fallback, { once: true });
  a.play().catch(fallback);
}
