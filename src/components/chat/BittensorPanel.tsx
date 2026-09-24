"use client";

import { useEffect, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { BITTENSOR_MARGIN, MAX_TOKENS, chutesModels, type ChutesModel } from "@/lib/bittensor/chutes";
import { saveChutesKey, useChutesKey, type Pay } from "@/lib/bittensor/client";
import { cn } from "@/lib/cn";
import { formatInt, formatUsd } from "@/lib/format";
import { card, reveal } from "./ModelPanel";

/** Why Bittensor mode can be trusted, in one line. */
export const TRUST = "Miners run inside sealed hardware, so they can't read your words.";

/** Dollars to a useful precision: cents from 10 cents up, then down to the micro-dollar. */
export const dollars = (n: number) => formatUsd(n, n >= 0.1 ? 2 : n >= 0.001 ? 4 : 6);

const link = "text-flame underline decoration-flame/40 underline-offset-4 hover:decoration-flame";
const KEY_SHAPE = /^cpk_[\x21-\x7e]{8,300}$/;

type Props = {
  picked?: string;
  onPick: (model: ChutesModel) => void;
  pay: Pay;
  onPay: (pay: Pay) => void;
  /** This server takes Inferno credits, so offer them. */
  credits: boolean;
  onClose?: () => void;
};

/** Bittensor subnet 64 through Chutes: how to pay, which confidential-compute model, and who can read what. */
export function BittensorPanel({ picked, onPick, pay, onPay, credits, onClose }: Props) {
  const [models, setModels] = useState<ChutesModel[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const savedKey = useChutesKey();
  const [key, setKey] = useState("");
  const [keyError, setKeyError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    chutesModels().then(
      (m) => live && setModels(m),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [attempt]);

  function saveKey(e: FormEvent) {
    e.preventDefault();
    const k = key.trim();
    if (!KEY_SHAPE.test(k)) return setKeyError("That isn't a Chutes key. Keys start with cpk_.");
    if (!saveChutesKey(k)) return setKeyError("This browser won't store the key, so it can't be used here.");
    setKey("");
    setKeyError(null);
  }

  return (
    <section ref={onClose ? reveal : undefined} aria-labelledby="bittensor-title" className={card}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="bittensor-title" className="text-2xl">
            Ask Bittensor subnet 64
          </h2>
          <p className="mt-1.5 text-[15px] text-hush">
            Open models served by Chutes, subnet 64 on Bittensor. {TRUST}
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close the Bittensor settings"
            className="-mt-1 -mr-1 shrink-0 rounded-full p-2 text-hush hover:text-mist"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {credits && (
        <div role="group" aria-label="How you pay" className="mt-5 inline-flex rounded-full border border-line p-1 text-sm">
          {(["key", "credits"] as const).map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={pay === p}
              onClick={() => onPay(p)}
              className={cn("rounded-full px-3 py-1.5 transition-colors", pay === p ? "bg-night-3 text-mist" : "text-hush hover:text-mist")}
            >
              {p === "key" ? "Your Chutes key" : "Inferno credits"}
            </button>
          ))}
        </div>
      )}

      {pay === "key" ? (
        <div className="mt-5">
          <h3 className="text-lg">Your Chutes key</h3>
          {savedKey ? (
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
              <p className="tnum text-[15px] text-mist">
                Saved in this browser: {savedKey.slice(0, 4)}…{savedKey.slice(-4)}
              </p>
              <Button variant="quiet" onClick={() => saveChutesKey("")}>
                Forget key
              </Button>
            </div>
          ) : (
            <form onSubmit={saveKey} className="mt-2">
              <label htmlFor="chutes-key" className="block text-[15px] text-hush">
                Paste your key. It starts with cpk_. No key yet? Get one at{" "}
                <a href="https://chutes.ai" target="_blank" rel="noreferrer" className={link}>
                  chutes.ai
                </a>
                .
              </label>
              <div className="mt-2 flex gap-2">
                <input
                  id="chutes-key"
                  type="password"
                  value={key}
                  onChange={(e) => {
                    setKey(e.target.value);
                    setKeyError(null);
                  }}
                  placeholder="cpk_…"
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  className="h-10 min-w-0 flex-1 rounded-full border border-line bg-night px-4 text-[15px] text-mist placeholder:text-faint focus:border-flame/70 focus:ring-2 focus:ring-flame/20 focus:outline-none"
                />
                <Button type="submit" variant="quiet" disabled={!key.trim()}>
                  Save
                </Button>
              </div>
              {keyError && (
                <p role="alert" className="mt-2 text-[15px] text-ember">
                  {keyError}
                </p>
              )}
            </form>
          )}
          <p className="mt-3 text-sm text-faint">
            Answers are billed to your Chutes account. The key is kept only in this browser&apos;s storage and sent
            only to llm.chutes.ai, never to Inferno. Anything that can run code on this page, like a rogue browser
            extension, could read it and spend your Chutes balance, so forget it on shared computers. If it ever
            leaks, delete it in your Chutes account.
          </p>
        </div>
      ) : (
        <p className="mt-5 text-[15px] text-hush">
          Answers are paid from your Inferno credits at Chutes&apos; price plus {Math.round(BITTENSOR_MARGIN * 100)}%,
          our planned margin. Sign in with your wallet first. Each answer&apos;s receipt shows what it cost.
        </p>
      )}

      <h3 className="mt-6 text-lg">Pick a model</h3>
      {failed ? (
        <p className="mt-2 text-[15px] text-ember">
          Chutes didn&apos;t send its model list.{" "}
          <button
            type="button"
            onClick={() => {
              setFailed(false);
              setAttempt((a) => a + 1);
            }}
            className={link}
          >
            Try again
          </button>
        </p>
      ) : models === null ? (
        <p className="mt-2 text-[15px] text-hush">Asking Chutes which models are running.</p>
      ) : models.length === 0 ? (
        <p className="mt-2 text-[15px] text-hush">Chutes lists no confidential-compute models right now.</p>
      ) : (
        <ul className="mt-3 grid gap-2">
          {models.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => onPick(m)}
                aria-pressed={m.id === picked}
                className="w-full rounded-2xl border border-line bg-night p-4 text-left transition-colors hover:border-line-bright aria-pressed:border-flame/70 aria-pressed:bg-night-3/50"
              >
                <span className="block font-medium break-words text-mist">{m.name}</span>
                <span className="tnum block text-[15px] text-hush">
                  {dollars(m.input)} per million tokens in, {dollars(m.output)} out
                </span>
                <span className="tnum block text-sm text-faint">Reads up to {formatInt(m.context)} tokens at a time</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6 border-t border-line pt-5">
        <h3 className="text-lg">Who can read what you type</h3>
        <dl className="mt-3 grid gap-3 text-[15px]">
          <div>
            <dt className="font-medium text-mist">Chutes&apos; gateway, llm.chutes.ai</dt>
            <dd className="text-hush">
              Your words go here first. It handles them in memory to pass them to a miner and, by its{" "}
              <a href="https://chutes.ai/privacy" target="_blank" rel="noreferrer" className={link}>
                privacy policy
              </a>
              , doesn&apos;t store prompts or answers.
              {pay === "key" && " Like any website, it also sees your IP address."}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-mist">The miner&apos;s GPU</dt>
            <dd className="text-hush">
              Runs the model inside confidential-compute hardware (Intel TDX with NVIDIA confidential computing), so
              the miner can&apos;t read your words.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-mist">Inferno&apos;s server</dt>
            <dd className="text-hush">
              {pay === "credits"
                ? "Passes your words through to Chutes without storing them. It keeps only the charge: your wallet, the amount and Chutes' request id."
                : "Not involved. With your own key, this tab talks to Chutes directly."}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-mist">End-to-end encryption</dt>
            <dd className="text-hush">
              Planned. Chutes offers optional{" "}
              <a href="https://github.com/chutesai/e2ee-test" target="_blank" rel="noreferrer" className={link}>
                end-to-end encryption
              </a>{" "}
              that hides your words from its gateway too; Inferno doesn&apos;t use it yet.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-mist">Zero exposure</dt>
            <dd className="text-hush">Use private mode: the model runs on your own GPU and nothing you type leaves this tab.</dd>
          </div>
        </dl>
      </div>
      <p className="mt-5 text-sm text-faint">
        Prices are Chutes&apos; own, read live from llm.chutes.ai. Each answer stops at {formatInt(MAX_TOKENS)} tokens.
      </p>
    </section>
  );
}
