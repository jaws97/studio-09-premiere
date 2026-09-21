import { films, type Film } from "./season";

/**
 * The announcer's script. Each line has an id; if `public/media/vo/<id>.mp3`
 * exists it is played, otherwise the browser's speech voice reads the text so
 * rehearsals have an emcee before the real voice is generated.
 * `scripts/vo-script.mjs` prints this as a sheet for the TTS session.
 */
export type VoLine = { id: string; text: string };

export const showCues = {
  doors: {
    id: "cue-doors",
    text: "Ladies and gentlemen, welcome to Studio Oh Nine. Please have your tickets ready for the usher.",
  },
  seats: {
    id: "cue-seats",
    text: "Ladies and gentlemen, please take your seats. Tonight's programme is about to begin.",
  },
  curtain: {
    id: "cue-curtain",
    text: "Studio Oh Nine proudly presents, the September season. Twenty-seven features. Every one, a leading role.",
  },
  trailer: { id: "cue-trailer", text: "And now, a preview of this season's attractions." },
  premieres: { id: "cue-premieres", text: "Tonight's premieres. Hold your applause. Actually, don't." },
  curtaincall: {
    id: "cue-curtaincall",
    text: "Phones out, everyone. Find the bravo button, and let the cast hear it. Make that needle move!",
  },
  ovation: { id: "cue-ovation", text: "A standing ovation! The house has spoken." },
  credits: { id: "cue-credits", text: "Thank you for coming. House lights up after the credits. Cake is in the lobby." },
} satisfies Record<string, VoLine>;

export const premiereLine = (f: Film): VoLine => ({
  id: `film-${String(f.no).padStart(2, "0")}-${f.slug}`,
  text: `Feature number ${f.no}. ${f.title}. Starring ${f.star}. ${f.tagline}`,
});

export const allLines = (): VoLine[] => [...Object.values(showCues), ...films.map(premiereLine)];
