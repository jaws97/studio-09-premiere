"use client";

import { initialShow, type HostAction, type ShowState } from "./show-core";
import { createStore } from "./store";

export * from "./show-core";

/**
 * Client view of the show. Only /screen, /host and /join subscribe, and they
 * poll — a few tiny requests a second that survive flaky venue Wi-Fi far
 * better than a socket, and leave realtime connection limits untouched.
 */
const POLL_MS = 450;

const store = createStore<{ state: ShowState; ready: boolean; online: boolean }>(
  { state: initialShow, ready: false, online: true },
  (set, get) => {
    let dead = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const res = await fetch(`/api/show?rev=${get().ready ? get().state.rev : -1}`, { cache: "no-store" });
        const body = (await res.json()) as ShowState | { rev: number };
        if (dead) return;
        if ("phase" in body) set({ state: body, ready: true, online: true });
        else if (!get().online) set({ ...get(), online: true });
      } catch {
        if (!dead && get().online) set({ ...get(), online: false });
      }
      if (!dead) timer = setTimeout(tick, document.hidden ? POLL_MS * 4 : POLL_MS);
    };
    void tick();
    return () => {
      dead = true;
      clearTimeout(timer);
    };
  },
);

/** Host-only; the server rejects it without the PIN cookie. */
export async function dispatch(action: HostAction) {
  try {
    const res = await fetch("/api/show/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(action),
    });
    if (res.ok) store.set({ state: (await res.json()) as ShowState, ready: true, online: true });
    return res.ok;
  } catch {
    return false;
  }
}

export function useShow() {
  return { ...store.use(), dispatch };
}
