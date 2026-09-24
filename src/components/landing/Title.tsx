import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** A section heading: the newcomer's question, then the loud answer. Both are read out as one heading. */
export function Title({ id, q, className, children }: { id: string; q?: string; className?: string; children: ReactNode }) {
  return (
    <h2 id={id} className={cn("wide max-w-[20ch] text-[clamp(2.25rem,5.2vw,4.5rem)] leading-[0.95] font-black", className)}>
      {q && <span className="mb-5 block font-sans text-lg leading-snug font-medium tracking-normal text-hush sm:text-xl">{q}</span>}
      {children}
    </h2>
  );
}
