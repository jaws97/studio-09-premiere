"use client";

import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { Bulbs } from "@/components/Bulbs";
import { Curtains } from "@/components/Curtains";
import { artClass, films, firstName, pad2, type Film } from "@/data/season";
import { premiereLine, showCues } from "@/data/vo";
import * as sfx from "@/lib/sfx";
import { say, setVoMuted, stopVo } from "@/lib/vo";
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

  useEffect(() => {
    sfx.setMuted(state.muted);
    setVoMuted(state.muted);
  }, [state.muted, armed]);

  // a phase change cuts the announcer off; the new phase brings its own line
  useEffect(() => stopVo, [state.phase, state.premiere]);

  // announcer lines the host fires by hand
  const cueN = state.cue?.n ?? 0;
  const heard = useRef<number | null>(null);
  useEffect(() => {
    if (!ready) return;
    if (heard.current !== null && cueN > heard.current && state.cue && armed) say(showCues[state.cue.id]);
    heard.current = cueN;
  }, [cueN, ready, armed, state.cue]);

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
          <div className={`phase${FILM_PHASES.has(state.phase) ? " weave" : ""}`} key={state.phase}>
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
        {FILM_PHASES.has(state.phase) && <div className="damage" aria-hidden="true" />}
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

/** phases that are "on film": they get gate weave, scratches and dust */
const FILM_PHASES = new Set<string>(["leader", "ident", "trailer", "premieres", "credits"]);

/**
 * Projector beam with dust motes drifting through it. Drawn at quarter
 * resolution and stretched — it is all soft light, and the projector laptop's
 * integrated GPU has better things to do.
 */
function Beam() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    const g = cv?.getContext("2d");
    if (!cv || !g) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const W = (cv.width = 480);
    const H = (cv.height = 270);
    // cone from the top-right corner down across the stage
    const ox = W * 1.02;
    const oy = -H * 0.05;
    const aim = Math.atan2(H * 0.62 - oy, W * 0.2 - ox);
    const spread = 0.23;
    const motes = Array.from({ length: 90 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: 0.4 + Math.random() * 1.1,
      vx: -0.05 - Math.random() * 0.12,
      vy: 0.02 + Math.random() * 0.06,
      tw: Math.random() * Math.PI * 2,
    }));
    let raf = 0;
    const draw = (t: number) => {
      g.clearRect(0, 0, W, H);
      const cone = g.createRadialGradient(ox, oy, 0, ox, oy, W * 1.1);
      cone.addColorStop(0, "rgba(244,210,122,0.20)");
      cone.addColorStop(1, "rgba(244,210,122,0)");
      g.fillStyle = cone;
      g.beginPath();
      g.moveTo(ox, oy);
      g.arc(ox, oy, W * 1.2, aim - spread, aim + spread);
      g.closePath();
      g.fill();
      for (const m of motes) {
        m.x += m.vx;
        m.y += m.vy + Math.sin(t / 1400 + m.tw) * 0.03;
        if (m.x < -4) m.x = W + 4;
        if (m.y > H + 4) m.y = -4;
        let off = Math.atan2(m.y - oy, m.x - ox) - aim;
        off = Math.abs(Math.atan2(Math.sin(off), Math.cos(off))); // wrap to [-π, π]
        if (off > spread) continue; // motes only catch the light inside the beam
        const a = (1 - off / spread) * (0.35 + 0.35 * Math.sin(t / 500 + m.tw));
        g.fillStyle = `rgba(255,240,200,${a.toFixed(3)})`;
        g.beginPath();
        g.arc(m.x, m.y, m.r, 0, Math.PI * 2);
        g.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas className="beamfx" ref={ref} aria-hidden="true" />;
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
            {Math.min(seated.length, SEATS)}
            <small>
              {" "}
              / {SEATS} seated{seated.length > SEATS && ` · +${seated.length - SEATS} in the balcony`}
            </small>
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
      <Beam />
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
  useCue(() => say(showCues.curtain), 2200);
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
  useCue(() => say(showCues.trailer), 600);
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
  useCue(() => say(premiereLine(film)), 3300);
  return (
    <div className="premiere">
      <Beam />
      <div className="cuemark" />
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
          <p className="tagline">{film.tagline}</p>
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

/**
 * Claps per second that pin the needle. It scales with the house so a
 * standing ovation needs most of the room tapping, whether 30 came or 130.
 */
const fullHouse = (seated: number) => Math.max(25, seated * 1.5);

function CurtainCall({ state }: { state: ShowState }) {
  const total = useRef(state.applause);
  const full = useRef(fullHouse(state.seated.length));
  useEffect(() => {
    total.current = state.applause;
    full.current = fullHouse(state.seated.length);
  }, [state.applause, state.seated.length]);
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
  useCue(() => say(showCues.curtaincall), 700);

  useEffect(() => {
    const samples: [number, number][] = [];
    const t = setInterval(() => {
      const now = performance.now();
      samples.push([now, total.current]);
      while (samples.length > 1 && now - samples[0][0] > 2000) samples.shift();
      const [t0, c0] = samples[0];
      const rate = now > t0 ? ((total.current - c0) / (now - t0)) * 1000 : 0;
      setLevel((prev) => prev + (Math.min(1, rate / full.current) - prev) * 0.35);
    }, 100);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (level > 0.92 && !peaked.current) {
      peaked.current = true;
      say(showCues.ovation);
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
  useCue(() => say(showCues.credits), 1500);
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
