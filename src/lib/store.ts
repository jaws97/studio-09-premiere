"use client";

import { useSyncExternalStore } from "react";

type Setter<T> = (next: T) => void;

/**
 * Minimal external store for browser-only state (clock, localStorage,
 * BroadcastChannel). `start` runs when the first component subscribes and its
 * cleanup when the last one leaves. Server render and hydration see `initial`.
 */
export function createStore<T>(initial: T, start?: (set: Setter<T>, get: () => T) => void | (() => void)) {
  let value = initial;
  let stop: void | (() => void);
  const listeners = new Set<() => void>();

  const get = () => value;
  const set: Setter<T> = (next) => {
    if (Object.is(next, value)) return;
    value = next;
    listeners.forEach((l) => l());
  };
  const subscribe = (l: () => void) => {
    listeners.add(l);
    if (listeners.size === 1) stop = start?.(set, get);
    return () => {
      listeners.delete(l);
      if (listeners.size === 0) {
        stop?.();
        stop = undefined;
      }
    };
  };
  const use = () => useSyncExternalStore(subscribe, get, () => initial);

  return { get, set, subscribe, use };
}
