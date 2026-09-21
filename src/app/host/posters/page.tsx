import type { Metadata } from "next";
import { PinGate } from "@/components/PinGate";
import { films, pad2, posterThumb } from "@/data/season";
import { isHost } from "@/server/auth";
import "../host.css";

export const metadata: Metadata = { title: "Studio 09 · Poster review" };

/** Every poster with its number, title and tagline, for collecting feedback. PIN-gated: it shows the surprise. */
export default async function PostersPage() {
  if (!(await isHost())) return <PinGate title="Poster review" />;
  const missing = films.filter((f) => !f.poster);
  return (
    <main className="host review">
      <header>
        <span>Studio 09 · poster review</span>
        <b>
          {films.length - missing.length} of {films.length} posters
        </b>
        <em>
          Note the number of any poster to redo and what to change.
          {missing.length > 0 && ` Still missing: ${missing.map((f) => `#${pad2(f.no)}`).join(", ")}.`}
        </em>
      </header>
      <div className="review-grid">
        {films.map((f) => (
          <figure key={f.no}>
            <a href={f.poster ?? undefined} target="_blank" rel="noreferrer">
              {f.poster ? (
                // eslint-disable-next-line @next/next/no-img-element -- static poster thumbnails
                <img src={posterThumb(f)} alt={`Poster for ${f.title}`} loading="lazy" />
              ) : (
                <div className="review-missing">No poster yet</div>
              )}
              <div className="review-title">
                <b>{f.title}</b>
                <span>Starring {f.star}</span>
              </div>
            </a>
            <figcaption>
              <code>#{pad2(f.no)}</code> after {f.source}
              <i>{f.tagline}</i>
            </figcaption>
          </figure>
        ))}
      </div>
    </main>
  );
}
