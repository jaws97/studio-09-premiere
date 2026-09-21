export const event = {
  studio: "Studio 09",
  tagline: "Twenty-seven features. One season. The whole cast gets top billing.",
  /** Opening night, local time (IST) */
  startsAt: "2026-10-07T18:30:00+05:30",
  venue: "[venue]",
  /**
   * Titles and posters are the surprise. Before this moment the public pages
   * show sealed "coming soon" posters only. Set NEXT_PUBLIC_REVEAL=1 to
   * preview the revealed state in development.
   */
  revealAt: "2026-10-07T18:30:00+05:30",
} as const;

export function isRevealed(now: Date = new Date()) {
  if (process.env.NEXT_PUBLIC_REVEAL === "1") return true;
  return now >= new Date(event.revealAt);
}

export const tickerExtras = [
  "House lights dim ten minutes before",
  "Front row reserved for the cast",
  "Credits run short, cake runs long",
  "Encore already requested",
];
