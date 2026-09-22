"use client";

import {
  animate,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useTransform,
} from "motion/react";
import { useEffect, useRef, useState } from "react";
import {
  armRipOnFirstTouch,
  buzz,
  printCut,
  printStep,
  ripFinish,
  ripTick,
  unlockRip,
} from "@/lib/rip";
import { numOf, rowOf } from "@/lib/show-core";
import {
  post,
  saveTicket,
  syncAdmit,
  useTicket,
  type TicketData,
} from "@/lib/ticket";

/** distance between perforation holes in CSS px; must match --pitch in ticket.css */
const PITCH = 14;
const COMMIT_AT = 0.6;

const pad2 = (n: number) => String(n).padStart(2, "0");

export function TicketPage({ cast }: { cast: string[] }) {
  const ticket = useTicket();
  // true only for a ticket issued on this page load: it comes out of the printer. A reloaded ticket is
  // already in the guest's hand, so it just appears.
  const [fresh, setFresh] = useState(false);
  useEffect(() => armRipOnFirstTouch(), []);
  if (ticket === undefined) return <main className="ticket-page" />;
  return (
    <main className="ticket-page">
      <header className="tp-head">
        <b>Studio 09</b>
        <span>Opening night · 7 October</span>
      </header>
      {ticket ? (
        <Ticket ticket={ticket} print={fresh} />
      ) : (
        <BoxOffice cast={cast} onIssued={() => setFresh(true)} />
      )}
    </main>
  );
}

function BoxOffice({
  cast,
  onIssued,
}: {
  cast: string[];
  onIssued: () => void;
}) {
  const [name, setName] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "failed">("idle");
  const ok = name.trim().length >= 2 && state !== "busy";

  const issue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ok) return;
    unlockRip(); // this tap is the gesture that lets the rip sound play from the first perforation
    setState("busy");
    try {
      const res = await post("/api/ticket", { name });
      if (!res.ok) throw new Error(String(res.status));
      const issued = (await res.json()) as TicketData;
      onIssued();
      saveTicket(issued);
    } catch {
      setState("failed");
    }
  };

  const typed = name.trim().replace(/\s+/g, " ");
  const isCast = cast.some((c) => c.toLowerCase() === typed.toLowerCase());

  return (
    <div className="bo">
      {/* the booth: generated art, no text in it, fading into the page */}
      <div
        className="bo-hero"
        role="img"
        aria-label="A glowing vintage cinema box office"
      >
        {/* lettered onto the blank sign panel in the artwork */}
        <span className="bo-sign">Box office</span>
      </div>

      {/* the ticket fills itself in as the guest types */}
      <div
        className={`bo-preview${isCast ? " cast" : ""}${typed ? " live" : ""}`}
        aria-hidden="true"
      >
        <div>
          <small>Admit one</small>
          <b>{typed || "Your name here"}</b>
          <em>{isCast ? "★ Tonight's cast" : "Opening night · 7 October"}</em>
        </div>
        <div className="bo-preview-seat">
          <small>Seat</small>
          <b>?</b>
        </div>
      </div>

      <form className="boxoffice" onSubmit={issue}>
        <p>Name on the ticket, please.</p>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          list="cast"
          placeholder="Your full name"
          autoComplete="name"
          enterKeyHint="go"
          maxLength={48}
        />
        <datalist id="cast">
          {cast.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <button type="submit" disabled={!ok}>
          {state === "busy" ? "Printing…" : "Print my ticket"}
        </button>
        {state === "failed" && (
          <p role="alert">The box office line is busy. Try once more.</p>
        )}
      </form>

      <ol className="bo-steps">
        <li>
          <b>Print your ticket</b>
          <span>Your seat is picked for you. No refunds, no regrets.</span>
        </li>
        <li>
          <b>Show it to the usher</b>
          <span>
            They tear along the dotted line. Sound on, it&apos;s satisfying.
          </span>
        </li>
        <li>
          <b>You&apos;re in</b>
          <span>
            Watch the big screen. It announces you like you own the place.
          </span>
        </li>
      </ol>
      <p className="bo-foot">One ticket per person. No ticket, no popcorn.</p>
    </div>
  );
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const FEED_STEPS = 18;

/**
 * The ticket coming out of the box-office printer: a slot at the top, the paper fed out in motor
 * steps (one click and one buzz each), a snip from the cutter, then the ticket drops free.
 */
function usePrinter(print: boolean) {
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [stage, setStage] = useState<"feed" | "cut" | "done">(
    print ? "feed" : "done",
  );
  const feed = useMotionValue(print ? 0 : 1);
  const drop = useMotionValue(0);
  const y = useTransform(
    () =>
      `calc(${((feed.get() - 1) * 100).toFixed(2)}% + ${drop.get().toFixed(1)}px)`,
  );

  // Runs once on mount (motion values are stable). Strict mode runs it twice in dev: the first run is
  // cancelled by its cleanup before it moves anything. Stage changes must NOT re-run it, or the cleanup
  // would kill the loop mid-print.
  useEffect(() => {
    if (feed.get() === 1) return; // nothing to print
    let dead = false;
    (async () => {
      if (reduced()) {
        feed.set(1);
        return setStage("done");
      }
      scrollTo({ top: 0, behavior: "smooth" });
      await wait(380); // the machine wakes up first
      for (let i = 1; i <= FEED_STEPS && !dead; i++) {
        printStep();
        buzz(6);
        await animate(feed, i / FEED_STEPS, {
          duration: 0.06,
          ease: "easeOut",
        });
        await wait(30 + Math.random() * 45);
      }
      if (dead) return;
      printCut();
      buzz([20, 30, 20]);
      setStage("cut");
      // the paper drops free while the machine fades out; wait for both
      await Promise.all([
        animate(drop, 12, { type: "spring", stiffness: 380, damping: 14 }),
        wait(700),
      ]);
      if (!dead) setStage("done");
    })();
    return () => {
      dead = true;
    };
  }, [feed, drop]);

  return { stage, y };
}

function Ticket({ ticket, print }: { ticket: TicketData; print: boolean }) {
  const torn = ticket.admittedAt != null;
  const printer = usePrinter(print && !torn);
  const progress = useMotionValue(torn ? 1 : 0);
  const seamRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const lastHole = useRef(0);
  const holes = useRef(22);
  const [hint, setHint] = useState(true);

  // Paper stays joined ahead of the tear, so the stub hinges AT the tear point: everything already torn
  // swings open to the left of it, everything still attached stays tucked against the body.
  const stubRotate = useTransform(progress, [0, 1], [0, -10]);
  const hinge = useTransform(progress, (p) => `${(p * 100).toFixed(1)}% 0%`);
  const handleLeft = useTransform(progress, (p) => `${p * 100}%`);

  // Falling away after the tear completes.
  const dropY = useMotionValue(torn ? 900 : 0);
  const dropRotate = useMotionValue(torn ? -28 : 0);
  const dropOpacity = useMotionValue(torn ? 0 : 1);
  const rotate = useTransform(() => stubRotate.get() + dropRotate.get());
  const y = dropY;

  useMotionValueEvent(progress, "change", (p) => {
    if (!dragging.current) return;
    const hole = Math.floor(p * holes.current); // one tick and one buzz per real hole
    if (hole > lastHole.current) {
      lastHole.current = hole;
      ripTick();
      buzz(8);
    }
  });

  const complete = () => {
    ripFinish();
    buzz([30, 20, 60]);
    animate(dropY, 900, { duration: 0.9, ease: [0.5, 0, 0.9, 0.6] });
    animate(dropRotate, -28, { duration: 0.9, ease: "easeIn" });
    animate(dropOpacity, 0, { duration: 0.35, delay: 0.55 });
    saveTicket({ ...ticket, admittedAt: Date.now() });
    void syncAdmit();
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
      import("canvas-confetti").then(({ default: confetti }) =>
        confetti({
          particleCount: 90,
          spread: 80,
          startVelocity: 38,
          origin: { x: 0.5, y: 0.62 },
          colors: ["#f4d27a", "#f3e7cf", "#e2b544", "#8f1f23"],
        }),
      );
    }
  };

  const finishTear = () =>
    animate(progress, 1, { duration: 0.22, ease: "easeOut" }).then(complete);

  const pAt = (clientX: number) => {
    const r = seamRef.current!.getBoundingClientRect();
    return Math.min(1, Math.max(0, (clientX - r.left) / r.width));
  };

  const onDown = (e: React.PointerEvent) => {
    if (torn) return;
    unlockRip();
    // the tear has to start where the paper is still whole, not mid-ticket
    if (pAt(e.clientX) > progress.get() + 0.22) return;
    dragging.current = true;
    holes.current = Math.max(
      8,
      Math.round(seamRef.current!.getBoundingClientRect().width / PITCH),
    );
    setHint(false);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const p = pAt(e.clientX);
    if (p > progress.get()) progress.set(p); // paper doesn't un-tear
  };
  const onUp = () => {
    if (!dragging.current) return;
    dragging.current = false;
    if (progress.get() >= COMMIT_AT) void finishTear();
    else {
      lastHole.current = 0;
      animate(progress, 0, { type: "spring", stiffness: 420, damping: 30 });
    }
  };

  // No visible button: the perforation itself is the control. Keyboard and switch users can still focus
  // it and press Enter, Space or → to tear.
  const tearByKey = () => {
    unlockRip();
    dragging.current = true; // so the perforation ticks play
    animate(progress, 1, { duration: 0.7, ease: "easeInOut" }).then(() => {
      dragging.current = false;
      complete();
    });
  };

  return (
    <div
      className={`tk${ticket.star ? " cast" : ""}${torn ? " torn" : ""}${print ? " printed" : ""}${printer.stage !== "done" ? " printing" : ""}`}
    >
      {/* the clip lives on this static wrapper: put on the moving paper it would travel with it */}
      <div className="tk-feed">
        {printer.stage !== "done" && (
          <div className={`tk-machine ${printer.stage}`} aria-hidden="true">
            <i className="tk-led" />
            <span className="tk-slot" />
          </div>
        )}
        <motion.div className="tk-paper" style={{ y: printer.y }}>
          {/* roughens the perforated edges so torn paper shows fibres instead of a vector-clean cut */}
          <svg
            width="0"
            height="0"
            style={{ position: "absolute" }}
            aria-hidden="true"
          >
            <filter id="tk-rough" x="-5%" y="-60%" width="110%" height="220%">
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.85 0.3"
                numOctaves="2"
                seed="7"
                result="noise"
              />
              <feDisplacementMap
                in="SourceGraphic"
                in2="noise"
                scale="5"
                xChannelSelector="R"
                yChannelSelector="G"
              />
            </filter>
          </svg>
          <div className="tk-bodywrap">
            {/* dark backing so the punched holes read as holes even while the stub swings up behind them */}
            <i className="tk-holeback" aria-hidden="true" />
            <section className="tk-body">
              <div className="tk-top">
                <span>Studio 09 presents</span>
                {ticket.star && <em>★ Cast</em>}
              </div>
              <h1>The Premiere</h1>
              <p className="tk-sub">Opening night · one night only</p>
              <div className="tk-name">
                <small>Admit one</small>
                <b>{ticket.name}</b>
              </div>
              <div className="tk-meta">
                <div>
                  <small>Date</small>
                  <b>07 Oct</b>
                </div>
                <div>
                  <small>Row</small>
                  <b>{rowOf(ticket.seat)}</b>
                </div>
                <div>
                  <small>Seat</small>
                  <b>{pad2(numOf(ticket.seat))}</b>
                </div>
              </div>
              {torn && (
                <div className="tk-stamp" aria-live="polite">
                  Admitted
                </div>
              )}
            </section>

            <span className="tk-fibre below" aria-hidden="true">
              <i />
            </span>
            {!torn && (
              <div
                className="tk-seam"
                ref={seamRef}
                role="slider"
                tabIndex={0}
                aria-label="Tear the ticket along the perforation"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={0}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" ||
                    e.key === " " ||
                    e.key === "ArrowRight"
                  ) {
                    e.preventDefault();
                    tearByKey();
                  }
                }}
                onPointerDown={onDown}
                onPointerMove={onMove}
                onPointerUp={onUp}
                onPointerCancel={onUp}
              >
                <motion.i
                  className={`tk-handle${hint ? " nudge" : ""}`}
                  style={{ left: handleLeft }}
                />
              </div>
            )}
          </div>

          <motion.div
            className="tk-stubwrap"
            style={{ rotate, y, opacity: dropOpacity, transformOrigin: hinge }}
            aria-hidden={torn}
          >
            <span className="tk-fibre above" aria-hidden="true">
              <i />
            </span>
            <section className="tk-stub">
              <StubInner ticket={ticket} />
            </section>
          </motion.div>
        </motion.div>
      </div>

      {printer.stage !== "done" ? null : torn ? (
        <div className="tk-after">
          <b>Enjoy the show, {ticket.name.split(" ")[0]}.</b>
          <span>
            Find row {rowOf(ticket.seat)}, seat {pad2(numOf(ticket.seat))}. Look
            up — the big screen just seated you.
          </span>
          <a className="tk-alt" href="/join">
            Join the show →
          </a>
        </div>
      ) : (
        <div className="tk-after">
          <b className={hint ? "pulse-hint" : undefined}>
            Usher: swipe along the dotted line →
          </b>
          <button
            type="button"
            className="tk-alt quiet"
            onClick={() => saveTicket(null)}
          >
            Not {ticket.name.split(" ")[0]}? Start over
          </button>
        </div>
      )}
    </div>
  );
}

function StubInner({ ticket }: { ticket: TicketData }) {
  const qr = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let dead = false;
    (async () => {
      const QRCodeStyling = (await import("qr-code-styling")).default;
      if (dead || !qr.current) return;
      const code = new QRCodeStyling({
        width: 92,
        height: 92,
        data: `${location.origin}/ticket#${ticket.seat}`,
        margin: 0,
        dotsOptions: { type: "rounded", color: "#120c0a" },
        backgroundOptions: { color: "transparent" },
      });
      qr.current.innerHTML = "";
      code.append(qr.current);
    })();
    return () => {
      dead = true;
    };
  }, [ticket.seat]);
  return (
    <>
      <div className="tk-stub-txt">
        <small>Usher&apos;s stub</small>
        <b>
          {rowOf(ticket.seat)}
          {pad2(numOf(ticket.seat))}
        </b>
        <span>No. {String(ticket.seat).padStart(3, "0")} · Studio 09</span>
      </div>
      <div className="tk-qr" ref={qr} />
    </>
  );
}
