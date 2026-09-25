import { useId } from "react";
import { cn } from "@/lib/cn";
import { site } from "@/lib/site";
import { TAU_PATHS } from "./Tau";

/**
 * The Inferno mark: the τ glowing on a sealed chip die, as in the Bittensor section's chip art.
 * src/app/icon.png, src/app/apple-icon.png and src/app/opengraph-image.tsx repeat it in hex,
 * since icon files and the share image can't read CSS variables.
 */
export function LogoMark({ className }: { className?: string }) {
  const id = useId();
  const heat = `${id}-heat`;
  const glow = `${id}-glow`;
  const tau = TAU_PATHS.map((d) => <path key={d} d={d} />);
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={className}>
      <defs>
        <radialGradient id={heat}>
          <stop offset="0" stopColor="var(--color-heat-2)" stopOpacity="0.6" />
          <stop offset="0.7" stopColor="var(--color-heat-2)" stopOpacity="0" />
        </radialGradient>
        <filter id={glow} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.1" />
        </filter>
      </defs>
      <rect x="1" y="1" width="30" height="30" rx="5" fill="var(--color-night)" />
      <rect x="1" y="1" width="30" height="30" rx="5" fill={`url(#${heat})`} />
      {/* 27 dashes fit the border's 107.65-unit perimeter exactly, so there's no seam. */}
      <rect
        x="1.6"
        y="1.6"
        width="28.8"
        height="28.8"
        rx="4.4"
        fill="none"
        stroke="var(--color-heat-3)"
        strokeOpacity="0.75"
        strokeWidth="1.2"
        strokeDasharray="2.3 1.687"
      />
      <g
        transform="translate(16 16) scale(1.05) translate(-12 -12.75)"
        fill="none"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <g stroke="var(--color-heat-3)" opacity="0.85" filter={`url(#${glow})`}>
          {tau}
        </g>
        <g stroke="var(--color-heat-4)">{tau}</g>
      </g>
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark className="h-10 w-10" />
      <span className="wide font-display text-[1.35rem] leading-none font-extrabold tracking-tight">{site.wordmark}</span>
    </span>
  );
}
