"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Tweens to a new value, optionally flashing mint/ember on change.
 * Tabular numerals keep a ticking value from reflowing the layout.
 * Copied from karan-personal/pumptef.
 */
export function AnimatedNumber({
  value,
  format,
  className = "",
  durationMs = 550,
  flash = false,
}: {
  value: number | undefined;
  format: (n: number | undefined) => string;
  className?: string;
  durationMs?: number;
  flash?: boolean;
}) {
  const [shown, setShown] = useState(value);
  const [flashClass, setFlashClass] = useState("");
  const prev = useRef(value);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const from = prev.current;
    prev.current = value;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (value === undefined || from === undefined || from === value || still) {
      setShown(value);
      return;
    }
    let t: ReturnType<typeof setTimeout> | undefined;
    if (flash) {
      setFlashClass(value > from ? "flash-up" : "flash-down");
      t = setTimeout(() => setFlashClass(""), 720);
    }
    const start = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / durationMs);
      const e = p === 1 ? 1 : 1 - Math.pow(2, -10 * p); // easeOutExpo
      setShown(from + (value - from) * e);
      if (p < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => {
      if (t) clearTimeout(t);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [value, durationMs, flash]);

  return <span className={`tnum ${flashClass} ${className}`}>{format(shown)}</span>;
}
