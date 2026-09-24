import { useId } from "react";
import Image from "next/image";
import { cn } from "@/lib/cn";
import { site } from "@/lib/site";

/**
 * Original fire-breathing dragon: a cold violet body, breath that runs hot along the inferno ramp.
 * Heat means compute, so the fire is the work being done. Set NEXT_PUBLIC_LOGO_SRC to swap in
 * licensed artwork (see README, "Logo").
 */
export function LogoMark({ className }: { className?: string }) {
  const id = useId();
  if (site.logoSrc) {
    return <Image src={site.logoSrc} alt="" width={64} height={64} className={cn("object-contain", className)} />;
  }
  const body = `${id}-body`;
  const fire = `${id}-fire`;
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden className={className}>
      <defs>
        <linearGradient id={body} x1="3" y1="31" x2="16" y2="8" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--color-heat-1)" />
          <stop offset="0.5" stopColor="var(--color-heat-2)" />
          <stop offset="1" stopColor="var(--color-heat-3)" />
        </linearGradient>
        <linearGradient id={fire} x1="18" y1="20" x2="31.5" y2="17" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--color-heat-3)" />
          <stop offset="0.45" stopColor="var(--color-heat-4)" />
          <stop offset="1" stopColor="var(--color-heat-5)" />
        </linearGradient>
      </defs>
      {/* Breath first, so the jaws sit over its base. */}
      <path
        d="M18.6 19.3 C21.8 17.9 25 16.2 28.6 13.6 Q27.3 16.3 31 16.6 Q28.2 18.5 31.6 20.6 Q28.1 21.4 29.8 24.8 C26.2 22.6 22.4 20.7 18.6 19.3 Z"
        fill={`url(#${fire})`}
      />
      <path
        d="M2.6 31 L3.3 26.1 L1.1 24.4 L4.2 23.3 L2.5 20.3 L5.3 19.7 L3.9 16.2 L6.7 16.3 L2.1 7 L9.7 12.5 L12.5 11.7 L15.6 12.3 L17.4 10.9 L18.3 12.9 L24.7 14.3 L26.5 15.7 L25.3 16.9 L22.8 17 L22.2 18.3 L21.6 17.1 L17.3 17.9 L23.7 20.3 L22.4 21.7 L16.8 22.6 L12.8 23.4 L10.9 26.2 L10.3 31 Z"
        fill={`url(#${body})`}
        stroke="var(--color-heat-2)"
        strokeWidth="0.5"
        strokeLinejoin="round"
      />
      <path d="M14.4 15 Q15.9 13.7 17.4 14.2 Q16 15.4 14.4 15 Z" fill="var(--color-heat-5)" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark className="h-8 w-8" />
      <span className="wide font-display text-[1.35rem] leading-none font-extrabold tracking-tight">{site.wordmark}</span>
    </span>
  );
}
