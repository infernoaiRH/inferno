import { cn } from "@/lib/cn";

/**
 * Bittensor's τ, drawn as strokes because our fonts carry no Greek. It marks whatever runs on
 * Bittensor. Sized in em and coloured by `currentColor`, so it sits in text like a glyph.
 */
export function Tau({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={cn("h-[1em] w-[1em] shrink-0", className)}
    >
      <path d="M3.5 8.5Q4.5 6 7.5 6H20.5" />
      <path d="M12.5 6V16Q12.5 19.5 16 19.5H17.5" />
    </svg>
  );
}
