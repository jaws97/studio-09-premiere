"use client";

import { useEffect, useRef, useState } from "react";
import { buzz } from "@/lib/rip";
import { createStore } from "@/lib/store";

/**
 * The guest's second screen. Deliberately does NOT subscribe to the show:
 * a hundred phones polling would be the heaviest thing in the building.
 * Phones only ever send.
 */
const guestName = createStore<string | null | undefined>(undefined, (set) => {
  try {
    const raw = localStorage.getItem("studio09-ticket");
    set(raw ? ((JSON.parse(raw) as { name?: string }).name ?? null) : null);
  } catch {
    set(null);
  }
});

export function Join() {
  const name = guestName.use();
  if (name === undefined) return <main className="join" />;
  if (name === null)
    return (
      <main className="join">
        <header>
          <b>Studio 09</b>
          <span>You&apos;ll need a ticket first</span>
        </header>
        <a className="j-btn" href="/ticket">
          To the box office →
        </a>
      </main>
    );
  return (
    <main className="join">
      <header>
        <b>Studio 09</b>
        <span>{name} · in the house</span>
      </header>
      <Bravo />
      <Wish name={name} />
      <Paparazzi name={name} />
    </main>
  );
}

/* ------------------------------------------------------------------ bravo */

function Bravo() {
  const [mine, setMine] = useState(0);
  const pending = useRef(0);

  // Batch taps: one small POST a second however fast the thumbs go.
  useEffect(() => {
    const t = setInterval(() => {
      const n = pending.current;
      if (!n) return;
      pending.current = 0;
      fetch("/api/clap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ n }),
        keepalive: true,
      }).catch(() => {
        pending.current += n; // offline: try again with the next batch
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const clap = async (ev: React.PointerEvent<HTMLButtonElement>) => {
    pending.current = Math.min(pending.current + 1, 60);
    setMine((m) => m + 1);
    buzz(12);
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = ev.currentTarget.getBoundingClientRect();
    const confetti = (await import("canvas-confetti")).default;
    confetti({
      particleCount: 10,
      spread: 60,
      startVelocity: 26,
      ticks: 70,
      scalar: 0.8,
      colors: ["#f4d27a", "#f3e7cf", "#e2b544"],
      origin: { x: (r.left + r.width / 2) / innerWidth, y: (r.top + r.height / 3) / innerHeight },
    });
  };

  return (
    <section className="j-card bravo">
      <h2>Curtain call</h2>
      <button type="button" className="bravo-btn" onPointerDown={clap}>
        Bravo!
      </button>
      <p>
        {mine
          ? `${mine.toLocaleString("en-IN")} from you. Watch the needle on the big screen.`
          : "Tap like you mean it. The big screen is listening."}
      </p>
    </section>
  );
}

/* ------------------------------------------------------------------- wish */

function Wish({ name }: { name: string }) {
  const [text, setText] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "sent" | "failed">("idle");

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim().length < 2) return;
    setState("busy");
    const res = await fetch("/api/message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, text }),
    }).catch(() => null);
    if (res?.ok) {
      setText("");
      setState("sent");
    } else setState("failed");
  };

  return (
    <form className="j-card" onSubmit={send}>
      <h2>A line in the credits</h2>
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setState("idle");
        }}
        maxLength={80}
        rows={2}
        placeholder="A wish for tonight's cast…"
      />
      <div className="j-row">
        <small>{80 - text.length} left</small>
        <button type="submit" className="j-btn" disabled={text.trim().length < 2 || state === "busy"}>
          {state === "busy" ? "Sending…" : "Send to the credits"}
        </button>
      </div>
      {state === "sent" && <p className="ok">Sent. It rolls in the end credits once the host approves it.</p>}
      {state === "failed" && <p className="bad">Didn&apos;t go through. Try again?</p>}
    </form>
  );
}

/* -------------------------------------------------------------- paparazzi */

/** Shrink on the phone: venue uplinks are slow and the wall only needs ~1280px. */
async function compress(file: File): Promise<Blob> {
  const img = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  img.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/jpeg", 0.82),
  );
}

function Paparazzi({ name }: { name: string }) {
  const [state, setState] = useState<"idle" | "busy" | "sent" | "failed">("idle");
  const input = useRef<HTMLInputElement>(null);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setState("busy");
    try {
      const form = new FormData();
      form.set("name", name);
      form.set("photo", await compress(file), "photo.jpg");
      const res = await fetch("/api/photo", { method: "POST", body: form });
      setState(res.ok ? "sent" : "failed");
    } catch {
      setState("failed");
    }
  };

  return (
    <section className="j-card">
      <h2>Paparazzi wall</h2>
      <p>Strike a pose. Approved snaps get pinned up on the big screen.</p>
      <input ref={input} type="file" accept="image/*" capture="user" hidden onChange={onPick} />
      <button type="button" className="j-btn" disabled={state === "busy"} onClick={() => input.current?.click()}>
        {state === "busy" ? "Developing…" : state === "sent" ? "Take another" : "Take a photo"}
      </button>
      {state === "sent" && <p className="ok">Got it. Off to the host for a quick look.</p>}
      {state === "failed" && <p className="bad">That one didn&apos;t develop. Try again?</p>}
    </section>
  );
}
