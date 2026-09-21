"use client";

import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { Bulbs } from "@/components/Bulbs";
import { Curtains } from "@/components/Curtains";
import { artClass, films, firstName, pad2, type Film } from "@/data/season";
import * as sfx from "@/lib/sfx";
import { PHASE_LABEL, SEATS, useShow, type Seated, type ShowState, type Wish } from "@/lib/show";

const STAGE_W = 1920;
const STAGE_H = 1080;

/** Fixed 1920×1080 stage scaled to fit whatever the projector gives us. */
function useStageScale() {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const fit = () => setScale(Math.min(innerWidth / STAGE_W, innerHeight / STAGE_H));
    fit();
    addEventListener("resize", fit);
    return () => removeEventListener("resize", fit);
  }, []);
  return scale;
}

export function Screen() {
  const { state, dispatch, ready, online } = useShow();
  const scale = useStageScale();
  const [armed, setArmed] = useState(false);

  useEffect(() => sfx.setMuted(state.muted), [state.muted, armed]);

  // Browsers only play audio after a gesture, so the operator arms the room once.
  const armRoom = async () => {
    setArmed(await sfx.arm());
    document.documentElement.requestFullscreen?.().catch(() => {});
  };

  // Keyboard fallback for the projector laptop if the host remote dies.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") void dispatch({ type: "next" });
      else if (e.key === "ArrowLeft" || e.key === "PageUp") void dispatch({ type: "prev" });
      else if (e.key === "f") document.documentElement.requestFullscreen?.();
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [dispatch]);

  return (
    <div className="screen-root">
      <div className="stage" style={{ transform: `translate(-50%, -50%) scale(${scale})` }}>
        {ready && (
          <div className="phase" key={state.phase}>
            {state.phase === "doors" && <Doors seated={state.seated} photos={state.photos} />}
            {state.phase === "leader" && <Leader onDone={() => void dispatch({ type: "next", ifPhase: "leader" })} />}
            {state.phase === "ident" && <Ident />}
            {state.phase === "curtain" && <CurtainUp />}
            {state.phase === "trailer" && <Trailer />}
            {state.phase === "premieres" && <Premiere key={state.premiere} film={films[state.premiere]} />}
            {state.phase === "curtaincall" && <CurtainCall state={state} />}
            {state.phase === "credits" && <Credits wishes={state.wishes} />}
          </div>
        )}
        {ready && !armed && (
          <button type="button" className="arm" onClick={armRoom}>
            <b>Click to arm sound</b>
            <span>and go fullscreen · ← → step the show · host remote at /host</span>
          </button>
        )}
        <div className="grain" aria-hidden="true" />
        <div className="vignette" aria-hidden="true" />
        <div className="phase-chip">
          {PHASE_LABEL[state.phase]}
          {!online && " · reconnecting…"}
        </div>
      </div>
    </div>
  );
}

/** Fire a cue `delay` ms after mount. The timeout keeps dev StrictMode's double mount from doubling the sound. */
function useCue(cue: () => void, delay = 40) {
  const fire = useEffectEvent(cue);
  useEffect(() => {
    const t = setTimeout(fire, delay);
    return () => clearTimeout(t);
  }, [delay]);
}

/* ------------------------------------------------------------------ doors */

function Doors({ seated, photos }: { seated: Seated[]; photos: string[] }) {
  const latest = seated[seated.length - 1];
  const taken = useMemo(() => new Map(seated.map((g) => [g.seat, g])), [seated]);

  // chime for arrivals, but not for whoever was already seated when the screen loaded
  const seen = useRef<number | null>(null);
  useEffect(() => {
    if (seen.current !== null && seated.length > seen.current && latest) sfx.chime(latest.star);
    seen.current = seated.length;
  }, [seated.length, latest]);
  return (
    <div className="doors">
      <div className="doors-left">
        <div className="frame doors-frame">
          <Bulbs step={34} />
          <h1>
            Studio 09<span>Opening night · doors open</span>
          </h1>
        </div>
        <div className="doors-qr">
          <TicketQr />
          <div>
            <b>Scan for your ticket</b>
            <p>Then show it to the usher. No ticket, no popcorn.</p>
          </div>
        </div>
        <Paparazzi photos={photos} />
      </div>
      <div className="doors-right">
        <div className="house-head">
          <span>The house</span>
          <b>
            {seated.length}
            <small> / {SEATS} seated</small>
          </b>
        </div>
        <div className="screen-bar">Screen</div>
        <div className="seatmap">
          {Array.from({ length: SEATS }, (_, i) => {
            const g = taken.get(i + 1);
            const fresh = g && g === latest;
            return <i key={i} className={`seat${g ? " taken" : ""}${g?.star ? " star" : ""}${fresh ? " fresh" : ""}`} />;
          })}
        </div>
        <div className="now-seated" key={latest?.seat ?? 0}>
          {latest ? (
            <>
              <span>Now seated · seat {pad2(latest.seat)}</span>
              <b>{latest.name}</b>
              {latest.star && <em>★ tonight&apos;s cast</em>}
            </>
          ) : (
            <>
              <span>Ushers at the ready</span>
              <b>Waiting for the first guest…</b>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** Latest approved guest photos, pinned up like red-carpet snaps. */
function Paparazzi({ photos }: { photos: string[] }) {
  const latest = photos.slice(-5);
  if (!latest.length) return null;
  return (
    <div className="paparazzi">
      {latest.map((id, i) => (
        // eslint-disable-next-line @next/next/no-img-element -- served by our own photo route
        <img key={id} src={`/api/photo/${id}`} alt="" style={{ rotate: `${((i * 37) % 13) - 6}deg` }} />
      ))}
    </div>
  );
}

function TicketQr() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let dead = false;
    (async () => {
      const QRCodeStyling = (await import("qr-code-styling")).default;
      if (dead || !ref.current) return;
      const qr = new QRCodeStyling({
        width: 300,
        height: 300,
        data: `${location.origin}/ticket`,
        margin: 8,
        // dark-on-light: inverted gold-on-black codes scan badly off a projector
        dotsOptions: { type: "rounded", color: "#120c0a" },
        cornersSquareOptions: { type: "extra-rounded", color: "#6e1518" },
        cornersDotOptions: { color: "#6e1518" },
        backgroundOptions: { color: "#f3e7cf" },
        qrOptions: { errorCorrectionLevel: "M" },
      });
      ref.current.innerHTML = "";
      qr.append(ref.current);
    })();
    return () => {
      dead = true;
    };
  }, []);
  return <div className="qr-box" ref={ref} />;
}

/* ----------------------------------------------------------------- leader */

function Leader({ onDone }: { onDone: () => void }) {
  const [n, setN] = useState(5);
  const finish = useEffectEvent(onDone);

  useEffect(() => {
    const whirr = sfx.projector();
    return () => whirr.stop();
  }, []);
  useEffect(() => {
    if (n > 0) sfx.beep(n === 1);
  }, [n]);
  useEffect(() => {
    if (n === 0) {
      const t = setTimeout(() => finish(), 350);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setN((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [n]);
  return (
    <div className="leader">
      {n > 0 && (
        <>
          <div className="leader-sweep" key={n} />
          <div className="leader-cross" />
          <div className="leader-ring" />
          <div className="leader-ring r2" />
          <div className="leader-num">{n}</div>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ ident */

function Ident() {
  useCue(sfx.fanfare);
  return (
    <div className="ident">
      {/* swapped for the generated ident video once it exists */}
      <div className="ident-rays" />
      <div className="ident-mark">
        <span>A</span>
        <b>Studio 09</b>
        <span>production</span>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- curtain */

function CurtainUp() {
  const [open, setOpen] = useState(false);
  useCue(sfx.swoosh, 900);
  useEffect(() => {
    const t = setTimeout(() => setOpen(true), 900);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="curtainup">
      <div className="season-card">
        <span>Studio 09 presents</span>
        <b>The September Season</b>
        <em>Twenty-seven features. Not a single supporting role.</em>
      </div>
      <Curtains open={open} />
    </div>
  );
}

/* ---------------------------------------------------------------- trailer */

function Trailer() {
  return (
    <div className="trailer">
      {/* <video src="/media/trailer.mp4" autoPlay /> once the trailer is cut */}
      <div className="greenband">
        <b>The following preview has been approved for all birthday audiences</b>
        <span>by the Studio 09 cake committee</span>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- premiere */

function Premiere({ film }: { film: Film }) {
  useCue(sfx.snap, 1050); // the clapper arm lands
  useCue(sfx.reveal, 1900); // the poster swings in
  return (
    <div className="premiere">
      <div className="spot s1" />
      <div className="spot s2" />
      <div className="clapper">
        <div className="clap-arm" />
        <div className="clap-body">
          <div>
            <small>Prod.</small>
            <b>Studio 09</b>
          </div>
          <div>
            <small>Scene</small>
            <b>Sep {pad2(film.day)}</b>
          </div>
          <div>
            <small>Take</small>
            <b>{pad2(film.no)}</b>
          </div>
          <div>
            <small>Star</small>
            <b>{firstName(film)}</b>
          </div>
        </div>
      </div>

      <div className="premiere-body">
        <div className="bigposter">
          {film.clip ? (
            <video src={film.clip} poster={film.poster} autoPlay muted loop playsInline />
          ) : film.poster ? (
            <img src={film.poster} alt="" />
          ) : (
            <div className={artClass(film)} />
          )}
          <div className="foil" />
          <div className="sheen" />
        </div>
        <div className="billing">
          <span className="after">A twist on {film.source}</span>
          <h2 aria-label={film.title}>
            {film.title.split(" ").map((word, i) => (
              <span key={i} aria-hidden="true" style={{ animationDelay: `${3 + i * 0.14}s` }}>
                {word}
              </span>
            ))}
          </h2>
          <p className="starring">
            Starring <b>{film.star}</b>
          </p>
          <p className="release">
            In cinemas <b>Sep {pad2(film.day)}</b> · Feature {pad2(film.no)} of {films.length}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- curtain call */

/** claps per second that pins the needle */
const FULL_HOUSE = 25;

function CurtainCall({ state }: { state: ShowState }) {
  const total = useRef(state.applause);
  useEffect(() => {
    total.current = state.applause;
  }, [state.applause]);
  const [level, setLevel] = useState(0);
  const peaked = useRef(false);
  const crowd = useRef<ReturnType<typeof sfx.applause> | null>(null);

  useEffect(() => {
    const t = setTimeout(() => (crowd.current = sfx.applause()), 40);
    return () => {
      clearTimeout(t);
      crowd.current?.stop();
      crowd.current = null;
    };
  }, []);
  useEffect(() => crowd.current?.level?.(level), [level]);

  useEffect(() => {
    const samples: [number, number][] = [];
    const t = setInterval(() => {
      const now = performance.now();
      samples.push([now, total.current]);
      while (samples.length > 1 && now - samples[0][0] > 2000) samples.shift();
      const [t0, c0] = samples[0];
      const rate = now > t0 ? ((total.current - c0) / (now - t0)) * 1000 : 0;
      setLevel((prev) => prev + (Math.min(1, rate / FULL_HOUSE) - prev) * 0.35);
    }, 100);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (level > 0.92 && !peaked.current) {
      peaked.current = true;
      import("canvas-confetti").then(({ default: confetti }) => {
        const colors = ["#f4d27a", "#f3e7cf", "#e2b544", "#8f1f23"];
        confetti({ particleCount: 220, spread: 120, startVelocity: 55, origin: { x: 0.5, y: 0.7 }, colors });
        setTimeout(() => confetti({ particleCount: 160, angle: 60, spread: 80, origin: { x: 0, y: 0.8 }, colors }), 250);
        setTimeout(() => confetti({ particleCount: 160, angle: 120, spread: 80, origin: { x: 1, y: 0.8 }, colors }), 400);
      });
    }
    if (level < 0.5) peaked.current = false;
  }, [level]);

  const angle = -80 + level * 160;
  return (
    <div className="curtaincall">
      <h2>
        Curtain call<span>Bravo button on your phone. Make the needle move.</span>
      </h2>
      <div className="meter">
        <div className="meter-arc" />
        <div className="meter-labels">
          <span>Polite</span>
          <span>Warm</span>
          <span>Roaring</span>
          <span>Standing ovation</span>
        </div>
        <div className="needle" style={{ transform: `rotate(${angle}deg)` }} />
        <div className="hub" />
      </div>
      <div className="bravos">
        <b>{state.applause.toLocaleString("en-IN")}</b> bravos from the house
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- credits */

const stockRoles = [
  "Executive Producer",
  "Director of Photography",
  "Best Boy Grip",
  "Stunt Coordinator",
  "Key Gaffer",
  "Script Supervisor",
  "Catering (ate it all)",
  "Dialogue Coach",
  "Second Unit Director",
  "Foley Artist",
  "Dolly Grip",
  "Continuity",
  "Location Scout",
];

function Credits({ wishes }: { wishes: Wish[] }) {
  return (
    <div className="credits">
      <div className="roll">
        <h2>Studio 09</h2>
        <p className="sub">The September Season</p>
        <h3>The cast</h3>
        {films.map((f) => (
          <div className="credit" key={f.no}>
            <span>{f.title}</span>
            <b>{f.star}</b>
          </div>
        ))}
        <h3>The crew</h3>
        {films.map((f, i) => (
          <div className="credit" key={f.no}>
            <span>{f.creditRole ?? stockRoles[i % stockRoles.length]}</span>
            <b>{f.star}</b>
          </div>
        ))}
        <h3>From the audience</h3>
        {wishes.length ? (
          wishes.map((w) => (
            <div className="wish" key={w.id}>
              <q>{w.text}</q>
              <b>{w.name}</b>
            </div>
          ))
        ) : (
          <p className="sub">The audience was speechless.</p>
        )}
        <p className="fin">No birthdays were harmed in the making of this season.</p>
        <p className="cake">Cake in the lobby.</p>
      </div>
    </div>
  );
}
