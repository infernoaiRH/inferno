import type { ComponentProps, CSSProperties } from "react";
import { cn } from "@/lib/cn";
import styles from "./Heat.module.css";

/** One streamed piece of an answer, with the writing speed when it landed. */
export type Chunk = { text: string; tps: number };

/** 0 is cold, 1 is white hot from 80 tokens/s. The square root lets slower GPUs still glow. */
const heatOf = (tps: number) => Math.min(1, Math.sqrt(Math.max(0, tps) / 80));

/**
 * The answer while it streams: plain text, one span per chunk, each cooling on its own CSS
 * animation. Nothing re-renders per frame; the saved answer then renders as Markdown.
 */
export function Trace({ chunks }: { chunks: Chunk[] }) {
  return (
    <p className="text-[16.5px] leading-[1.75] break-words whitespace-pre-wrap text-mist/90">
      {chunks.map((c, i) => (
        <span key={i} className={styles.chunk} style={{ "--heat": heatOf(c.tps) } as CSSProperties}>
          {c.text}
        </span>
      ))}
    </p>
  );
}

/** Fills along the heat ramp, so the tip's colour shows how hot the value runs. */
export function HeatBar({ value, className, ...props }: { value: number } & ComponentProps<"div">) {
  return (
    <div className={cn("h-1.5 overflow-hidden rounded-full bg-night-3", className)} {...props}>
      <div
        className="heat-fill h-full transition-[clip-path] duration-500 ease-quiet"
        style={{ clipPath: `inset(0 ${(1 - value) * 100}% 0 0 round 9999px)` }}
      />
    </div>
  );
}

/**
 * Shown while an answer is written: the bar and the number follow the current tokens/s. `ahead` is
 * how many questions a lender's GPU will answer before this one.
 */
export function HeatMeter({ tps, ahead = 0 }: { tps: number; ahead?: number }) {
  return (
    <div className="flex w-full min-w-0 items-center gap-3">
      <span className="shrink-0 text-faint">Speed</span>
      <HeatBar value={heatOf(tps)} aria-hidden className="min-w-0 flex-1" />
      <span className="tnum shrink-0 text-hush">
        {tps > 0
          ? `${tps.toFixed(1)} tokens/s`
          : ahead > 0
            ? `Waiting behind ${ahead} ${ahead === 1 ? "other" : "others"}`
            : "Reading your message"}
      </span>
    </div>
  );
}
