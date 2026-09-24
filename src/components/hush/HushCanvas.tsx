"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import { onPulseBlock, useChainPulse, type PulseBlock } from "@/lib/useChainPulse";

/*
 * The Hush: a five-line staff plucked by live Robinhood Chain blocks, drawn in the Thermal ramp.
 * Each block enters at the white-hot playhead on the right and drifts left, cooling from yellow through orange and
 * red to magenta as it ages; its height is set by the block's transaction count. Fresh plucks ring, then settle and
 * spread. The pointer quiets the strings near it.
 */

const STRINGS = 5;
const STRING_GAIN = [0.7, 0.9, 1, 0.9, 0.7];
const STEP = 2; // px between samples along a string
const SPEED = 80; // px per second the score drifts left
const WIDTH = 4; // px, gaussian sigma of a fresh pluck
const SPREAD = 1.1; // px per second a pluck widens as it ages
const RING = 2 * Math.PI * 1.6; // rad per second a fresh pluck vibrates
const RING_SEC = 0.8; // how long the vibration lasts
const REST = 0.5; // share of a pluck that stays once it stops ringing
const MAX = 512; // plucks kept: ~40 s of blocks, wider than any screen at SPEED
const HUSH_SIGMA = 90; // px; the pointer quiets strings within ~180 px (2 sigma)
const HUSH_EASE_SEC = 0.18;

const hash = (k: number) => {
  const r = Math.sin(k * 12.9898) * 43758.5453;
  return r - Math.floor(r);
};

export function HushCanvas({ className, variant = "hero" }: { className?: string; variant?: "hero" | "band" }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const live = useChainPulse().status === "live";
  const liveRef = useRef(live);
  const redrawRef = useRef(() => {});

  useEffect(() => {
    liveRef.current = live;
    redrawRef.current();
  }, [live]);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!wrap || !canvas || !ctx) return;

    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const root = getComputedStyle(document.documentElement);
    const [cold, warm, hot, white, mist] = ["--color-heat-2", "--color-heat-3", "--color-heat-4", "--color-heat-5", "--color-mist"].map(
      (v) => root.getPropertyValue(v).trim(),
    );

    // Plucks, oldest first, in a ring buffer of typed arrays: the frame loop allocates nothing.
    const born = new Float64Array(MAX);
    const height = new Float32Array(MAX * STRINGS); // signed, per string, 0..1
    let written = 0;
    let count = 0;
    let peak = 8; // rolling max tx count, half-life ~3 s so one spike doesn't flatten the rest
    const gain = new Float32Array(STRINGS);
    const beadY = new Float32Array(STRINGS);

    // Geometry, rebuilt on resize.
    let w = 0;
    let h = 0;
    let n = 0;
    let gap = 0;
    let top = 0;
    let xNow = 0;
    let ampPx = 0;
    let limit = 0;
    let disp = new Float32Array(0);
    let ink: CanvasGradient | null = null; // cold magenta for the past, heating to yellow at the playhead, mist ahead
    let fade: CanvasGradient | null = null; // alpha mask for both ends of the staff

    let pointerX = 0;
    let pointerY = 0;
    let hushTarget = 0;
    let hush = 0;
    let last = 0;
    let raf = 0;
    let onScreen = true;

    const draw = (now: number) => {
      if (!w || !ink || !fade) return;
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
      last = now;
      hush += (hushTarget - hush) * (reduce ? 1 : 1 - Math.exp(-dt / HUSH_EASE_SEC));
      const live = liveRef.current;

      // Drop plucks that have drifted off the left edge (always the oldest).
      while (count) {
        const age = (now - born[(written - count) % MAX]) / 1000;
        if (xNow - age * SPEED + 3 * (WIDTH + age * SPREAD) > 0) break;
        count--;
      }

      disp.fill(0);
      for (let k = count; k > 0; k--) {
        const slot = (written - k) % MAX;
        const age = Math.max(0, (now - born[slot]) / 1000);
        const x = xNow - age * SPEED;
        const sigma = WIDTH + age * SPREAD;
        const size = Math.sqrt(WIDTH / sigma); // a spreading pluck loses height
        const ring = reduce ? 0 : (1 - REST) * Math.exp(-age / RING_SEC);
        for (let s = 0; s < STRINGS; s++) {
          const vibrate = ring > 0.01 ? REST + ring * Math.cos(RING * age + s * 0.35) : REST;
          gain[s] = height[slot * STRINGS + s] * size * vibrate;
        }
        const i0 = Math.max(0, Math.ceil((x - 3 * sigma) / STEP));
        const i1 = Math.min(n - 1, Math.floor((x + 3 * sigma) / STEP));
        for (let i = i0; i <= i1; i++) {
          const u = (i * STEP - x) / sigma;
          const g = Math.exp(-0.5 * u * u);
          for (let s = 0; s < STRINGS; s++) disp[s * n + i] += gain[s] * g;
        }
      }

      ctx.clearRect(0, 0, w, h);
      const hs2 = 2 * HUSH_SIGMA * HUSH_SIGMA;
      const iNow = xNow / STEP;
      ctx.globalAlpha = 0.9;
      ctx.lineWidth = variant === "hero" ? 1.8 : 1.4;
      ctx.lineJoin = "round";
      ctx.strokeStyle = ink;
      for (let s = 0; s < STRINGS; s++) {
        const y0 = top + s * gap;
        const dy = y0 - pointerY;
        const rowHush = hush * Math.exp(-(dy * dy) / hs2);
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
          const x = i * STEP;
          let d = disp[s * n + i] * ampPx;
          if (!live) d += 1.2 * Math.sin(x * 0.012 + now * 0.0007 + s * 0.9); // breathing while we wait
          d = limit * Math.tanh(d / limit);
          if (rowHush > 0.003) {
            const dx = x - pointerX;
            if (dx * dx < 4.5 * hs2) d *= 1 - rowHush * Math.exp(-(dx * dx) / hs2);
          }
          if (i === iNow) beadY[s] = y0 + d;
          if (i) ctx.lineTo(x, y0 + d);
          else ctx.moveTo(x, y0 + d);
        }
        ctx.stroke();
      }

      // Fade the far past in from the left and dim the empty future right of the playhead.
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = fade;
      ctx.fillRect(0, top - limit - 4, w, 4 * gap + 2 * limit + 8);
      ctx.globalCompositeOperation = "source-over";

      // The playhead, and five white-hot beads riding the strings where the newest block lands.
      const newest = (written - 1) % MAX;
      const fresh = count && live ? Math.abs(height[newest * STRINGS + 2]) * Math.exp(-(now - born[newest]) / 300) : 0;
      const hx = xNow - pointerX;
      const hy = top + 2 * gap - pointerY;
      const quiet = 1 - hush * Math.exp(-(hx * hx + hy * hy) / hs2);
      ctx.strokeStyle = white;
      ctx.fillStyle = white;
      ctx.shadowColor = hot;
      ctx.shadowBlur = (8 + 22 * fresh) * quiet;
      ctx.globalAlpha = live ? 0.6 : 0.25;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(xNow + 0.5, top - gap);
      ctx.lineTo(xNow + 0.5, top + 5 * gap);
      ctx.stroke();
      if (live) {
        ctx.globalAlpha = 0.95;
        ctx.beginPath();
        for (let s = 0; s < STRINGS; s++) {
          ctx.moveTo(xNow + 2.5, beadY[s]);
          ctx.arc(xNow, beadY[s], 2.5, 0, 2 * Math.PI);
        }
        ctx.fill();
      }
      ctx.shadowBlur = 0;
    };

    const loop = (now: number) => {
      draw(now);
      raf = requestAnimationFrame(loop);
    };
    // Reduced motion: no loop, one frame per event.
    const redraw = () => {
      if (!raf)
        raf = requestAnimationFrame((now) => {
          raf = 0;
          draw(now);
        });
    };
    // Browsers already stop rAF in hidden tabs; this covers scrolling offscreen.
    const play = () => {
      if (!raf && !reduce && onScreen) raf = requestAnimationFrame(loop);
    };
    const pause = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };
    redrawRef.current = () => reduce && redraw();

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = wrap.clientWidth;
      h = wrap.clientHeight;
      if (!w || !h) return;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      n = Math.ceil(w / STEP) + 1;
      disp = new Float32Array(n * STRINGS);
      gap = Math.max(12, Math.min(22, Math.round(h * 0.085)));
      top = Math.round(h / 2) - 2 * gap;
      ampPx = gap * 2;
      limit = gap * 2.4;
      xNow = Math.round((w - Math.max(28, Math.min(120, w * 0.07))) / STEP) * STEP;
      ink = ctx.createLinearGradient(0, 0, w, 0);
      ink.addColorStop(0, cold);
      ink.addColorStop((xNow - Math.min(460, 0.6 * xNow)) / w, cold);
      ink.addColorStop((xNow - Math.min(220, 0.32 * xNow)) / w, warm);
      ink.addColorStop((xNow - Math.min(80, 0.12 * xNow)) / w, hot);
      ink.addColorStop(xNow / w, white);
      ink.addColorStop((xNow + 2) / w, mist);
      ink.addColorStop(1, mist);
      fade = ctx.createLinearGradient(0, 0, w, 0);
      fade.addColorStop(0, "black");
      fade.addColorStop((0.28 * xNow) / w, "transparent");
      fade.addColorStop((xNow + 2) / w, "transparent");
      fade.addColorStop((xNow + 24) / w, "rgb(0 0 0 / 0.6)");
      fade.addColorStop(1, "rgb(0 0 0 / 0.7)");
      wrap.style.setProperty("--staff-top", `${top}px`);
      wrap.style.setProperty("--staff-right", `${w - xNow}px`);
      if (reduce) redraw();
    };

    const onBlock = (b: PulseBlock) => {
      const slot = written++ % MAX;
      count = Math.min(count + 1, MAX);
      born[slot] = performance.now();
      peak = Math.max(8, b.txCount, peak * 0.98);
      const seed = Number(b.number % 65_521n);
      const pluck = (b.txCount / peak) * (hash(seed) < 0.5 ? -1 : 1);
      for (let s = 0; s < STRINGS; s++) height[slot * STRINGS + s] = pluck * STRING_GAIN[s] * (0.75 + 0.25 * hash(seed + s * 7.7));
      if (reduce && performance.now() - last >= 1000) redraw();
    };

    const point = (e: PointerEvent) => {
      if (!onScreen) return;
      const r = canvas.getBoundingClientRect();
      pointerX = e.clientX - r.left;
      pointerY = e.clientY - r.top;
      hushTarget = 1;
      if (reduce) redraw();
    };
    const release = () => {
      hushTarget = 0;
      if (reduce) redraw();
    };
    const lift = (e: PointerEvent) => e.pointerType !== "mouse" && release();
    const out = (e: PointerEvent) => !e.relatedTarget && release();

    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    const io = new IntersectionObserver(([e]) => {
      onScreen = e.isIntersecting;
      if (onScreen) play();
      else pause();
    });
    io.observe(wrap);
    const unsubscribe = onPulseBlock(onBlock);
    window.addEventListener("pointermove", point, { passive: true });
    window.addEventListener("pointerdown", point, { passive: true });
    window.addEventListener("pointerup", lift);
    window.addEventListener("pointercancel", lift);
    window.addEventListener("pointerout", out);

    return () => {
      unsubscribe();
      ro.disconnect();
      io.disconnect();
      pause();
      redrawRef.current = () => {};
      window.removeEventListener("pointermove", point);
      window.removeEventListener("pointerdown", point);
      window.removeEventListener("pointerup", lift);
      window.removeEventListener("pointercancel", lift);
      window.removeEventListener("pointerout", out);
    };
  }, [variant]);

  return (
    <div
      ref={wrapRef}
      className={cn(variant === "hero" ? "absolute inset-0" : "relative h-44 sm:h-56", "pointer-events-none", className)}
    >
      <canvas ref={canvasRef} aria-hidden className="absolute inset-0 h-full w-full" />
      {!live && (
        <p className="absolute top-[calc(var(--staff-top,40%)_-_2.75rem)] right-[var(--staff-right,2rem)] font-display text-[15px] text-hush italic">
          Listening for Robinhood Chain…
        </p>
      )}
    </div>
  );
}
