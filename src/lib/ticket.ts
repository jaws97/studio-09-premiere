"use client";

import { useEffect } from "react";
import { createStore } from "./store";

/**
 * The guest's ticket, kept on their phone so the tear works offline and the
 * page survives a refresh. The server stays the authority on whether the
 * ticket still exists: a "Reset show" on /host voids every ticket, and phones
 * find out the next time they check in.
 */
export type TicketData = {
  id: string;
  name: string;
  seat: number;
  star: boolean;
  admittedAt?: number;
  /** the server has recorded the admission */
  synced?: boolean;
};

const KEY = "studio09-ticket";

export const ticketStore = createStore<TicketData | null | undefined>(undefined, (set) => {
  try {
    const raw = localStorage.getItem(KEY);
    set(raw ? (JSON.parse(raw) as TicketData) : null);
  } catch {
    set(null);
  }
});

export function saveTicket(t: TicketData | null) {
  ticketStore.set(t);
  try {
    if (t) localStorage.setItem(KEY, JSON.stringify(t));
    else localStorage.removeItem(KEY);
  } catch {}
}

export const post = (url: string, body: unknown) =>
  fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

/**
 * The tear is local-first: it always plays, and the admit call is retried
 * until the server has it, so bad venue Wi-Fi can delay the big screen but
 * never block the door.
 */
export async function syncAdmit() {
  const t = ticketStore.get();
  if (!t?.admittedAt || t.synced) return;
  try {
    const res = await post("/api/admit", { id: t.id });
    if (res.ok) saveTicket({ ...t, synced: true });
    else if (res.status === 404) saveTicket(null); // the show was reset: this ticket is void
  } catch {}
}

/** Drop the local ticket if the server no longer knows it. Network errors leave it alone. */
async function checkTicket() {
  const t = ticketStore.get();
  if (!t) return;
  try {
    const res = await fetch(`/api/ticket/${encodeURIComponent(t.id)}`, { cache: "no-store" });
    if (res.status === 404 && ticketStore.get()?.id === t.id) saveTicket(null);
  } catch {}
}

/**
 * Checks the ticket with the server ONCE, when the page opens — no polling.
 * A guest whose ticket was voided by a reset sees the box office the next time
 * they open or refresh the page.
 *
 * The only repeating work is the admit retry, and that is not a poll: it makes
 * a request only while a torn ticket is still waiting to reach the server,
 * then goes quiet for good.
 */
export function useTicket() {
  const ticket = ticketStore.use();
  useEffect(() => {
    void checkTicket();
    void syncAdmit();
    const retry = setInterval(syncAdmit, 4000);
    return () => clearInterval(retry);
  }, []);
  return ticket;
}
