"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { isAddress } from "viem";
import { BadgeCheck, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { formatInt, formatUsd, shortAddress } from "@/lib/format";
import { fetchNodes } from "@/lib/relay/client";
import { networkPaid } from "@/lib/relay/asker";
import { HEARTBEAT_MS, LENDER_SHARE, USD_PER_1K_TOKENS, verifyNodeOffer, type ListedNode } from "@/lib/relay/protocol";
import { card, reveal } from "./ModelPanel";

const PRIVACY = [
  [
    "The Inferno relay",
    "Sees only sealed envelopes: when they travel, roughly how big they are and, like any website, your IP address. Never the words inside.",
  ],
  [
    "The lender's GPU",
    "Reads your words in memory to write the answer. The lender's node page never shows them, but a lender running modified software could.",
  ],
  [
    "Your wallet",
    "The lender never learns it. Each chat uses a fresh key made in this tab, and asking needs no wallet during the beta.",
  ],
  ["Zero exposure", "Use private mode: the model runs on your own GPU and nothing you type leaves this tab."],
];

type Props = { picked?: string; onPick: (node: ListedNode) => void; onClose?: () => void };

/**
 * Lenders online now. The relay could list anything, so this tab checks every offer itself and shows
 * only nodes whose wallet signed the node key that each prompt is sealed to.
 */
export function LenderPanel({ picked, onPick, onClose }: Props) {
  const [nodes, setNodes] = useState<ListedNode[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [address, setAddress] = useState("");
  const [miss, setMiss] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);

  useEffect(() => {
    let live = true;
    void networkPaid().then((p) => live && setPaid(p));
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    let live = true;
    const refresh = () =>
      fetchNodes()
        .then(async (all) => {
          const signed = await Promise.all(all.map(verifyNodeOffer));
          if (!live) return;
          // By address, so rows don't jump each time lenders re-announce.
          setNodes(all.filter((_, i) => signed[i]).sort((a, b) => a.address.localeCompare(b.address)));
          setFailed(false);
        })
        .catch(() => live && setFailed(true));
    void refresh();
    const timer = setInterval(refresh, HEARTBEAT_MS);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, []);

  function pickAddress(e: FormEvent) {
    e.preventDefault();
    const a = address.trim();
    const node = nodes?.find((n) => n.address.toLowerCase() === a.toLowerCase());
    if (!node) {
      setMiss(isAddress(a, { strict: false }) ? "That address isn't serving right now." : "That isn't a wallet address. It starts with 0x.");
      return;
    }
    setAddress("");
    setMiss(null);
    onPick(node);
  }

  return (
    <section ref={onClose ? reveal : undefined} aria-labelledby="lender-title" className={card}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="lender-title" className="text-2xl">
            Pick a lender
          </h2>
          <p className="mt-1.5 text-[15px] text-hush">
            People serving a model from their browser. Each one&apos;s wallet signed the key their node uses, and this
            tab checked that signature before listing them.
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close the lender list"
            className="-mt-1 -mr-1 shrink-0 rounded-full p-2 text-hush hover:text-mist"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {failed && (
        <p className="mt-5 text-[15px] text-ember">The relay didn&apos;t answer. Trying again every 10 seconds.</p>
      )}
      {nodes === null ? (
        !failed && <p className="mt-5 text-[15px] text-hush">Looking for lenders online.</p>
      ) : nodes.length === 0 ? (
        <p className="mt-5 text-[15px] text-hush">
          No lenders online right now. Serve your own GPU from{" "}
          <Link href="/lend" className="text-flame underline decoration-flame/40 underline-offset-4 hover:decoration-flame">
            Lend a GPU
          </Link>
          , or use private mode.
        </p>
      ) : (
        <ul className="mt-5 grid gap-2">
          {nodes.map((n) => (
            <li key={n.key}>
              <button
                type="button"
                onClick={() => onPick(n)}
                aria-pressed={n.key === picked}
                className="flex w-full items-start gap-3 rounded-2xl border border-line bg-night p-4 text-left transition-colors hover:border-line-bright aria-pressed:border-flame/70 aria-pressed:bg-night-3/50"
              >
                <Swatch address={n.address} />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span title={n.address} className="tnum font-medium text-mist">
                      {shortAddress(n.address)}
                    </span>
                    <span className="flex items-center gap-1 text-sm text-mint">
                      <BadgeCheck size={14} aria-hidden className="shrink-0" />
                      Key verified
                    </span>
                  </span>
                  <span className="block text-[15px] text-hush">
                    {n.modelName} on {n.gpu || "a GPU its browser doesn't name"}
                  </span>
                  {!!n.tps && <span className="tnum block text-sm text-faint">Recent speed: {formatInt(n.tps)} tokens/s</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={pickAddress} className="mt-6">
        <label htmlFor="lender-address" className="block text-[15px] text-mist">
          Use a lender&apos;s address
        </label>
        <div className="mt-2 flex gap-2">
          <input
            id="lender-address"
            value={address}
            onChange={(e) => {
              setAddress(e.target.value);
              setMiss(null);
            }}
            placeholder="0x…"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            className="tnum h-10 min-w-0 flex-1 rounded-full border border-line bg-night px-4 text-[15px] text-mist placeholder:text-faint focus:border-flame/70 focus:ring-2 focus:ring-flame/20 focus:outline-none"
          />
          <Button type="submit" variant="quiet" disabled={!address.trim()}>
            Use
          </Button>
        </div>
        {miss && (
          <p role="alert" className="mt-2 text-[15px] text-ember">
            {miss}
          </p>
        )}
      </form>

      <div className="mt-6 border-t border-line pt-5">
        <h3 className="text-lg">Who can read what you type</h3>
        <dl className="mt-3 grid gap-3 text-[15px]">
          {PRIVACY.map(([who, what]) => (
            <div key={who}>
              <dt className="font-medium text-mist">{who}</dt>
              <dd className="text-hush">{what}</dd>
            </div>
          ))}
        </dl>
      </div>
      <p className="mt-5 text-sm text-faint">
        {paid
          ? `Paid with Inferno credits: ${formatUsd(USD_PER_1K_TOKENS)} per 1,000 tokens, and lenders keep ${Math.round(LENDER_SHARE * 100)}%. Sign in from the wallet menu to ask.`
          : `Free during the beta. At launch, answers are planned at ${formatUsd(USD_PER_1K_TOKENS)} per 1,000 tokens, and lenders keep ${Math.round(LENDER_SHARE * 100)}%.`}
      </p>
    </section>
  );
}

/** A swatch per address from the heat ramp, so lenders are easy to tell apart at a glance. */
function Swatch({ address }: { address: string }) {
  const n = parseInt(address.slice(2, 8), 16);
  const a = (n % 5) + 1;
  const b = ((a + ((n >> 3) % 4)) % 5) + 1; // never the same stop as `a`
  return (
    <span
      aria-hidden
      className="mt-0.5 block size-9 shrink-0 rounded-full"
      style={{
        background: `conic-gradient(from ${n % 360}deg, var(--color-heat-${a}), var(--color-heat-${b}), var(--color-heat-${a}))`,
      }}
    />
  );
}
