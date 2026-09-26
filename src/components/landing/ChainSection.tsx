"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { Title } from "@/components/landing/Title";
import { CHAIN, explorerBlock } from "@/lib/chain";
import { formatInt } from "@/lib/format";
import { cn } from "@/lib/cn";
import { onPulseBlock, pulseStats, useChainPulse, type PulseBlock } from "@/lib/useChainPulse";

const TAPE = 24;

export function ChainSection() {
  const { status, latest, recent, finalizedLagSec } = useChainPulse();
  const { blockTimeMs, txPerSec, baseFeeGwei } = pulseStats(recent);
  const live = status === "live";
  const rows: [string, ReactNode][] = [
    ["Latest block", latest ? <AnimatedNumber value={Number(latest.number)} format={formatInt} /> : "–"],
    ["Average block time", blockTimeMs ? `${Math.round(blockTimeMs)} ms` : "–"],
    ["Transactions per second", txPerSec ? formatInt(txPerSec) : "–"],
    ["Base fee", baseFeeGwei ? `${baseFeeGwei.toPrecision(3)} gwei` : "–"],
    ["Ethereum-final after", finalizedLagSec ? `about ${Math.round(finalizedLagSec / 60)} min` : "–"],
  ];

  return (
    <section id="chain" aria-labelledby="chain-title" className="mx-auto max-w-7xl px-5 py-24 sm:px-8 sm:py-32">
      <Title id="chain-title" q="Is this live?">
        Chat, mining and credits are. Sealed messages are next.
      </Title>
      <div className="mt-14 grid gap-x-16 gap-y-14 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <p className="max-w-[46ch] text-lg text-hush">
            Robinhood Chain seals a block about ten times a second and settles it to Ethereum. Every number here is read
            from it live.
          </p>
          <p className="mt-4 max-w-[46ch] text-lg text-hush">
            Inferno uses it for money only. You buy credits by sending USDG or $INFERNOAI, and lenders are paid in USDG
            for the tokens their GPUs write. Your prompts and replies never go on-chain; only the payments do.
          </p>
        </div>

        <div className="lg:col-span-7 lg:pt-2">
          <p className="flex items-center gap-2.5 text-[15px] text-hush">
            <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", live ? "animate-breathe bg-heat-5" : "bg-faint")} />
            {live ? `Live from ${CHAIN.name}` : "Listening for Robinhood Chain…"}
          </p>
          <dl className="mt-4 border-b border-line">
            {rows.map(([label, value]) => (
              <div key={label} className="flex items-baseline justify-between gap-6 border-t border-line py-4">
                <dt className="text-[15px] text-hush">{label}</dt>
                <dd className="tnum text-right text-2xl font-semibold text-mist sm:text-[1.75rem]">{value}</dd>
              </div>
            ))}
          </dl>
          <BlockTape />
        </div>
      </div>
    </section>
  );
}

/** Busier blocks burn hotter; the newest is white-hot. */
const heat = (share: number) => (share > 0.75 ? "bg-heat-4" : share > 0.45 ? "bg-heat-3" : "bg-heat-2");

/** The last blocks as thin bars, fed by the paced block stream so it ticks at the chain's own rhythm. */
function BlockTape() {
  const [tape, setTape] = useState<PulseBlock[]>([]);
  useEffect(() => onPulseBlock((b) => setTape((t) => [...t.slice(1 - TAPE), b])), []);
  const tallest = Math.max(1, ...tape.map((b) => b.txCount));

  return (
    <figure className="mt-10">
      <div className="flex h-20 items-end gap-[3px]">
        {tape.map((b, i) => (
          <a
            key={b.number.toString()}
            href={explorerBlock(b.number)}
            target="_blank"
            rel="noreferrer"
            aria-label={`Block ${formatInt(b.number)}, ${b.txCount} transactions`}
            title={`Block ${formatInt(b.number)}, ${b.txCount} transactions`}
            className="group flex h-full min-w-0 flex-1 items-end"
          >
            <span
              className={cn(
                "w-full rounded-t-[2px] group-hover:bg-mist",
                i === tape.length - 1 ? "bg-heat-5" : heat(b.txCount / tallest),
              )}
              style={{ height: `${Math.max(6, (b.txCount / tallest) * 100)}%` }}
            />
          </a>
        ))}
      </div>
      <figcaption className="mt-3 text-[13px] text-hush">
        The last {TAPE} blocks, newest on the right. Taller, hotter bars carried more transactions.
      </figcaption>
    </figure>
  );
}
