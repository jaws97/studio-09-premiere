"use client";

import {
  animate,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useTransform,
} from "motion/react";
import { useEffect, useRef, useState } from "react";
import { buzz, ripFinish, ripTick, unlockRip } from "@/lib/rip";
import { useShow } from "@/lib/show";
import { createStore } from "@/lib/store";

/** mirrors SEATS on /screen; kept local so this page never bundles the film titles */
const SEATS = 120;
const PER_ROW = 12;
const HOLES = 22;
const COMMIT_AT = 0.6;

type TicketData = {
  name: string;
  seat: number;
  star: boolean;
  admittedAt?: number;
};

const KEY = "studio09-ticket";
const ticketStore = createStore<TicketData | null | undefined>(
  undefined,
  (set) => {
    try {
      const raw = localStorage.getItem(KEY);
      set(raw ? (JSON.parse(raw) as TicketData) : null);
    } catch {
      set(null);
    }
  },
);
function saveTicket(t: TicketData | null) {
  ticketStore.set(t);
  try {
    if (t) localStorage.setItem(KEY, JSON.stringify(t));
    else localStorage.removeItem(KEY);
  } catch {}
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
const pad2 = (n: number) => String(n).padStart(2, "0");
const rowOf = (seat: number) =>
  String.fromCharCode(64 + Math.ceil(seat / PER_ROW));
const numOf = (seat: number) => ((seat - 1) % PER_ROW) + 1;

/** Stand-in until the guest list lives in the database: cast get their billing seat, everyone else a hashed one. */
function assignSeat(
  name: string,
  cast: string[],
): Pick<TicketData, "seat" | "star"> {
  const i = cast.findIndex((c) => norm(c) === norm(name));
  if (i >= 0) return { seat: i + 1, star: true };
  let h = 0;
  for (const ch of norm(name)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return { seat: cast.length + 1 + (h % (SEATS - cast.length)), star: false };
}

export function TicketPage({ cast }: { cast: string[] }) {
  const ticket = ticketStore.use();
  if (ticket === undefined) return <main className="ticket-page" />;
  return (
    <main className="ticket-page">
      <header className="tp-head">
        <b>Studio 09</b>
        <span>Opening night · 7 October</span>
      </header>
      {ticket ? (
        <Ticket ticket={ticket} />
      ) : (
        <BoxOffice
          cast={cast}
          onIssue={(name) => saveTicket({ name, ...assignSeat(name, cast) })}
        />
      )}
    </main>
  );
}

function BoxOffice({
  cast,
  onIssue,
}: {
  cast: string[];
  onIssue: (name: string) => void;
}) {
  const [name, setName] = useState("");
  const ok = name.trim().length >= 2;
  return (
    <form
      className="boxoffice"
      onSubmit={(e) => {
        e.preventDefault();
        if (ok) onIssue(name.trim().replace(/\s+/g, " "));
      }}
    >
      <h1>Box office</h1>
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
        Print my ticket
      </button>
    </form>
  );
}

function Ticket({ ticket }: { ticket: TicketData }) {
  const { dispatch } = useShow();
  const torn = ticket.admittedAt != null;
  const progress = useMotionValue(torn ? 1 : 0);
  const seamRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const lastHole = useRef(0);
  const [hint, setHint] = useState(true);

  // The stub hangs from the end that is still attached (the right).
  const stubRotate = useTransform(progress, [0, 1], [0, -9]);
  const stubY = useTransform(progress, [0, 1], [0, 10]);
  const tornWidth = useTransform(progress, (p) => `${p * 100}%`);
  const handleLeft = useTransform(progress, (p) => `${p * 100}%`);
  const gapGlow = useTransform(progress, [0, 0.15, 1], [0, 1, 1]);

  // Falling away after the tear completes.
  const dropY = useMotionValue(torn ? 900 : 0);
  const dropRotate = useMotionValue(torn ? -28 : 0);
  const dropOpacity = useMotionValue(torn ? 0 : 1);
  const rotate = useTransform(() => stubRotate.get() + dropRotate.get());
  const y = useTransform(() => stubY.get() + dropY.get());

  useMotionValueEvent(progress, "change", (p) => {
    if (!dragging.current) return;
    const hole = Math.floor(p * HOLES);
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
    dispatch({
      type: "seat",
      guest: { seat: ticket.seat, name: ticket.name, star: ticket.star },
    });
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

  const tearByButton = () => {
    unlockRip();
    dragging.current = true; // so the perforation ticks play
    animate(progress, 1, { duration: 0.7, ease: "easeInOut" }).then(() => {
      dragging.current = false;
      complete();
    });
  };

  return (
    <div className={`tk${ticket.star ? " cast" : ""}${torn ? " torn" : ""}`}>
      <div className="tk-paper">
        <div className="tk-bodywrap">
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

          {!torn && (
            <div
              className="tk-seam"
              ref={seamRef}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
            >
              <motion.i
                className="tk-gap"
                style={{ width: tornWidth, opacity: gapGlow }}
              />
              <motion.i className="tk-handle" style={{ left: handleLeft }} />
            </div>
          )}
        </div>

        <motion.section
          className="tk-stub"
          style={{ rotate, y, opacity: dropOpacity }}
          aria-hidden={torn}
        >
          <StubInner ticket={ticket} />
        </motion.section>
      </div>

      {torn ? (
        <div className="tk-after">
          <b>Enjoy the show, {ticket.name.split(" ")[0]}.</b>
          <span>
            Find row {rowOf(ticket.seat)}, seat {pad2(numOf(ticket.seat))}. Look
            up — the big screen just seated you.
          </span>
        </div>
      ) : (
        <div className="tk-after">
          <b className={hint ? "pulse-hint" : undefined}>
            Usher: swipe along the dotted line →
          </b>
          <button type="button" className="tk-alt" onClick={tearByButton}>
            Tear ticket
          </button>
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
