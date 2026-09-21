"use client";

import { useEffect, useRef, useState } from "react";

type Pt = [x: number, y: number];

/** Chasing marquee bulbs laid out around the perimeter of the parent `.frame`. */
export function Bulbs({ step = 26 }: { step?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pts, setPts] = useState<Pt[]>([]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const layout = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      const nx = Math.max(4, Math.round(w / step));
      const ny = Math.max(3, Math.round(h / step));
      const next: Pt[] = [];
      for (let i = 0; i < nx; i++) next.push([(i / nx) * w, 0]);
      for (let j = 0; j < ny; j++) next.push([w, (j / ny) * h]);
      for (let i = nx; i > 0; i--) next.push([(i / nx) * w, h]);
      for (let j = ny; j > 0; j--) next.push([0, (j / ny) * h]);
      setPts(next);
    };
    layout();
    const ro = new ResizeObserver(layout);
    ro.observe(el);
    return () => ro.disconnect();
  }, [step]);

  return (
    <div className="bulbs" ref={ref} aria-hidden="true">
      {pts.map(([x, y], i) => (
        <i
          key={i}
          className="bulb chase"
          style={{ left: x, top: y, animationDelay: `${(i % 3) * -220}ms` }}
        />
      ))}
    </div>
  );
}
