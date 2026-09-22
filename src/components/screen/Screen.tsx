"use client";

import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { Bulbs } from "@/components/Bulbs";
import { Curtains } from "@/components/Curtains";
import { artClass, films, firstName, pad2, type Film } from "@/data/season";
import posterColors from "@/data/poster-colors.json";
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

  // There is one projector on one laptop, so opening this page IS the start of the show: always begin
  // on the doors (QR) screen, whatever phase was left behind by a rehearsal. Guests already seated and
  // bravos are kept. After a mid-show refresh the host jumps back from /host.
  const [opened, setOpened] = useState(false);
  const opening = useRef(false);
  useEffect(() => {
    if (!ready || opening.current) return;
    opening.current = true;
    void dispatch({ type: "goto", phase: "doors" }).finally(() => setOpened(true));
  }, [ready, dispatch]);

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

  // Keyboard control on the projector laptop: the host drives from here as much as from /host.
  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") void dispatch({ type: "next" });
    else if (e.key === "ArrowLeft" || e.key === "PageUp") void dispatch({ type: "prev" });
    else if (e.key === "Home") void dispatch({ type: "goto", phase: "doors" });
    else if (e.key === "i") void dispatch({ type: "intermission", on: !state.intermission });
    else if (e.key === "f") document.documentElement.requestFullscreen?.();
  });
  useEffect(() => {
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="screen-root">
      <div className="stage" style={{ transform: `translate(-50%, -50%) scale(${scale})` }}>
        {ready && opened && (
          <div className={`phase${FILM_PHASES.has(state.phase) ? " weave" : ""}`} key={state.phase}>
            {state.phase === "doors" && <Doors seated={state.seated} photos={state.photos} />}
            {state.phase === "curtain" && (
              <CurtainUp onDone={() => void dispatch({ type: "next", ifPhase: "curtain" })} />
            )}
            {state.phase === "leader" && <Leader onDone={() => void dispatch({ type: "next", ifPhase: "leader" })} />}
            {state.phase === "ident" && (
              <Ident muted={state.muted} onDone={() => void dispatch({ type: "next", ifPhase: "ident" })} />
            )}
            {state.phase === "title" && <TitleCard />}
            {state.phase === "trailer" && <Trailer />}
            {state.phase === "premieres" && <Premiere key={state.premiere} film={films[state.premiere]} />}
            {state.phase === "curtaincall" && <CurtainCall state={state} />}
            {state.phase === "credits" && <Credits wishes={state.wishes} />}
          </div>
        )}
        {ready && opened && state.intermission && <Intermission />}
        {ready && opened && !armed && (
          <button type="button" className="arm" onClick={armRoom}>
            <b>Click to arm sound</b>
            <span>and go fullscreen · ← → step the show · i popcorn break · host remote at /host</span>
          </button>
        )}
        {FILM_PHASES.has(state.phase) && <div className="damage" aria-hidden="true" />}
        <div className="grain" aria-hidden="true" />
        <div className="vignette" aria-hidden="true" />
        <div className="phase-chip">
          {state.intermission ? "Intermission" : PHASE_LABEL[state.phase]}
          {!online && " · reconnecting…"}
        </div>
        {ready && <Reactions wishes={state.wishes} />}
      </div>
    </div>
  );
}

/** phases that are "on film": they get gate weave, scratches and dust */
const FILM_PHASES = new Set<string>(["leader", "ident", "title", "trailer", "premieres", "credits"]);

/**
 * Projector beam with dust motes drifting through it. Drawn at quarter
 * resolution and stretched — it is all soft light, and the projector laptop's
 * integrated GPU has better things to do.
 */
function Beam({ tint = "hsl(43 85% 72%)" }: { tint?: string }) {
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
      // "hsl(h s% l%)" → same colour with alpha
      cone.addColorStop(0, tint.replace(")", " / 0.2)"));
      cone.addColorStop(1, tint.replace(")", " / 0)"));
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
  }, [tint]);
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
      <div className="doors-stroll" aria-hidden="true">
        <Parade />
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

/** The team's ident film (public/media/ident.mp4). If it can't play, the title card and synth fanfare stand in. */
function Ident({ muted, onDone }: { muted: boolean; onDone: () => void }) {
  const [failed, setFailed] = useState(false);
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    v.muted = muted;
    // autoplay with sound is allowed because the operator armed the room with a click
    v.play().catch(() => {
      v.muted = true;
      v.play().catch(() => setFailed(true));
    });
  }, [muted]);

  if (!failed)
    return (
      <div className="ident">
        <video
          ref={video}
          className="ident-video"
          src="/media/ident.mp4"
          playsInline
          preload="auto"
          onEnded={onDone}
          onError={() => setFailed(true)}
        />
      </div>
    );
  return <IdentCard />;
}

function IdentCard() {
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

/** House lights down, curtains part on a dark screen, and the projector takes over. */
function CurtainUp({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  useCue(sfx.swoosh, 900);
  useCue(onDone, 3600);
  useEffect(() => {
    const t = setTimeout(() => setOpen(true), 900);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="curtainup">
      <div className="blank-screen" />
      <Curtains open={open} />
    </div>
  );
}

function TitleCard() {
  useCue(() => say(showCues.curtain), 700);
  return (
    <div className="curtainup">
      <Beam />
      <div className="season-card">
        <span>Studio 09 presents</span>
        <b>The September Season</b>
        <em>Twenty-seven features. Every one a leading role.</em>
      </div>
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
        <span>by Party People</span>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- premiere */

function Premiere({ film }: { film: Film }) {
  useCue(sfx.snap, 1050); // the clapper arm lands
  useCue(sfx.reveal, 1900); // the poster swings in
  useCue(() => say(premiereLine(film)), 3300);
  const accent = (posterColors as Record<string, string>)[pad2(film.no)];
  return (
    <div className="premiere" style={{ "--accent": accent } as React.CSSProperties}>
      {/* each film brings its own room: a soft wash of its poster's colours (pre-blurred by scripts/poster-assets.mjs) */}
      {film.poster && (
        <div className="ambient" style={{ backgroundImage: `url(${film.poster.replace(".webp", "-bg.webp")})` }} />
      )}
      <Beam tint={accent} />
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
          {film.poster && (
            <div className="poster-title">
              <b>{film.title}</b>
              <span>Starring {film.star}</span>
            </div>
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

/** the people who did this, billed the way they deserve; edit freely, this is the bit people remember */
const MAKERS: { name: string; role: string; line: string }[] = [
  {
    name: "Kavya",
    role: "Executive producer, caterer, bouncer",
    line: "Approved all this with the words \"sure, whatever\". Has since claimed it was her idea. It was.",
  },
  {
    name: "Mohana",
    role: "Casting director and head of secrets",
    line: "Was asked \"what's it for?\" three hundred times. Said \"a thing\" three hundred times. Nearly exploded.",
  },
  {
    name: "Arokia",
    role: "Director of code and head of bugs",
    line: "Built a backflipping hot dog instead of sleeping. If the screen freezes, clap. It won't help, but it feels good.",
  },
];

function Credits({ wishes }: { wishes: Wish[] }) {
  useCue(() => say(showCues.credits), 1500);
  return (
    <div className="credits">
      <div className="roll">
        <h2>Studio 09</h2>
        <p className="sub">The September Season</p>
        <h3>The people who did this</h3>
        {MAKERS.map((m) => (
          <div className="maker" key={m.name}>
            <b>{m.name}</b>
            <span>{m.role}</span>
            <q>{m.line}</q>
          </div>
        ))}
        <h3>The cast</h3>
        {films.map((f) => (
          <div className="credit" key={f.no}>
            <span>{f.title}</span>
            <b>{f.star}</b>
          </div>
        ))}
        <h3>From the audience</h3>
        {wishes.length ? (
          wishes.filter((w) => !isEmojiOnly(w.text)).map((w) => (
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
        {/* the post-credits tag */}
        <p className="returns">
          Party People will return in November.<small>Contractually obligated.</small>
        </p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- reactions */

const EMOJI_ONLY = /^[\p{Extended_Pictographic}\p{Emoji_Modifier}\u200d\ufe0f\s]+$/u;
const isEmojiOnly = (s: string) => EMOJI_ONLY.test(s);
const TOAST_MS = 7000;
const FLOAT_MS = 4200;
/** messages older than this on arrival (a laggy poll, a refresh) go to the credits only */
const STALE_MS = 30_000;

type Live = Wish & { kind: "emoji" | "text"; x: number };

/**
 * Guest messages as they land, on top of whatever phase is playing: an emoji floats up like a
 * live-stream reaction, a line of text pops up as a card bottom-left. History is never replayed
 * after a refresh; it is all in the end credits anyway.
 */
function Reactions({ wishes }: { wishes: Wish[] }) {
  const seen = useRef<Set<string> | null>(null);
  const [live, setLive] = useState<Live[]>([]);

  useEffect(() => {
    if (!seen.current) {
      seen.current = new Set(wishes.map((w) => w.id));
      return;
    }
    const fresh = wishes.filter((w) => !seen.current!.has(w.id));
    if (!fresh.length) return;
    fresh.forEach((w) => seen.current!.add(w.id));
    const now = Date.now();
    const add: Live[] = fresh
      .filter((w) => now - w.at < STALE_MS)
      .map((w) => ({ ...w, kind: isEmojiOnly(w.text) ? "emoji" : "text", x: 6 + Math.random() * 88 }));
    if (!add.length) return;
    setLive((l) => [...l, ...add].slice(-16));
    add.forEach((w) =>
      setTimeout(
        () => setLive((l) => l.filter((x) => x.id !== w.id)),
        w.kind === "emoji" ? FLOAT_MS : TOAST_MS,
      ),
    );
  }, [wishes]);

  const toasts = live.filter((w) => w.kind === "text").slice(-3);
  return (
    <div className="live" aria-live="polite">
      {live
        .filter((w) => w.kind === "emoji")
        .map((w) => (
          <div className="float" key={w.id} style={{ left: `${w.x}%` }}>
            {w.text}
            <small>{w.name.split(" ")[0]}</small>
          </div>
        ))}
      <div className="live-toasts">
        {toasts.map((w) => (
          <div className="toast" key={w.id}>
            <q>{w.text}</q>
            <b>{w.name}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- intermission */

/** kernels leaving the bucket: start offset, sideways drift, delay and size, all in stage px */
const KERNELS = [
  [-6, -150, 0.0, 34],
  [10, 120, 0.25, 28],
  [-18, -60, 0.5, 40],
  [22, 190, 0.7, 30],
  [0, 40, 0.95, 36],
  [-24, -210, 1.15, 26],
  [14, 90, 1.4, 32],
  [-10, -110, 1.65, 38],
  [26, 160, 1.9, 28],
  [-2, -20, 2.1, 30],
  [18, 230, 2.35, 34],
  [-20, -170, 2.6, 26],
] as const;

/** one at a time under the parade, a new one every few seconds */
const GOOFY = [
  "Popcorn is being served. It is not a prop. Eat it.",
  "Don't go anywhere. Seriously. We counted you.",
  "Bathroom break? Sprint. We are timing people.",
  "If you leave now, the hot dog wins.",
  "Please do not boo the soda. The soda is trying.",
  "Your seat will be given to someone with better posture.",
  "This intermission is sponsored by nobody. Nobody asked for it.",
  "The popcorn bucket has feelings. Wave back.",
];

/**
 * The popcorn break: a "let's all go to the lobby" snipe on top of whatever is playing. A striped
 * bucket, a soda and a hot dog on parade, kernels popping out of the bucket the whole time, and a
 * fresh bit of nonsense under them every few seconds.
 */
function Intermission() {
  useCue(() => say(showCues.intermission), 700);
  const [line, setLine] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setLine((n) => (n + 1) % GOOFY.length), 4200);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    let loop: ReturnType<typeof sfx.popcorn> | null = null;
    const t = setTimeout(() => (loop = sfx.popcorn()), 250);
    return () => {
      clearTimeout(t);
      loop?.stop();
    };
  }, []);

  return (
    <div className="intermission">
      <div className="frame inter-frame">
        <Bulbs step={30} />
        <h1>
          Intermission<span>Don&apos;t go anywhere</span>
        </h1>
      </div>

      <Parade />

      <p className="inter-sub" key={line}>
        {GOOFY[line]}
      </p>
    </div>
  );
}

/** the snack gang: soda, popcorn bucket and hot dog marching on the spot, kernels popping the whole time */
function Parade() {
  return (
    <div className="parade" aria-hidden="true">
      <div className="snack-wrap soda-wrap">
      <svg className="snack soda" viewBox="0 0 200 360">
        <g className="leg l"><rect x="70" y="300" width="18" height="40" rx="9" /><ellipse cx="72" cy="345" rx="26" ry="12" /></g>
        <g className="leg r"><rect x="112" y="300" width="18" height="40" rx="9" /><ellipse cx="128" cy="345" rx="26" ry="12" /></g>
        <rect className="straw" x="118" y="14" width="14" height="130" rx="7" transform="rotate(8 125 80)" />
        <path d="M48 142 H152 L138 310 Q100 322 62 310 Z" fill="#2f5fa8" />
        <path d="M56 205 H144 L140 250 H60 Z" fill="#f3e7cf" />
        <rect x="36" y="120" width="128" height="26" rx="10" fill="#f3e7cf" />
        <rect x="44" y="108" width="112" height="16" rx="8" fill="#e2b544" />
        <g className="face"><circle cx="82" cy="225" r="7" /><circle cx="118" cy="225" r="7" /><path d="M84 238 q16 14 32 0" /></g>
      </svg>
      </div>

      <div className="snack-wrap bucket-wrap">
        <div className="kernels">
          {KERNELS.map(([x0, dx, d, s], i) => (
            <i key={i} style={{ "--x0": `${x0}px`, "--dx": `${dx}px`, "--d": `${d}s`, "--s": `${s}px` } as React.CSSProperties} />
          ))}
        </div>
        <svg className="snack bucket" viewBox="0 0 260 400">
          <defs>
            <clipPath id="bucket-clip"><path d="M50 150 H210 L190 365 Q130 380 70 365 Z" /></clipPath>
          </defs>
          <g className="leg l"><rect x="92" y="340" width="20" height="44" rx="10" /><ellipse cx="94" cy="388" rx="30" ry="12" /></g>
          <g className="leg r"><rect x="148" y="340" width="20" height="44" rx="10" /><ellipse cx="166" cy="388" rx="30" ry="12" /></g>
          <path className="arm l" d="M52 210 Q20 190 14 150" />
          <path className="arm r" d="M208 210 Q240 190 246 150" />
          <path d="M50 150 H210 L190 365 Q130 380 70 365 Z" fill="#f7f1e4" />
          <g clipPath="url(#bucket-clip)" fill="#b3262b">
            <rect x="46" y="140" width="24" height="260" /><rect x="94" y="140" width="24" height="260" /><rect x="142" y="140" width="24" height="260" /><rect x="190" y="140" width="24" height="260" />
          </g>
          <rect x="38" y="138" width="184" height="22" rx="9" fill="#b3262b" />
          <g fill="#f5e3ad" stroke="#d8ad4a" strokeWidth="4">
            <circle cx="80" cy="118" r="30" /><circle cx="180" cy="118" r="30" /><circle cx="130" cy="96" r="36" /><circle cx="105" cy="132" r="26" /><circle cx="155" cy="132" r="26" /><circle cx="60" cy="140" r="20" /><circle cx="200" cy="140" r="20" /><circle cx="130" cy="140" r="24" />
          </g>
          <g className="face"><circle cx="105" cy="230" r="9" /><circle cx="155" cy="230" r="9" /><path d="M100 262 q30 30 60 0" /></g>
        </svg>
      </div>

      <div className="snack-wrap hotdog-wrap">
      <svg className="snack hotdog" viewBox="0 0 320 260">
        <g className="leg l"><rect x="110" y="196" width="18" height="40" rx="9" /><ellipse cx="112" cy="242" rx="26" ry="12" /></g>
        <g className="leg r"><rect x="190" y="196" width="18" height="40" rx="9" /><ellipse cx="206" cy="242" rx="26" ry="12" /></g>
        <rect x="20" y="96" width="280" height="96" rx="48" fill="#d9a35b" />
        <rect x="30" y="72" width="260" height="70" rx="35" fill="#b8402f" />
        <path d="M60 106 l22 -18 l22 18 l22 -18 l22 18 l22 -18 l22 18 l22 -18 l22 18 l22 -18" fill="none" stroke="#f4d21a" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
        <g className="face"><circle cx="130" cy="112" r="7" /><circle cx="190" cy="112" r="7" /><path d="M136 124 q24 16 48 0" /></g>
      </svg>
      </div>
    </div>
  );
}
