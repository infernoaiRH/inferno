"use client";

import { useState, type ReactNode } from "react";
import { Check, Copy, ExternalLink, RefreshCw } from "lucide-react";
import { formatUnits } from "viem";
import { Button, buttonClass } from "@/components/ui/Button";
import { ConnectCta, walletError } from "@/components/wallet/ConnectButton";
import { useWallet } from "@/components/wallet/WalletProvider";
import { explorerTx } from "@/lib/chain";
import { shortAddress } from "@/lib/format";
import { useMounted } from "@/lib/useMounted";
import { useCredits, usd } from "./useCredits";

export function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={buttonClass({ variant: "quiet" })}
      onClick={() => {
        void navigator.clipboard
          ?.writeText(text)
          .then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1400);
          })
          .catch(() => {});
      }}
    >
      {copied ? <Check size={16} className="text-mint" aria-hidden /> : <Copy size={16} aria-hidden />}
      {copied ? "Copied" : label}
    </button>
  );
}

const KIND: Record<string, string> = { bittensor: "Bittensor answer", network: "Network answer" };
const when = (ms: number) => new Date(ms).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
const tokens = (raw: string, decimals: number) => {
  const [whole, frac = ""] = formatUnits(BigInt(raw), decimals).split(".");
  const f = frac.slice(0, 6).replace(/0+$/, "");
  return `${Number(whole).toLocaleString("en-US")}${f ? `.${f}` : ""}`;
};

function History({ title, empty, children }: { title: string; empty: string; children: ReactNode[] }) {
  return (
    <div>
      <h3 className="text-2xl">{title}</h3>
      {children.length ? (
        <ul className="mt-4 border-b border-line">{children}</ul>
      ) : (
        <p className="mt-4 border-t border-line pt-4 text-hush">{empty}</p>
      )}
    </div>
  );
}

const row = "flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-t border-line py-4";

/** Your balance and history on /credits, or the step that gets you there: connect, then sign in. */
export function CreditsAccount() {
  const { address } = useWallet();
  const mounted = useMounted();
  const { credits, busy, error, signIn, signOut, refresh } = useCredits();

  if (!mounted) return <div className="h-40 animate-pulse rounded-3xl bg-night-2" aria-hidden />;
  if (!address)
    return (
      <div className="flex flex-col items-start gap-5">
        <p className="max-w-[56ch] text-lg text-hush">Connect the wallet you pay from to see your balance and spend your credits.</p>
        <ConnectCta label="Connect a wallet" className={buttonClass({ size: "lg" })} />
      </div>
    );
  if (!credits) return <p className="text-hush">Loading your credits…</p>;
  if (credits.state === "off") return <p className="text-lg text-hush">Payments aren&apos;t switched on for this server yet.</p>;
  if (credits.state === "error")
    return (
      <div className="flex flex-col items-start gap-4">
        <p className="text-ember" role="alert">
          Couldn&apos;t load your credits.
        </p>
        <Button variant="quiet" onClick={refresh}>
          Try again
        </Button>
      </div>
    );
  if (credits.state === "out")
    return (
      <div className="flex flex-col items-start gap-5">
        <p className="max-w-[56ch] text-lg text-hush">
          Sign in with <span className="tnum text-mist">{shortAddress(address)}</span> to see your balance and spend your credits. Signing in
          is free and moves no funds.
        </p>
        <Button size="lg" disabled={busy} onClick={() => void signIn()}>
          {busy ? "Check your wallet…" : "Sign in with your wallet"}
        </Button>
        {error ? (
          <p className="text-sm text-ember" role="alert">
            {walletError(error)}
          </p>
        ) : null}
      </div>
    );

  const me = credits.me;
  return (
    <div>
      <p className="text-hush">
        Balance for <span className="tnum text-mist">{shortAddress(me.address)}</span>
      </p>
      <p className="xwide tnum mt-2 font-display text-[clamp(3rem,10vw,6rem)] leading-none font-extrabold">{usd(me.balanceMicroUsd)}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button variant="quiet" onClick={refresh}>
          <RefreshCw size={16} aria-hidden />
          Refresh
        </Button>
        <Button variant="ghost" onClick={() => void signOut()}>
          Sign out
        </Button>
      </div>
      {me.earnedMicroUsd > 0 ? (
        <p className="mt-6 max-w-[60ch] text-hush">
          Lending your GPU has earned you <span className="tnum text-mist">{usd(me.earnedMicroUsd)}</span>, and{" "}
          <span className="tnum text-mist">{usd(me.paidMicroUsd)}</span> of it has been paid out in USDG so far.
        </p>
      ) : null}
      <div className="mt-14 grid gap-12 lg:grid-cols-2">
        <History title="Recent deposits" empty="No deposits yet. A transfer shows up here once it's final, about 15 to 20 minutes after you send it.">
          {me.deposits.map((d) => (
            <li key={`${d.txHash}-${d.logIndex}`} className={row}>
              <span className="tnum text-mist">
                {tokens(d.amount, d.decimals)} {d.symbol}
              </span>
              <span className="tnum text-hush">
                {d.funding
                  ? "Treasury funding from an admin wallet, not credited."
                  : `${usd(d.credited)} credited${d.review ? ". The rest is over the per-transfer or daily cap and waits for a manual review." : ""}`}
              </span>
              <a className="inline-flex items-center gap-1.5 text-[13px] text-faint hover:text-mist" href={explorerTx(d.txHash)} target="_blank" rel="noreferrer">
                {when(d.at)}
                <ExternalLink size={13} aria-hidden />
                <span className="sr-only">View the transaction on the explorer</span>
              </a>
            </li>
          ))}
        </History>
        <History title="Recent charges" empty="Nothing spent yet.">
          {me.charges.map((c, i) => (
            <li key={`${c.at}-${i}`} className={row}>
              <span className="text-mist">{KIND[c.kind] ?? c.kind}</span>
              <span className="tnum text-hush">{usd(c.microUsd)}</span>
              <span className="text-[13px] text-faint">{when(c.at)}</span>
            </li>
          ))}
        </History>
      </div>
    </div>
  );
}
