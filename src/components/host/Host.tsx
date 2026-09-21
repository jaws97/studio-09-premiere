"use client";

import { useEffect, useState } from "react";
import { films, pad2 } from "@/data/season";
import { PHASES, PHASE_LABEL, SEATS, useShow } from "@/lib/show";

type Queue = {
  wishes: { id: string; name: string; text: string }[];
  photos: { id: string; name: string }[];
};

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

      <Moderation />

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

/** Nothing a guest submits reaches the big screen until it is approved here. */
function Moderation() {
  const [queue, setQueue] = useState<Queue>({ wishes: [], photos: [] });

  useEffect(() => {
    let dead = false;
    const load = async () => {
      const res = await fetch("/api/host/queue", { cache: "no-store" }).catch(() => null);
      if (res?.ok && !dead) setQueue((await res.json()) as Queue);
    };
    void load();
    const t = setInterval(load, 3000);
    return () => {
      dead = true;
      clearInterval(t);
    };
  }, []);

  const decide = async (kind: "wish" | "photo", id: string, approve: boolean) => {
    const res = await fetch("/api/host/moderate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, id, approve }),
    }).catch(() => null);
    if (res?.ok) setQueue((await res.json()) as Queue);
  };

  const total = queue.wishes.length + queue.photos.length;
  if (!total) return null;
  return (
    <section>
      <h2>Waiting for approval · {total}</h2>
      <div className="queue">
        {queue.photos.map((p) => (
          <div className="q-item" key={p.id}>
            {/* eslint-disable-next-line @next/next/no-img-element -- served by our own photo route */}
            <img src={`/api/photo/${p.id}`} alt={`Photo from ${p.name}`} />
            <i>{p.name}</i>
            <div>
              <button type="button" className="on" onClick={() => decide("photo", p.id, true)}>
                Approve
              </button>
              <button type="button" className="danger" onClick={() => decide("photo", p.id, false)}>
                Reject
              </button>
            </div>
          </div>
        ))}
        {queue.wishes.map((w) => (
          <div className="q-item" key={w.id}>
            <q>{w.text}</q>
            <i>{w.name}</i>
            <div>
              <button type="button" className="on" onClick={() => decide("wish", w.id, true)}>
                Approve
              </button>
              <button type="button" className="danger" onClick={() => decide("wish", w.id, false)}>
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
