"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useWallet } from "@/components/wallet/WalletProvider";
import { useMounted } from "@/lib/useMounted";
import { CopyButton } from "./CreditsAccount";
import { useCredits } from "./useCredits";

type ApiKey = { id: number; hint: string; createdAt: number; lastUsedAt: number | null };
type KeysState = { state: "loading" } | { state: "error"; message: string } | { state: "ok"; keys: ApiKey[] };

async function json(res: Response) {
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error ?? "The server didn't answer. Try again.");
  return body;
}

const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong. Try again.");
const when = (ms: number) => new Date(ms).toLocaleDateString(undefined, { dateStyle: "medium" });
const link = "text-flame underline decoration-flame/40 underline-offset-4 hover:decoration-flame";
const row = "flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-line py-4";

function SignInHint() {
  return (
    <p className="text-hush">
      <a href="#account" className={link}>
        Sign in with your wallet
      </a>{" "}
      in Your credits above to make an API key.
    </p>
  );
}

/** The signed-in wallet's API keys on /credits: list, create and revoke. */
export function ApiKeys() {
  const { address } = useWallet();
  const mounted = useMounted();
  const { credits } = useCredits();

  const [loaded, setLoaded] = useState<{ for: string; state: KeysState } | null>(null);
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [newKey, setNewKey] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!address) return;
    void fetch("/api/credits/keys", { cache: "no-store" })
      .then(json)
      .then((body: { keys: ApiKey[] }): KeysState => ({ state: "ok", keys: body.keys }))
      .catch((e: unknown): KeysState => ({ state: "error", message: errMsg(e) }))
      .then((state) => setLoaded({ for: address, state }));
  }, [address]);

  useEffect(() => {
    if (credits?.state === "in") load();
  }, [credits?.state, load]);

  if (!mounted) return <div className="h-32 animate-pulse rounded-3xl bg-night-2" aria-hidden />;
  if (!address) return <SignInHint />;
  if (!credits) return <p className="text-hush">Loading…</p>;
  if (credits.state !== "in") return <SignInHint />;

  const state: KeysState = loaded && loaded.for === address ? loaded.state : { state: "loading" };

  const create = () => {
    setCreating(true);
    setActionError(null);
    setNewKey(null);
    void fetch("/api/credits/keys", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })
      .then(json)
      .then((body: { key: string }) => {
        setNewKey(body.key);
        load();
      })
      .catch((e: unknown) => setActionError(errMsg(e)))
      .finally(() => setCreating(false));
  };

  const revoke = (id: number) => {
    if (!window.confirm("Revoke this key? Anything using it stops working right away.")) return;
    setRevoking(id);
    setActionError(null);
    void fetch(`/api/credits/keys?id=${id}`, { method: "DELETE" })
      .then(json)
      .then(() => load())
      .catch((e: unknown) => setActionError(errMsg(e)))
      .finally(() => setRevoking(null));
  };

  return (
    <div>
      <Button variant="quiet" disabled={creating} onClick={create}>
        <Plus size={16} aria-hidden />
        {creating ? "Creating…" : "Create a key"}
      </Button>
      {actionError ? (
        <p className="mt-3 text-sm text-ember" role="alert">
          {actionError}
        </p>
      ) : null}
      {newKey ? (
        <div className="mt-4 rounded-2xl border-2 border-flame bg-night-2 p-4">
          <p className="font-mono text-[14px] break-all text-mist">{newKey}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <CopyButton text={newKey} label="Copy key" />
            <p className="text-[13px] text-mist">Copy it now: it won&apos;t be shown again.</p>
          </div>
        </div>
      ) : null}
      {state.state === "loading" ? <p className="mt-6 text-hush">Loading your keys…</p> : null}
      {state.state === "error" ? (
        <p className="mt-6 text-ember" role="alert">
          {state.message}
        </p>
      ) : null}
      {state.state === "ok" && state.keys.length === 0 ? (
        <p className="mt-6 border-t border-line pt-4 text-hush">No API keys yet.</p>
      ) : null}
      {state.state === "ok" && state.keys.length > 0 ? (
        <ul className="mt-6 border-b border-line">
          {state.keys.map((k) => (
            <li key={k.id} className={row}>
              <span className="tnum text-mist">inf_…{k.hint}</span>
              <span className="tnum text-hush">Created {when(k.createdAt)}</span>
              <span className="tnum text-hush">{k.lastUsedAt ? `Last used ${when(k.lastUsedAt)}` : "Never used"}</span>
              <Button variant="quiet" disabled={revoking === k.id} onClick={() => revoke(k.id)}>
                {revoking === k.id ? "Revoking…" : "Revoke"}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
