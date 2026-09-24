"use client";

import { useEffect, useState, type ReactNode } from "react";
import { erc20Abi, formatUnits, parseAbi } from "viem";
import { CHAINLINK_ETH_USD, USDG, explorerBlock, publicClient } from "@/lib/chain";
import { formatCompact, formatInt, formatUsd } from "@/lib/format";
import { cn } from "@/lib/cn";
import { pulseStats, useChainPulse } from "@/lib/useChainPulse";

const aggregatorAbi = parseAbi([
  "function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
  "function decimals() view returns (uint8)",
]);

const gwei = (wei: bigint | null) => (wei == null ? "–" : (Number(wei) / 1e9).toPrecision(3));

export function ConnectionStatus({ className }: { className?: string }) {
  const { status } = useChainPulse();
  return (
    <p className={cn("flex items-center gap-2.5 text-hush", className)}>
      <span aria-hidden className={cn("h-2 w-2 rounded-full", status === "live" ? "animate-breathe bg-brass" : "bg-faint")} />
      {status === "live"
        ? "Live. Reading new blocks about once a second."
        : status === "connecting"
          ? "Connecting to Robinhood Chain…"
          : "Lost the connection. Retrying…"}
    </p>
  );
}

type Feeds = { ethUsd?: number; ethAt?: number; ethStale?: boolean; usdg?: number };

/** Chainlink ETH/USD and USDG supply, read every 30 s. Mainnet only: on testnet both addresses are null. */
function useFeeds(): Feeds {
  const [feeds, setFeeds] = useState<Feeds>({});
  useEffect(() => {
    if (!CHAINLINK_ETH_USD && !USDG) return;
    let alive = true;
    const read = async () => {
      try {
        const [round, decimals, supply] = await Promise.all([
          CHAINLINK_ETH_USD &&
            publicClient.readContract({ address: CHAINLINK_ETH_USD, abi: aggregatorAbi, functionName: "latestRoundData" }),
          CHAINLINK_ETH_USD &&
            publicClient.readContract({ address: CHAINLINK_ETH_USD, abi: aggregatorAbi, functionName: "decimals" }),
          USDG && publicClient.readContract({ address: USDG.address, abi: erc20Abi, functionName: "totalSupply" }),
        ]);
        if (!alive) return;
        const at = round ? Number(round[3]) : undefined;
        setFeeds({
          ethUsd: round && decimals != null ? Number(formatUnits(round[1], decimals)) : undefined,
          ethAt: at,
          ethStale: at != null && Date.now() / 1000 - at > 26 * 3600,
          usdg: supply != null && USDG ? Number(formatUnits(supply, USDG.decimals)) : undefined,
        });
      } catch {
        // Keep the last good reading; the next try is 30 s away.
      }
    };
    void read();
    const id = setInterval(read, 30_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);
  return feeds;
}

export function NetworkStats() {
  const { latest, recent, finalizedLagSec } = useChainPulse();
  const { blockTimeMs, txPerSec, baseFeeGwei } = pulseStats(recent.slice(-60));
  const { ethUsd, ethAt, ethStale, usdg } = useFeeds();
  const asOf = ethAt ? new Date(ethAt * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : null;

  const rows: { label: string; note?: string; value: ReactNode }[] = [
    {
      label: "Latest block",
      value: latest ? (
        <a href={explorerBlock(latest.number)} target="_blank" rel="noreferrer" className="hover:text-moon">
          {formatInt(latest.number)}
        </a>
      ) : (
        "–"
      ),
    },
    { label: "Average block time", note: "Last 60 blocks", value: blockTimeMs ? `${Math.round(blockTimeMs)} ms` : "–" },
    { label: "Transactions per second", value: txPerSec ? formatInt(txPerSec) : "–" },
    { label: "Base fee", value: baseFeeGwei ? `${baseFeeGwei.toPrecision(3)} gwei` : "–" },
    {
      label: "Ethereum-final after",
      note: "From a new block to its Ethereum finality",
      value: finalizedLagSec ? `about ${Math.round(finalizedLagSec / 60)} min` : "–",
    },
    ...(CHAINLINK_ETH_USD
      ? [
          {
            label: "ETH price",
            note: asOf ? `Chainlink, as of ${asOf}${ethStale ? ", over a day old" : ""}` : "Chainlink",
            value: ethUsd ? formatUsd(ethUsd) : "–",
          },
        ]
      : []),
    ...(USDG ? [{ label: "USDG supply", note: "Paxos Global Dollar", value: usdg ? formatCompact(usdg) : "–" }] : []),
  ];

  return (
    <dl className="border-b border-line">
      {rows.map((r) => (
        <div key={r.label} className="flex items-baseline justify-between gap-6 border-t border-line py-4">
          <dt>
            <span className="text-[15px] text-mist">{r.label}</span>
            {r.note && <span className="mt-0.5 block text-[13px] text-hush">{r.note}</span>}
          </dt>
          <dd className="tnum text-right text-xl font-light text-mist sm:text-2xl">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function RecentBlocks() {
  const { latest, recent } = useChainPulse();
  const rows = recent.slice(-20).reverse();

  if (!latest) return <p className="border-t border-line py-4 text-hush">Listening for Robinhood Chain…</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[15px]">
        <caption className="sr-only">The 20 most recent blocks, newest first</caption>
        <thead>
          <tr className="text-hush">
            <th scope="col" className="py-2 pr-2 text-left font-normal sm:pr-4 whitespace-nowrap">
              Block
            </th>
            <th scope="col" className="px-2 py-2 text-right font-normal whitespace-nowrap sm:px-4">
              Age
            </th>
            <th scope="col" className="px-2 py-2 text-right font-normal whitespace-nowrap sm:px-4">
              Txs
            </th>
            <th scope="col" className="px-2 py-2 text-right font-normal whitespace-nowrap sm:px-4">
              <span className="sm:hidden">Gas</span>
              <span className="hidden sm:inline">Gas used</span>
            </th>
            <th scope="col" className="py-2 pl-2 text-right font-normal whitespace-nowrap sm:pl-4">
              <span className="sm:hidden">Gwei</span>
              <span className="hidden sm:inline">Base fee (gwei)</span>
            </th>
          </tr>
        </thead>
        <tbody className="tnum">
          {rows.map((b) => (
            <tr key={b.number.toString()} className="border-t border-line">
              <td className="py-2.5 pr-2 sm:pr-4">
                <a href={explorerBlock(b.number)} target="_blank" rel="noreferrer" className="text-mist hover:text-moon">
                  {formatInt(b.number)}
                </a>
              </td>
              <td className="px-2 text-right sm:px-4 text-hush">{latest.timestamp - b.timestamp} s</td>
              <td className="px-2 text-right sm:px-4 text-mist">{b.txCount}</td>
              <td className="px-2 text-right sm:px-4 text-hush">{formatCompact(Number(b.gasUsed))}</td>
              <td className="pl-2 text-right sm:pl-4 text-hush">{gwei(b.baseFeePerGas)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
