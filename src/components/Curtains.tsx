"use client";

import { useEffect, useState } from "react";

/**
 * Velvet curtains. `open` drives them; when `autoOpenAfter` is set they open
 * on their own (lobby page) and unmount once off-screen.
 */
export function Curtains({
  open,
  autoOpenAfter,
  fixed = false,
}: {
  open?: boolean;
  autoOpenAfter?: number;
  fixed?: boolean;
}) {
  const [auto, setAuto] = useState(false);
  const [gone, setGone] = useState(false);
  const isOpen = open ?? auto;

  useEffect(() => {
    if (autoOpenAfter == null) return;
    const t = setTimeout(() => setAuto(true), autoOpenAfter);
    return () => clearTimeout(t);
  }, [autoOpenAfter]);

  useEffect(() => {
    if (autoOpenAfter == null || !isOpen) return;
    const t = setTimeout(() => setGone(true), 1800);
    return () => clearTimeout(t);
  }, [autoOpenAfter, isOpen]);

  if (gone) return null;
  const cls = `curtain${fixed ? " fixed" : ""}${isOpen ? " go" : ""}`;
  return (
    <>
      <div className={`${cls} l`} aria-hidden="true" />
      <div className={`${cls} r`} aria-hidden="true" />
    </>
  );
}
