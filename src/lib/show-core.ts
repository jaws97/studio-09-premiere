/** Show state shared by server and client. No secrets in here: it is served publicly. */

/**
 * Run of show. The opening plays as one piece: the curtain parts on a dark
 * screen, then leader → ident → title card run on from each other, and the
 * title card waits for the host.
 */
export const PHASES = [
  "doors",
  "curtain",
  "leader",
  "ident",
  "title",
  "trailer",
  "premieres",
  "curtaincall",
  "credits",
] as const;
export type Phase = (typeof PHASES)[number];

export const PHASE_LABEL: Record<Phase, string> = {
  doors: "Doors open",
  curtain: "Curtain up",
  leader: "Film leader 5-4-3-2-1",
  ident: "Party People ident",
  title: "Season title card",
  trailer: "Season trailer",
  premieres: "The premieres",
  curtaincall: "Curtain call",
  credits: "End credits",
};

export const SEATS = 120;
export const PER_ROW = 12;
export const rowOf = (seat: number) => String.fromCharCode(64 + Math.ceil(seat / PER_ROW));
export const numOf = (seat: number) => ((seat - 1) % PER_ROW) + 1;

export type Seated = { seat: number; name: string; star: boolean; at: number };
/** a guest message; `at` lets the screen show only the ones that just arrived */
export type Wish = { id: string; name: string; text: string; at: number };

export type ShowState = {
  phase: Phase;
  /** index into films while phase === "premieres" */
  premiere: number;
  seated: Seated[];
  /** running total of bravos; the screen derives the needle from its rate of change */
  applause: number;
  muted: boolean;
  /** guest messages: shown live as they arrive, then rolled in the end credits */
  wishes: Wish[];
  /** paparazzi photo ids, newest last */
  photos: string[];
  /** last announcer cue the host fired; `n` changes every time so repeats still play */
  cue: { id: AnnounceCue; n: number } | null;
  rev: number;
};

export const ANNOUNCE_CUES = ["doors", "seats", "premieres"] as const;
export type AnnounceCue = (typeof ANNOUNCE_CUES)[number];

export const initialShow: ShowState = {
  phase: "doors",
  premiere: 0,
  seated: [],
  applause: 0,
  muted: false,
  wishes: [],
  photos: [],
  cue: null,
  rev: 0,
};

/** Actions only the host (PIN) may send. */
export type HostAction =
  | { type: "next"; ifPhase?: Phase }
  | { type: "prev" }
  | { type: "goto"; phase: Phase }
  | { type: "premiere"; index: number }
  | { type: "mute"; muted: boolean }
  | { type: "announce"; cue: AnnounceCue }
  | { type: "simulate" }
  | { type: "clap"; n: number }
  | { type: "reset" };

export function stepShow(s: ShowState, a: HostAction, films: number): ShowState {
  const i = PHASES.indexOf(s.phase);
  switch (a.type) {
    case "next":
      if (a.ifPhase && a.ifPhase !== s.phase) return s;
      if (s.phase === "premieres" && s.premiere < films - 1) return { ...s, premiere: s.premiere + 1 };
      return i < PHASES.length - 1 ? { ...s, phase: PHASES[i + 1] } : s;
    case "prev":
      if (s.phase === "premieres" && s.premiere > 0) return { ...s, premiere: s.premiere - 1 };
      return i > 0 ? { ...s, phase: PHASES[i - 1] } : s;
    case "goto":
      return PHASES.includes(a.phase) ? { ...s, phase: a.phase } : s;
    case "premiere":
      return a.index >= 0 && a.index < films ? { ...s, phase: "premieres", premiere: a.index } : s;
    case "announce":
      return ANNOUNCE_CUES.includes(a.cue) ? { ...s, cue: { id: a.cue, n: (s.cue?.n ?? 0) + 1 } } : s;
    case "mute":
      return { ...s, muted: !!a.muted };
    case "clap":
      return { ...s, applause: s.applause + Math.max(0, Math.min(50, a.n | 0)) };
    default:
      return s;
  }
}
