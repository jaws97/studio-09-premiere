"use client";

import { films, pad2 } from "@/data/season";
import { PHASES, PHASE_LABEL, SEATS, useShow, type AnnounceCue } from "@/lib/show";

const ANNOUNCE: [AnnounceCue, string][] = [
  ["doors", "“Welcome… tickets ready”"],
  ["seats", "“Please take your seats”"],
  ["premieres", "“Tonight's premieres…”"],
];

export function Host() {
  const { state, dispatch, ready, online } = useShow();
  if (!ready) return null;

  const film = films[state.premiere];
  const n = films.length;

  return (
    <main className="host">
      <header>
        <span>Studio 09 · host remote{!online && " · offline, retrying…"}</span>
        <b>{PHASE_LABEL[state.phase]}</b>
        {state.phase === "premieres" && (
          <em>
            {pad2(film.no)} / {n} · {film.title}
          </em>
        )}
      </header>

      <div className="transport">
        <button type="button" onClick={() => dispatch({ type: "prev" })}>
          ◀ Back
        </button>
        <button type="button" className="go" onClick={() => dispatch({ type: "next" })}>
          Next ▶
        </button>
      </div>

      <section>
        <h2>Run of show</h2>
        <ol className="phases">
          {PHASES.map((p) => (
            <li key={p}>
              <button
                type="button"
                className={p === state.phase ? "on" : undefined}
                onClick={() => dispatch({ type: "goto", phase: p })}
              >
                {PHASE_LABEL[p]}
              </button>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h2>Jump to premiere</h2>
        <div className="grid">
          {films.map((f, i) => (
            <button
              type="button"
              key={f.no}
              className={state.phase === "premieres" && i === state.premiere ? "on" : undefined}
              onClick={() => dispatch({ type: "premiere", index: i })}
              title={f.title}
            >
              {pad2(f.no)}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2>Announcer</h2>
        <div className="row">
          {ANNOUNCE.map(([cue, label]) => (
            <button type="button" key={cue} onClick={() => dispatch({ type: "announce", cue })}>
              {label}
            </button>
          ))}
          <a href="/host/script">Announcer script &amp; recording sheet →</a>
          <a href="/host/posters">Poster review →</a>
        </div>
      </section>

      <section>
        <h2>House</h2>
        <div className="row">
          <button
            type="button"
            className={state.muted ? "on" : undefined}
            onClick={() => dispatch({ type: "mute", muted: !state.muted })}
          >
            {state.muted ? "Sound is muted — tap to unmute" : "Mute screen sound"}
          </button>
        </div>
      </section>

      <section>
        <h2>Rehearsal</h2>
        <div className="row">
          <button type="button" onClick={() => dispatch({ type: "simulate" })}>
            Simulate arrival ({state.seated.length}/{SEATS})
          </button>
          <button type="button" onClick={() => dispatch({ type: "clap", n: 5 })}>
            +5 bravos ({state.applause})
          </button>
          <button
            type="button"
            className="danger"
            onClick={() =>
              confirm("Reset the whole show? Tickets, messages and photos are wiped.") && dispatch({ type: "reset" })
            }
          >
            Reset show
          </button>
        </div>
      </section>
    </main>
  );
}
