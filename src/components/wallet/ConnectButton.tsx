"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Check, ChevronDown, Coins, Copy, ExternalLink, KeyRound, LogOut, TriangleAlert, Wallet, X } from "lucide-react";
import { erc20Abi, formatEther, formatUnits } from "viem";
import { signOut, usd, useCredits } from "@/components/credits/useCredits";
import { useWallet } from "./WalletProvider";
import { CHAIN, USDG, explorerAddress, publicClient } from "@/lib/chain";
import { shortAddress } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useMounted } from "@/lib/useMounted";

/** Turns wallet errors into a sentence a person can act on. */
export function walletError(e: unknown): string {
  const err = e as { code?: number; message?: string };
  if (err?.code === 4001) return "You declined the request in your wallet. Try again when you're ready.";
  if (err?.code === -32002) return "Your wallet already has a request open. Finish or dismiss it there first.";
  return err?.message ?? "The wallet didn't respond. Unlock it and try again.";
}

/** EIP-6963 wallet picker. Adapted from karan-personal/parq-test. */
export function WalletPickerModal({ onClose }: { onClose: () => void }) {
  const { wallets, connect } = useWallet();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-night/80 p-4 backdrop-blur-md"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="wallet-title"
    >
      <div
        className="w-full max-w-sm rounded-3xl border border-line bg-night-2 p-6 shadow-[0_30px_120px_-20px_rgba(247,144,43,0.28)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id="wallet-title" className="text-2xl">
            Connect a wallet
          </h2>
          <button
            onClick={onClose}
            className="-mt-1.5 -mr-2.5 flex h-10 w-10 items-center justify-center rounded-full text-hush transition-colors hover:text-mist"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <p className="mt-2 text-[15px] text-hush">
          Your wallet pays for network chat, receives lending payouts and signs your messaging key on {CHAIN.name}. Inferno never holds your keys.
        </p>
        {wallets.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-line bg-night p-4 text-[15px] text-hush">
            No wallet found in this browser. Install{" "}
            <a className="text-moon underline underline-offset-4" href="https://metamask.io" target="_blank" rel="noreferrer">
              MetaMask
            </a>{" "}
            or Robinhood Wallet, then reload this page.
          </div>
        ) : (
          <ul className="mt-5 flex flex-col gap-2">
            {wallets.map((w) => (
              <li key={w.id}>
                <button
                  disabled={pending !== null}
                  onClick={() => {
                    setError(null);
                    setPending(w.id);
                    void connect(w.id)
                      .then(onClose)
                      .catch((e: unknown) => setError(walletError(e)))
                      .finally(() => setPending(null));
                  }}
                  className="flex h-14 w-full items-center gap-3 rounded-2xl border border-line bg-night px-4 text-left transition-colors hover:border-moon/60 hover:bg-night-3 disabled:opacity-60"
                >
                  {w.icon ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={w.icon} alt="" className="h-7 w-7 rounded-lg" />
                  ) : (
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-line text-hush" aria-hidden>
                      <Wallet size={15} />
                    </span>
                  )}
                  <span className="text-[15px] font-medium">{w.name}</span>
                  {pending === w.id && <span className="ml-auto text-[13px] text-hush">Check your wallet…</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
        {error ? (
          <p className="mt-3 text-sm text-ember" role="alert">
            {error}
          </p>
        ) : null}
        <p className="mt-5 text-[13px] text-faint">
          Connecting adds {CHAIN.name} (chain {CHAIN.id}) to your wallet if it isn&apos;t there yet.
        </p>
      </div>
    </div>,
    document.body,
  );
}

/** In-page connect button for panels that need a wallet. */
export function ConnectCta({ label = "Connect wallet", className }: { label?: string; className?: string }) {
  const { connecting } = useWallet();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} disabled={connecting} className={className}>
        {connecting ? "Connecting…" : label}
      </button>
      {open && <WalletPickerModal onClose={() => setOpen(false)} />}
    </>
  );
}

/** A small deterministic swatch per address, so people can tell accounts apart at a glance. */
function Avatar({ address, className }: { address: string; className?: string }) {
  const n = parseInt(address.slice(2, 14), 16);
  const h1 = n % 360;
  const h2 = (h1 + 40 + ((n >> 9) % 80)) % 360;
  const turn = (n >> 17) % 360;
  return (
    <span
      aria-hidden
      className={cn("block shrink-0 rounded-full", className)}
      style={{ background: `conic-gradient(from ${turn}deg, hsl(${h1} 70% 72%), hsl(${h2} 65% 58%), hsl(${h1} 70% 72%))` }}
    />
  );
}

type Balances = { eth: string; usdg: string | null } | null;

const trim = (s: string, digits: number) => {
  const [i, f = ""] = s.split(".");
  const t = f.slice(0, digits).replace(/0+$/, "");
  return t ? `${Number(i).toLocaleString("en-US")}.${t}` : Number(i).toLocaleString("en-US");
};

/** Credits in the account menu: sign in with Ethereum, or the balance with top-up and sign-out. Hidden while payments are off. */
function CreditsItems({ item, onClose }: { item: string; onClose: () => void }) {
  const { credits, busy, error, signIn } = useCredits();
  if (credits?.state === "out")
    return (
      <>
        <button role="menuitem" className={item} disabled={busy} onClick={() => void signIn()}>
          <KeyRound size={16} className="text-hush" />
          {busy ? "Check your wallet…" : "Sign in to use credits"}
        </button>
        {error ? (
          <p className="mx-3 mb-2 text-[13px] text-ember" role="alert">
            {walletError(error)}
          </p>
        ) : null}
      </>
    );
  if (credits?.state !== "in") return null;
  return (
    <>
      <p className="mx-3 mb-2 flex items-baseline justify-between gap-3 rounded-2xl border border-line bg-night px-3 py-2.5">
        <span className="text-[12px] text-faint">Credits</span>
        <span className="tnum truncate text-[15px] text-mist">{usd(credits.me.balanceMicroUsd)}</span>
      </p>
      <Link role="menuitem" className={item} href="/credits" onClick={onClose}>
        <Coins size={16} className="text-hush" />
        Top up
      </Link>
      <button role="menuitem" className={item} onClick={() => void signOut()}>
        <KeyRound size={16} className="text-hush" />
        Sign out
      </button>
    </>
  );
}

function AccountMenu({ address, onClose }: { address: `0x${string}`; onClose: () => void }) {
  const { disconnect, providerName } = useWallet();
  const [balances, setBalances] = useState<Balances>(null);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Balances are read once, when the menu opens, so pages stay quiet on the network otherwise.
  useEffect(() => {
    let alive = true;
    Promise.all([
      publicClient.getBalance({ address }),
      USDG ? publicClient.readContract({ address: USDG.address, abi: erc20Abi, functionName: "balanceOf", args: [address] }) : null,
    ])
      .then(([eth, usdg]) => {
        if (!alive) return;
        setBalances({ eth: trim(formatEther(eth), 5), usdg: usdg === null || !USDG ? null : trim(formatUnits(usdg, USDG.decimals), 2) });
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [address]);

  useEffect(() => {
    const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && onClose();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    ref.current?.querySelector<HTMLElement>("[data-first]")?.focus();
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const item =
    "flex h-10 w-full items-center gap-3 rounded-xl px-3 text-left text-[15px] text-mist transition-colors hover:bg-night-3 focus-visible:bg-night-3";

  return (
    <div
      ref={ref}
      role="menu"
      aria-label="Wallet"
      className="absolute top-12 right-0 z-50 w-72 rounded-3xl border border-line bg-night-2 p-2 shadow-[0_24px_80px_-20px_rgba(0,0,0,0.8)]"
    >
      <div className="flex items-center gap-3 px-3 pt-3 pb-4">
        <Avatar address={address} className="h-9 w-9" />
        <div className="min-w-0 flex-1">
          <p className="tnum truncate text-[15px] text-mist" title={address}>
            {shortAddress(address)}
          </p>
          <p className="flex min-w-0 items-center gap-1.5 text-[13px] text-hush">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-mint" aria-hidden />
            <span className="truncate" title={providerName ? `${CHAIN.name} via ${providerName}` : CHAIN.name}>
              {CHAIN.name}
              {providerName ? <span className="text-faint"> via {providerName}</span> : null}
            </span>
          </p>
        </div>
      </div>
      <dl className="mx-3 mb-2 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line">
        {[
          ["ETH", balances?.eth],
          ["USDG", USDG ? balances?.usdg : "n/a"],
        ].map(([label, value]) => (
          <div key={label} className="bg-night px-3 py-2.5">
            <dt className="text-[12px] text-faint">{label}</dt>
            <dd className="tnum truncate text-[15px] text-mist">{failed ? "–" : (value ?? "…")}</dd>
          </div>
        ))}
      </dl>
      {failed && <p className="mx-3 mb-2 text-[13px] text-hush">Couldn&apos;t read balances. The public RPC may be busy.</p>}
      <CreditsItems item={item} onClose={onClose} />
      <button
        data-first
        role="menuitem"
        className={item}
        onClick={() => {
          void navigator.clipboard
            ?.writeText(address)
            .then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1400);
            })
            .catch(() => {});
        }}
      >
        {copied ? <Check size={16} className="text-mint" /> : <Copy size={16} className="text-hush" />}
        {copied ? "Copied" : "Copy address"}
      </button>
      <a role="menuitem" className={item} href={explorerAddress(address)} target="_blank" rel="noreferrer">
        <ExternalLink size={16} className="text-hush" />
        View on explorer
      </a>
      <button
        role="menuitem"
        className={item}
        onClick={() => {
          void signOut(); // a disconnected wallet shouldn't stay signed in to spend credits
          disconnect();
          onClose();
        }}
      >
        <LogOut size={16} className="text-hush" />
        Disconnect
      </button>
    </div>
  );
}

const pill =
  "inline-flex h-10 items-center justify-center gap-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors disabled:opacity-60";

export function ConnectButton({ className }: { className?: string }) {
  const { address, connected, connecting, onRobinhoodChain, switchToRobinhood } = useWallet();
  const [picker, setPicker] = useState(false);
  const [menu, setMenu] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const mounted = useMounted();

  if (!mounted) return <span className={cn("inline-flex h-10 w-36 animate-pulse rounded-full bg-night-3", className)} aria-hidden />;

  if (connected && address && !onRobinhoodChain) {
    return (
      <button
        onClick={() => {
          setSwitchError(null);
          void switchToRobinhood().catch((e: unknown) => setSwitchError(walletError(e)));
        }}
        title={switchError ?? `Your wallet is on another network. Switch to ${CHAIN.name}.`}
        className={cn(pill, "border border-brass/50 bg-brass/10 px-4 text-brass hover:bg-brass/20", className)}
      >
        <TriangleAlert size={15} aria-hidden />
        Switch network
      </button>
    );
  }

  if (connected && address) {
    return (
      <span className={cn("relative inline-flex", className)}>
        <button
          onClick={() => setMenu((m) => !m)}
          aria-haspopup="menu"
          aria-expanded={menu}
          className={cn(pill, "gap-2.5 border border-line bg-night-2 pr-3 pl-1.5 text-mist hover:border-line-bright")}
        >
          <Avatar address={address} className="h-7 w-7" />
          <span className="tnum">{shortAddress(address)}</span>
          <ChevronDown size={15} className={cn("text-hush transition-transform", menu && "rotate-180")} aria-hidden />
        </button>
        {menu && <AccountMenu address={address} onClose={() => setMenu(false)} />}
      </span>
    );
  }

  return (
    <>
      <button
        onClick={() => setPicker(true)}
        disabled={connecting}
        className={cn(pill, "border border-line-bright px-4 text-mist hover:border-moon hover:text-moon", className)}
      >
        <Wallet size={16} aria-hidden />
        {connecting ? "Connecting…" : "Connect wallet"}
      </button>
      {picker && <WalletPickerModal onClose={() => setPicker(false)} />}
    </>
  );
}
