"use client";

import Link from "next/link";
import { useChainPulse } from "@/lib/useChainPulse";
import { formatInt } from "@/lib/format";
import { cn } from "@/lib/cn";

/** Tiny live block readout for the nav. Links to the network page. */
export function LivePulse({ className }: { className?: string }) {
  const { status, latest } = useChainPulse();
  const live = status === "live";
  return (
    <Link
      href="/network"
      className={cn("items-center gap-2 rounded-full px-2 py-1 text-[13px] whitespace-nowrap text-hush transition-colors hover:text-mist", className)}
      title="Latest Robinhood Chain block"
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", live ? "animate-breathe bg-brass" : "bg-faint")} aria-hidden />
      <span className="tnum">{latest ? `Block ${formatInt(latest.number)}` : live ? "Live" : "Connecting to chain"}</span>
    </Link>
  );
}
