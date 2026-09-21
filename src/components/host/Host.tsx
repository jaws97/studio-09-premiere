"use client";

import { SEATS } from "@/components/screen/Screen";
import { films, pad2 } from "@/data/season";
import { PHASES, PHASE_LABEL, useShow } from "@/lib/show";

/** Host remote. PIN gate arrives with the Supabase transport. */
export function Host() {
  const { state, dispatch, ready } = useShow();
  if (!ready) return null;

  const film = films[state.premiere];
  const n = films.length;

  // Rehearsal helper: seats a star first, then anonymous guests.
  const simulateArrival = () => {
    const taken = new Set(state.seated.map((g) => g.seat));
    const free = Array.from({ length: SEATS }, (_, i) => i + 1).filter((s) => !taken.has(s));
    if (!free.length) return;
    const seat = free[Math.floor(Math.random() * free.length)];
    const star = seat <= n;
    dispatch({ type: "seat", guest: { seat, star, name: star ? films[seat - 1].star : `Guest ${pad2(seat)}` } });
  };

  return (
    <main className="host">
      <header>
        <span>Studio 09 · host remote</span>
        <b>{PHASE_LABEL[state.phase]}</b>
        {state.phase === "premieres" && (
          <em>
            {pad2(film.no)} / {n} · {film.title}
          </em>
        )}
      </header>

      <div className="transport">
        <button type="button" onClick={() => dispatch({ type: "prev", films: n })}>
          ◀ Back
        </button>
        <button type="button" className="go" onClick={() => dispatch({ type: "next", films: n })}>
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
        <h2>Rehearsal</h2>
        <div className="row">
          <button type="button" onClick={simulateArrival}>
            Simulate arrival ({state.seated.length}/{SEATS})
          </button>
          <button type="button" onClick={() => dispatch({ type: "clap", n: 5 })}>
            +5 bravos ({state.applause})
          </button>
          <button
            type="button"
            className="danger"
            onClick={() => confirm("Reset the whole show?") && dispatch({ type: "reset" })}
          >
            Reset show
          </button>
        </div>
      </section>
    </main>
  );
}
