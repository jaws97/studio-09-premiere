"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bulbs } from "@/components/Bulbs";
import { Curtains } from "@/components/Curtains";
import { createStore } from "@/lib/store";

/**
 * What the lobby is allowed to know about a film. The server strips
 * title / star / source until reveal time, so the secret never ships
 * in the client bundle — do not import `@/data/season` from here.
 */
export type LobbyFilm = {
  no: number;
  day: number;
  art: string;
  title?: string;
  star?: string;
  source?: string;
  poster?: string;
};

const pad2 = (n: number) => String(n).padStart(2, "0");

export function Lobby({
  films,
  revealed,
  startsAt,
  venue,
  tagline,
  tickerExtras,
}: {
  films: LobbyFilm[];
  revealed: boolean;
  startsAt: string;
  venue: string;
  tagline: string;
  tickerExtras: string[];
}) {
  const [open, setOpen] = useState<LobbyFilm | null>(null);
  const tickerItems = useMemo(
    () => [
      ...films.map((f) =>
        f.title ? `${f.title} · opens Sep ${pad2(f.day)}` : `Feature ${pad2(f.no)} · opens Sep ${pad2(f.day)}`,
      ),
      ...tickerExtras,
    ],
    [films, tickerExtras],
  );

  return (
    <div className="lobby-page">
      <Curtains fixed autoOpenAfter={700} />
      <header className="marquee">
        <div className="frame">
          <Bulbs />
          <h1>
            Studio 09<span>Opening night · 7 October</span>
          </h1>
          <p>{tagline}</p>
          <div className="ticker">
            <div className="track">
              {[0, 1].flatMap((k) => tickerItems.map((s, i) => <span key={`${k}-${i}`}>{s}</span>))}
            </div>
          </div>
        </div>
      </header>

      <main className="wrap">
        <section className="lobby">
          <div className="panel">
            <h2>Curtain up in</h2>
            <p className="lead">Opening night, 7 October, {venue}. House lights dim ten minutes before.</p>
            <Countdown to={startsAt} />
          </div>
          <div className="panel">
            <h2>House seat</h2>
            <div className="perf" />
            <div className="stub">
              <div className="txt">
                <b>Stalls, Row 09</b>
                <i>Your stub. Show it at the usher&apos;s stand.</i>
              </div>
              <MockQr />
            </div>
          </div>
          <div className="panel">
            <h2>Curtain call</h2>
            <Applause />
          </div>
        </section>

        <section className="today">
          <ProjectionRoom />
          <div className="panel showing">
            <h2>Tonight&apos;s marquee</h2>
            <Tonight films={films} />
          </div>
        </section>

        <div className="wall-head">
          <h2>
            This season&apos;s releases<span>{films.length} features, one per person</span>
          </h2>
          <p>
            {revealed
              ? "Every poster is printed and framed for opening night. Tap one to open its stub."
              : "Titles and cast are under embargo until opening night. No spoilers from the projection room."}
          </p>
        </div>
        <section className="wall" aria-label="Poster wall">
          {films.map((f) => (
            <Poster key={f.no} film={f} onOpen={setOpen} />
          ))}
        </section>
      </main>

      <div className="carpet" aria-hidden="true">
        <div className="light l1" />
        <div className="light l2" />
        <div className="rope" />
        <p>
          <b>Studio 09</b>Twenty-seven headline acts. Every one a leading role.
        </p>
      </div>
      <footer>Studio 09 · one night only.</footer>

      {open && <TicketModal film={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

const clock = createStore<Date | null>(null, (set) => {
  set(new Date());
  const t = setInterval(() => set(new Date()), 1000);
  return () => clearInterval(t);
});

const CLAPS_KEY = "studio09-claps";
const clapStore = createStore(0, (set) => {
  try {
    set(parseInt(localStorage.getItem(CLAPS_KEY) || "0", 10) || 0);
  } catch {}
});

function Countdown({ to }: { to: string }) {
  const now = clock.use();
  const s = now ? Math.max(0, Math.floor((new Date(to).getTime() - now.getTime()) / 1000)) : 0;
  const cells: [number, string][] = [
    [Math.floor(s / 86400), "days"],
    [Math.floor((s % 86400) / 3600), "hours"],
    [Math.floor((s % 3600) / 60), "minutes"],
    [s % 60, "seconds"],
  ];
  return (
    <div className="count">
      {cells.map(([v, label]) => (
        <div key={label}>
          <b>{now ? pad2(v) : "--"}</b>
          <small>{label}</small>
        </div>
      ))}
    </div>
  );
}

/** Decorative stand-in; the real, scannable QR lives on /screen. */
function MockQr() {
  const cells = useMemo(() => {
    let seed = 9;
    const rnd = () => ((seed = (seed * 9301 + 49297) % 233280), seed / 233280);
    const out: boolean[] = [];
    for (let y = 0; y < 21; y++)
      for (let x = 0; x < 21; x++) {
        const finder = (x < 7 && y < 7) || (x > 13 && y < 7) || (x < 7 && y > 13);
        const fx = x % 7;
        const fy = y % 7;
        out.push(
          finder
            ? fx === 0 || fx === 6 || fy === 0 || fy === 6 || (fx >= 2 && fx <= 4 && fy >= 2 && fy <= 4)
            : rnd() > 0.55,
        );
      }
    return out;
  }, []);
  return (
    <div className="qr" aria-label="Mock ticket code">
      {cells.map((on, i) => (
        <i key={i} className={on ? "d" : undefined} />
      ))}
    </div>
  );
}

function Applause() {
  const claps = clapStore.use();

  const onClap = async (ev: React.MouseEvent<HTMLButtonElement>) => {
    const next = claps + 1;
    clapStore.set(next);
    try {
      localStorage.setItem(CLAPS_KEY, String(next));
    } catch {}
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = ev.currentTarget.getBoundingClientRect();
    const confetti = (await import("canvas-confetti")).default;
    confetti({
      particleCount: 18,
      spread: 70,
      startVelocity: 28,
      ticks: 90,
      scalar: 0.8,
      colors: ["#f4d27a", "#f3e7cf", "#e2b544"],
      origin: { x: (r.left + r.width / 2) / innerWidth, y: (r.top + r.height / 2) / innerHeight },
      disableForReducedMotion: true,
    });
  };

  return (
    <div className="applaud">
      <button type="button" onClick={onClap}>
        Bravo
      </button>
      <div>
        <b>{claps.toLocaleString("en-IN")}</b>
        <small>bravos from the house so far</small>
      </div>
    </div>
  );
}

const captions: [string, string][] = [
  ["Frame 1", "Reel loaded. House lights dimming."],
  ["Frame 2", "Projector warm. Popcorn warmer."],
  ["Frame 3", "Front row reserved for the birthday cast."],
  ["Frame 4", "Credits will run short tonight. Cake will not."],
  ["Frame 5", "Encore already requested from the back row."],
];

function ProjectionRoom() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % captions.length), 4200);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="cam" aria-label="Projection room">
      <div className="beam" />
      <div className="beam b2" />
      <div className="tag">Reel 09 · rolling</div>
      <div className="cap">
        <b>{captions[i][0]}</b>
        <span>{captions[i][1]}</span>
      </div>
    </div>
  );
}

function Tonight({ films }: { films: LobbyFilm[] }) {
  const now = clock.use();
  if (!now) return <p className="lead">Checking the programme…</p>;
  const isSep = now.getMonth() === 8;
  const td = now.getDate();
  const today = isSep ? films.filter((f) => f.day === td) : [];
  if (!today.length) {
    const next = isSep ? films.find((f) => f.day > td) : undefined;
    return (
      <p className="lead">
        {next
          ? `Dark house tonight. Next release: Sep ${pad2(next.day)}.`
          : "The season ran through September. The premiere is 7 October."}
      </p>
    );
  }
  return (
    <>
      <p className="lead">
        {today.length === 1 ? "One feature opens tonight." : `${today.length} features open tonight.`}
      </p>
      {today.map((f) => (
        <div className="film" key={f.no}>
          <div className={`mini ${f.art}`} />
          <div>
            <b>{f.title ?? `Feature ${pad2(f.no)}`}</b>
            <i>{f.star ? `Starring ${f.star}` : "Cast under embargo"}</i>
            <span className="pulse">Opening today</span>
          </div>
        </div>
      ))}
    </>
  );
}

function Poster({ film, onOpen }: { film: LobbyFilm; onOpen: (f: LobbyFilm) => void }) {
  if (!film.title) {
    return (
      <div className="poster sealed">
        <div className="seal">
          <span>Feature</span>
          <b>{pad2(film.no)}</b>
          <em>Coming soon</em>
          <span>In cinemas Sep {pad2(film.day)}</span>
        </div>
      </div>
    );
  }
  return (
    <button type="button" className="poster" onClick={() => onOpen(film)}>
      {film.poster ? <img src={film.poster} alt="" loading="lazy" /> : <div className={film.art} />}
      <div className="num">{pad2(film.no)}</div>
      <div className="genre">after {film.source}</div>
      <div className="title">{film.title}</div>
      <div className="star">
        <b>Starring {film.star}</b>In cinemas Sep {pad2(film.day)}
      </div>
    </button>
  );
}

function TicketModal({ film, onClose }: { film: LobbyFilm; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const n = pad2(film.no);
  return (
    <div
      className="modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tTitle"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="ticket">
        <button className="close" ref={closeRef} onClick={onClose} aria-label="Close">
          ×
        </button>
        <div className="photo">
          {film.poster ? <img src={film.poster} alt="" /> : <div className="ph">{film.star?.split(" ")[0]}</div>}
        </div>
        <div className="main">
          <div className="src">A twist on {film.source}</div>
          <h3 id="tTitle">{film.title}</h3>
          <p className="who">Starring {film.star}</p>
          <div className="meta">
            <div>
              <b>Sep {pad2(film.day)}</b>
              <small>in cinemas</small>
            </div>
            <div>
              <b>09</b>
              <small>row</small>
            </div>
            <div>
              <b>{n}</b>
              <small>seat</small>
            </div>
          </div>
          <p className="note">
            A house favourite, retitled for one night only. House lights up after the credits. Cake in the lobby.
          </p>
        </div>
        <div className="side">
          Admit one<b>{n}</b>Studio 09
        </div>
      </div>
    </div>
  );
}
