import { cn } from "@/lib/cn";

/** A safety number as Signal sets it: 12 groups of 5 digits, three rows of four. */
export function SafetyNumber({ value, className }: { value: string; className?: string }) {
  return (
    <p className={cn("sharp grid max-w-xs grid-cols-4 gap-x-4 gap-y-1 font-display text-sm tnum sm:text-xl", className)}>
      {value.split(" ").map((group, i) => (
        <span key={i}>{group}</span>
      ))}
    </p>
  );
}
