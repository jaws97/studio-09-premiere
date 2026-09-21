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
import { numOf, rowOf } from "@/lib/show-core";
import { createStore } from "@/lib/store";

const HOLES = 22;
const COMMIT_AT = 0.6;

type TicketData = {
  id: string;
  name: string;
  seat: number;
  star: boolean;
  admittedAt?: number;
  /** the server has recorded the admission */
  synced?: boolean;
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

const pad2 = (n: number) => String(n).padStart(2, "0");

const post = (url: string, body: unknown) =>
  fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

/**
 * The tear is local-first: it always plays, and the admit call is retried
 * until the server has it, so bad venue Wi-Fi can delay the big screen but
 * never block the door.
 */
async function syncAdmit() {
  const t = ticketStore.get();
  if (!t?.admittedAt || t.synced) return;
  try {
    const res = await post("/api/admit", { id: t.id });
    // 404 = the show was reset since this ticket was printed; nothing left to sync
    if (res.ok || res.status === 404) saveTicket({ ...t, synced: true });
  } catch {}
}

export function TicketPage({ cast }: { cast: string[] }) {
  const ticket = ticketStore.use();
  useEffect(() => {
    void syncAdmit();
    const t = setInterval(syncAdmit, 4000);
    return () => clearInterval(t);
  }, []);
  if (ticket === undefined) return <main className="ticket-page" />;
  return (
    <main className="ticket-page">
      <header className="tp-head">
        <b>Studio 09</b>
        <span>Opening night · 7 October</span>
          <a className="tk-alt" href="/join">
            Join the show →
          </a>
      </header>
      {ticket ? (
        <Ticket ticket={ticket} />
      ) : (
        <BoxOffice cast={cast} />
      )}
    </main>
  );
}

function BoxOffice({ cast }: { cast: string[] }) {
  const [name, setName] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "failed">("idle");
  const ok = name.trim().length >= 2 && state !== "busy";

  const issue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ok) return;
    setState("busy");
    try {
      const res = await post("/api/ticket", { name });
      if (!res.ok) throw new Error(String(res.status));
      saveTicket((await res.json()) as TicketData);
    } catch {
      setState("failed");
    }
  };

  return (
    <form className="boxoffice" onSubmit={issue}>
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
        {state === "busy" ? "Printing…" : "Print my ticket"}
      </button>
      {state === "failed" && <p role="alert">The box office line is busy. Try once more.</p>}
    </form>
  );
}

function Ticket({ ticket }: { ticket: TicketData }) {
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
