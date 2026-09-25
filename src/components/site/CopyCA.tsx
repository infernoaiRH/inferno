"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { site } from "@/lib/site";
import { shortAddress } from "@/lib/format";
import { cn } from "@/lib/cn";

/** Copies the $INFERNOAI contract address; shows it shortened, the full address on hover. */
export function CopyCA({ className }: { className?: string }) {
  const [copied, setCopied] = useState(false);
  const { symbol, address } = site.token;
  const copy = () =>
    navigator.clipboard.writeText(address).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      },
      () => {},
    );
  return (
    <button
      type="button"
      onClick={copy}
      title={address}
      aria-label={`Copy the ${symbol} contract address, ${address}`}
      className={cn(
        "inline-flex min-h-10 items-center gap-1.5 rounded-full border border-line-bright px-3 text-hush transition-colors hover:text-mist sm:min-h-8",
        className,
      )}
    >
      CA <span className="tnum font-mono text-mist">{shortAddress(address)}</span>
      {copied ? <Check size={13} className="text-mint" /> : <Copy size={13} />}
      <span aria-live="polite" className="sr-only">
        {copied ? "Copied" : ""}
      </span>
    </button>
  );
}
