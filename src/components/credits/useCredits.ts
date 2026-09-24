"use client";

import { useCallback, useEffect, useState } from "react";
import { getAddress, toHex } from "viem";
import { createSiweMessage } from "viem/siwe";
import { useWallet } from "@/components/wallet/WalletProvider";
import { CHAIN } from "@/lib/chain";
import type { ChargeRow, DepositRow } from "@/lib/credits/ledger";
import { formatUsd } from "@/lib/format";

export type Me = {
  address: string;
  balanceMicroUsd: number;
  earnedMicroUsd: number;
  paidMicroUsd: number;
  deposits: DepositRow[];
  charges: ChargeRow[];
};
/** off: payments aren't switched on; out: not signed in with this wallet; in: signed in. */
export type Credits = { state: "off" } | { state: "out" } | { state: "error" } | { state: "in"; me: Me };

const CHANGED = "inferno:credits";

/** Dollars from micro-USD, with four decimals below a cent. */
export const usd = (micro: number) => formatUsd(micro / 1e6, micro > 0 && micro < 10_000 ? 4 : 2);

async function json(res: Response) {
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error ?? "The server didn't answer. Try again.");
  return body;
}

/** Ends the credits session in this browser, e.g. when the wallet disconnects. */
export async function signOut() {
  await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
  window.dispatchEvent(new Event(CHANGED));
}

async function load(address: string): Promise<Credits> {
  const res = await fetch("/api/credits/me", { cache: "no-store" });
  if (res.status === 503) return { state: "off" };
  if (res.status === 401) return { state: "out" };
  if (!res.ok) return { state: "error" };
  const me = (await res.json()) as Me;
  if (me.address === address.toLowerCase()) return { state: "in", me };
  // Signed in as another wallet: end that session rather than spend its credits from this one.
  await fetch("/api/auth/logout", { method: "POST" });
  return { state: "out" };
}

/** The connected wallet's credits: loads them, signs in with Ethereum (personal_sign) and signs out. */
export function useCredits() {
  const { address, provider } = useWallet();
  const [loaded, setLoaded] = useState<{ for: string; credits: Credits } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (!address) return;
    let alive = true;
    const run = () =>
      void load(address)
        .catch((): Credits => ({ state: "error" }))
        .then((credits) => alive && setLoaded({ for: address, credits }));
    run();
    window.addEventListener(CHANGED, run);
    return () => {
      alive = false;
      window.removeEventListener(CHANGED, run);
    };
  }, [address]);

  const signIn = useCallback(async () => {
    if (!address || !provider) return;
    setBusy(true);
    setError(null);
    try {
      const { nonce } = await json(await fetch("/api/auth/nonce", { cache: "no-store" }));
      const message = createSiweMessage({
        domain: window.location.host,
        address: getAddress(address),
        statement: "Sign in to Inferno to use your credits. Signing is free and moves no funds.",
        uri: window.location.origin,
        version: "1",
        chainId: CHAIN.id,
        nonce,
        issuedAt: new Date(),
      });
      const signature = await provider.request({ method: "personal_sign", params: [toHex(message), address] });
      await json(
        await fetch("/api/auth/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message, signature }) }),
      );
      window.dispatchEvent(new Event(CHANGED));
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }, [address, provider]);

  const refresh = useCallback(() => window.dispatchEvent(new Event(CHANGED)), []);

  return { credits: loaded && loaded.for === address ? loaded.credits : null, busy, error, signIn, signOut, refresh };
}
