"use client";

import { createStore } from "./store";

export const PHASES = [
  "doors",
  "leader",
  "ident",
  "curtain",
  "trailer",
  "premieres",
  "curtaincall",
  "credits",
] as const;
export type Phase = (typeof PHASES)[number];

export const PHASE_LABEL: Record<Phase, string> = {
  doors: "Doors open",
  leader: "Film leader 5-4-3-2-1",
  ident: "Studio 09 ident",
  curtain: "Curtain up",
  trailer: "Season trailer",
  premieres: "The premieres",
  curtaincall: "Curtain call",
  credits: "End credits",
};

export type Seated = { seat: number; name: string; star: boolean; at: number };

export type ShowState = {
  phase: Phase;
  /** index into films while phase === "premieres" */
  premiere: number;
  seated: Seated[];
  /** running total of bravos; the screen derives the needle from its rate of change */
  applause: number;
  muted: boolean;
  rev: number;
};

export const initialShow: ShowState = {
  phase: "doors",
  premiere: 0,
  seated: [],
  applause: 0,
  muted: false,
  rev: 0,
};

export type ShowAction =
  | { type: "next"; films: number }
  | { type: "prev"; films: number }
  | { type: "goto"; phase: Phase }
  | { type: "premiere"; index: number }
  | { type: "seat"; guest: Omit<Seated, "at"> }
  | { type: "clap"; n: number }
  | { type: "mute"; muted: boolean }
  | { type: "reset" };

export function reduceShow(s: ShowState, a: ShowAction): ShowState {
  const rev = s.rev + 1;
  const i = PHASES.indexOf(s.phase);
  switch (a.type) {
    case "next":
      if (s.phase === "premieres" && s.premiere < a.films - 1) return { ...s, premiere: s.premiere + 1, rev };
      return i < PHASES.length - 1 ? { ...s, phase: PHASES[i + 1], rev } : s;
    case "prev":
      if (s.phase === "premieres" && s.premiere > 0) return { ...s, premiere: s.premiere - 1, rev };
      return i > 0 ? { ...s, phase: PHASES[i - 1], rev } : s;
    case "goto":
      return { ...s, phase: a.phase, rev };
    case "premiere":
      return { ...s, phase: "premieres", premiere: a.index, rev };
    case "seat":
      if (s.seated.some((g) => g.seat === a.guest.seat)) return s;
      return { ...s, seated: [...s.seated, { ...a.guest, at: Date.now() }], rev };
    case "clap":
      return { ...s, applause: s.applause + a.n, rev };
    case "mute":
      return { ...s, muted: a.muted, rev };
    case "reset":
      return { ...initialShow, rev };
  }
}

/**
 * Transport seam. Today: BroadcastChannel + localStorage, which syncs /screen
 * and /host across tabs of one browser — enough to build and rehearse the
 * show. Event night: swap for Supabase (show row + Realtime) behind the same
 * publish/subscribe shape; nothing above this file should need to change.
 */
const CHANNEL = "studio09-show";
const STORE_KEY = "studio09-show-state";

function load(): ShowState {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return { ...initialShow, ...(JSON.parse(raw) as ShowState) };
  } catch {}
  return initialShow;
}

let chan: BroadcastChannel | null = null;

const store = createStore<{ state: ShowState; ready: boolean }>({ state: initialShow, ready: false }, (set) => {
  set({ state: load(), ready: true });
  chan = new BroadcastChannel(CHANNEL);
  chan.onmessage = (e: MessageEvent<ShowState>) => set({ state: e.data, ready: true });
  return () => {
    chan?.close();
    chan = null;
  };
});

function dispatch(a: ShowAction) {
  const prev = store.get().state;
  const next = reduceShow(prev, a);
  if (next === prev) return;
  store.set({ state: next, ready: true });
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(next));
  } catch {}
  chan?.postMessage(next);
}

export function useShow() {
  const { state, ready } = store.use();
  return { state, dispatch, ready };
}
