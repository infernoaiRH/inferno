import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { getStatus } from "@/lib/status";
import { site } from "@/lib/site";
import { explorerBlock } from "@/lib/chain";
import { formatInt, formatUsd } from "@/lib/format";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Status",
  description:
    "Is Inferno live? Checks of the site, Robinhood Chain mainnet, Bittensor subnet 64, credits, the $INFERNOAI and TAO prices and the $INFERNOAI contract, run on the server when the page loads.",
  alternates: { canonical: "/status" },
};

const link = "text-flame underline decoration-flame/40 underline-offset-4 hover:decoration-flame";

/** Pages go through Link; the JSON and text routes are plain links; other sites open in a new tab. */
function Go({ href, children }: { href: string; children: ReactNode }) {
  if (!href.startsWith("/"))
    return (
      <a href={href} target="_blank" rel="noreferrer" className={link}>
        {children}
      </a>
    );
  return /^\/api\/|\.txt$/.test(href) ? (
    <a href={href} className={link}>
      {children}
    </a>
  ) : (
    <Link href={href} className={link}>
      {children}
    </Link>
  );
}

/** Is Inferno live? Every row is checked on the server for this request, so crawlers and AI assistants read real numbers. */
export default async function StatusPage() {
  const s = await getStatus();
  const block = s.chain.latestBlock;
  const models = s.bittensor.sealedModels;
  const lenders = s.network?.lendersOnline ?? null;
  const paid = (s.payments.tokens ?? []).map((t) => (t.symbol === s.token.symbol ? `$${t.symbol}` : t.symbol));
  const paidIn = paid.length > 1 ? `${paid.slice(0, -1).join(", ")} or ${paid.at(-1)}` : paid[0];
  /** A live-priced token's row: what one buys in credits now, and how that's worked out. */
  const priced = (symbol: string, name: string, unit: string, rule: string, waiting: string) => {
    const t = s.payments.tokens?.find((x) => x.symbol === symbol);
    const usd = t?.creditUsd ?? null;
    return {
      label: `${name} for credits`,
      value:
        usd === null ? (
          t ? waiting : "Not taken right now"
        ) : (
          <span>
            <span className="tnum text-mist">{formatUsd(usd, Math.max(2, 2 - Math.floor(Math.log10(usd))))}</span> of credit a {unit}: {rule}
          </span>
        ),
      live: usd !== null,
      href: "/credits",
      go: "Credits",
    };
  };
  const rows: { label: string; value: ReactNode; live: boolean; href?: string; go?: string }[] = [
    { label: "Website", value: "Up", live: true },
    {
      label: s.chain.name,
      value: block === null ? "Couldn't reach the chain" : <span className="tnum">Block {formatInt(block)}</span>,
      live: block !== null,
      href: block === null ? undefined : explorerBlock(block),
      go: "Explorer",
    },
    {
      label: "Bittensor subnet 64 (Chutes)",
      value: models === null ? "Couldn't reach Chutes" : `${models} sealed models live`,
      live: !!models,
      href: "https://taostats.io/subnets/64",
      go: "taostats",
    },
    {
      label: "Inferno credits",
      value: s.payments.enabled === null ? "Couldn't check" : s.payments.enabled ? `On, paid in ${paidIn || "USDG"}` : "Off",
      live: s.payments.enabled === true,
      href: "/credits",
      go: "Credits",
    },
    {
      label: "GPUs people lend",
      value: lenders === null ? "Relay off" : `${lenders} online right now`,
      live: (lenders ?? 0) > 0,
      href: "/network",
      go: "Network",
    },
    priced(s.token.symbol, `$${s.token.symbol}`, "coin", "the lowest price of the last 30 minutes on its pool, less 10%", "Price not ready yet; coins sent now wait for it"),
    priced("TAO", "TAO", "TAO", "Chainlink's TAO/USD price, less 10%", "Price not ready yet; TAO sent now waits for it"),
    {
      label: `$${s.token.symbol} contract`,
      value: <span className="font-mono text-[14px] break-all">{s.token.address}</span>,
      live: true,
      href: s.token.explorer,
      go: "Explorer",
    },
    { label: "Inferno on X", value: site.xHandle, live: true, href: site.x, go: "Open" },
  ];
  return (
    <section className="mx-auto max-w-3xl px-5 py-20 sm:px-8 sm:py-28">
      <p className="text-lg text-hush">Is Inferno live?</p>
      <h1 className="wide mt-3 text-[clamp(2.25rem,6vw,4rem)] leading-[0.95] font-black">
        Yes. <span className="heat-text">Here&apos;s the proof.</span>
      </h1>
      <p className="mt-6 max-w-[56ch] text-lg text-hush">
        These checks ran on our server when this page loaded, at{" "}
        <span className="tnum text-mist">{s.checkedAt.replace("T", " ").slice(0, 19)} UTC</span>. Refresh to run
        them again.
      </p>
      <dl className="mt-12 border-b border-line">
        {rows.map((r) => (
          <div key={r.label} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-t border-line py-4">
            <dt className="flex items-center gap-2.5 text-mist">
              <span aria-hidden className={cn("h-2 w-2 shrink-0 rounded-full", r.live ? "bg-mint" : "bg-faint")} />
              {r.label}
            </dt>
            <dd className="flex min-w-0 flex-wrap items-baseline gap-x-3 text-hush">
              {r.value}
              {r.href && <Go href={r.href}>{r.go}</Go>}
            </dd>
          </div>
        ))}
      </dl>
      {s.bittensor.models && s.bittensor.models.length > 0 && (
        <>
          <h2 className="mt-12 text-xl">Sealed models on subnet 64 right now</h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {s.bittensor.models.map((m) => (
              <li key={m} className="rounded-full border border-line-bright px-3 py-1 text-[14px] text-hush">
                {m}
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="mt-12 text-[15px] text-hush">
        The same checks as JSON: <Go href="/api/status">/api/status</Go>. For AI assistants:{" "}
        <Go href="/llms.txt">/llms.txt</Go>.
      </p>
    </section>
  );
}
