"use client";

import { useEffect, useState, type ReactNode } from "react";
import { HeatBar } from "@/components/chat/Heat";
import { Button, buttonClass } from "@/components/ui/Button";
import { ConnectCta } from "@/components/wallet/ConnectButton";
import { useWallet } from "@/components/wallet/WalletProvider";
import { CHAIN } from "@/lib/chain";
import { cn } from "@/lib/cn";
import { formatInt, formatUsd, shortAddress } from "@/lib/format";
import { MODELS, modelName } from "@/lib/llm/engine";
import { networkPaid } from "@/lib/relay/asker";
import { useServeNode, type Tally } from "@/lib/relay/node";
import { LENDER_SHARE, USD_PER_1K_TOKENS, type NodeOffer } from "@/lib/relay/protocol";

const wrap = "mx-auto max-w-7xl px-5 sm:px-8";
const size = (mb: number) => (mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`);
const clock = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });
const usdg = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
const price = `${formatUsd(USD_PER_1K_TOKENS)} per 1,000 tokens`;
const share = `${Math.round(LENDER_SHARE * 100)}%`;

/** Wallet, model, then online. Nothing downloads or asks the wallet for anything until a button press. */
export function ServeNode() {
  const { address, provider, onRobinhoodChain, switchToRobinhood } = useWallet();
  const { gpu, status, load, online, tally, linked, signing, error, goOnline, goOffline } = useServeNode();
  const [pick, setPick] = useState(0);
  // Whether this site has payments on; null until the server says, so the page never claims either case early.
  const [paid, setPaid] = useState<boolean | null>(null);

  useEffect(() => {
    let live = true;
    void networkPaid().then((p) => live && setPaid(p));
    return () => {
      live = false;
    };
  }, []);

  const known = gpu.state === "ok";
  const build = (i: number) => (known && gpu.f16 ? MODELS[i].f16 : MODELS[i].f32);
  const chosen = build(pick);
  const ready = status.state === "ready";
  const start = () => {
    if (address && provider) void goOnline(address, provider);
  };

  return (
    <section id="serve" aria-labelledby="serve-title" className="border-t border-line">
      <div className={cn(wrap, "grid gap-x-16 gap-y-12 py-20 sm:py-28 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]")}>
        <div>
          <h2 id="serve-title" className="xwide text-[clamp(2.5rem,6vw,5rem)] leading-[0.95]">
            Serve from this browser
          </h2>
          <p className="mt-6 max-w-[52ch] text-lg text-hush">
            Load a model on your GPU and go online. This tab then answers chats for people on the network, who pick a
            lender by wallet address.
          </p>
          <p className="mt-6 max-w-[52ch] border-l border-line-bright pl-4 text-mist">
            People&apos;s words pass through this tab&apos;s memory to your GPU and are never shown or saved here. You never
            see who is asking.
          </p>
          <p className="mt-6 max-w-[52ch] text-[15px] text-hush">
            This runs on the beta relay.
            {paid === true &&
              ` People pay for answers with Inferno credits, at ${price}, and you earn ${share} of each one your GPU serves. During the beta, payouts go out by hand, in USDG, to your wallet.`}
            {paid === false && " Payments are off on this site, so network chat is free and serving earns nothing."}
          </p>
        </div>

        {online ? (
          <Dashboard offer={online} tally={tally} linked={linked} paid={paid === true} onStop={goOffline} />
        ) : (
          <ol className="border-b border-line">
            <Step n={1} title="Connect your wallet">
              {!address ? (
                <ConnectCta className={buttonClass()} />
              ) : !onRobinhoodChain ? (
                <Button onClick={() => void switchToRobinhood().catch(() => {})}>Switch to {CHAIN.name}</Button>
              ) : (
                <p>
                  Connected as <span className="tnum">{shortAddress(address)}</span>
                </p>
              )}
              <p className="mt-3 text-[15px] text-hush">Your address is how people pick you, and where payouts go.</p>
            </Step>

            <Step n={2} title="Load a model">
              {gpu.state === "missing" ? (
                <p className="text-hush">
                  This browser can&apos;t run a model. Serving needs WebGPU, in a recent Chrome or Edge on a computer.
                </p>
              ) : (
                <>
                  <fieldset disabled={status.state === "loading" || signing} className="border-b border-line">
                    <legend className="sr-only">Model to serve</legend>
                    {MODELS.map((m, i) => (
                      <label
                        key={m.name}
                        className="flex cursor-pointer gap-3 border-t border-line px-2 py-3 transition-colors hover:bg-night-2 has-checked:bg-night-2 has-disabled:cursor-default"
                      >
                        <input
                          type="radio"
                          name="serve-model"
                          checked={pick === i}
                          onChange={() => setPick(i)}
                          className="mt-1.5 shrink-0 accent-flame"
                        />
                        <span className="min-w-0 flex-1">
                          {m.name}
                          <span className="block text-[15px] text-hush">{m.note}</span>
                        </span>
                        {known && <span className="tnum shrink-0 pt-0.5 text-[15px] text-hush">{size(build(i).mb)}</span>}
                      </label>
                    ))}
                  </fieldset>
                  <div className="mt-4">
                    {status.state === "loading" ? (
                      <Loading text={status.text} value={status.progress} />
                    ) : (
                      <Button onClick={() => load(chosen.id)} disabled={!known || signing || (ready && status.model === chosen.id)}>
                        {ready && status.model === chosen.id ? "Loaded" : "Load model"}
                      </Button>
                    )}
                  </div>
                  {status.state === "error" && (
                    <p role="alert" className="mt-3 text-[15px] text-ember">
                      {status.message}
                    </p>
                  )}
                  <p className="mt-3 text-[15px] text-hush">
                    Sizes are the graphics memory each model needs. The first load downloads it from Hugging Face; after that
                    it&apos;s cached in this browser.
                  </p>
                </>
              )}
            </Step>

            <Step n={3} title="Go online">
              <Button size="lg" onClick={start} disabled={!address || !onRobinhoodChain || !ready || signing}>
                {signing ? "Check your wallet…" : "Go online"}
              </Button>
              <p className="mt-3 text-[15px] text-hush">
                {ready && `You'll serve ${modelName(status.model)}. `}Your wallet signs a note that links this tab&apos;s key
                to your address. Signing is free and moves no funds.
              </p>
              {error && (
                <p role="alert" className="mt-3 text-[15px] text-ember">
                  {error}
                </p>
              )}
            </Step>
          </ol>
        )}
      </div>
    </section>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <li className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3 border-t border-line py-6 sm:grid-cols-[3rem_minmax(0,1fr)]">
      <span aria-hidden className="tnum font-display text-2xl font-extrabold text-faint">
        {n}
      </span>
      <div>
        <h3 className="text-2xl">{title}</h3>
        <div className="mt-4">{children}</div>
      </div>
    </li>
  );
}

/** web-llm's load progress: the first sentence of its status and the fraction of the current step. */
function Loading({ text, value }: { text: string; value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-4 text-sm">
        <span className="min-w-0 text-heat-4">{text.split(". ")[0]}</span>
        <span className="tnum shrink-0 text-hush">{pct}%</span>
      </div>
      <HeatBar
        value={value}
        role="progressbar"
        aria-label="Loading the model"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="mt-2"
      />
    </div>
  );
}

/** Online: counts only. Nothing anyone asked or was answered ever reaches this screen. */
function Dashboard({
  offer,
  tally,
  linked,
  paid,
  onStop,
}: {
  offer: NodeOffer;
  tally: Tally;
  linked: boolean;
  paid: boolean;
  onStop: () => void;
}) {
  const earned = (tally.tokens / 1000) * USD_PER_1K_TOKENS * LENDER_SHARE;
  const stats = [
    ["Requests served", formatInt(tally.requests)],
    ["Tokens written", formatInt(tally.tokens)],
    ["Waiting in line", formatInt(tally.waiting)],
    ["Last request", tally.lastAt ? clock.format(tally.lastAt) : "None yet"],
  ];
  return (
    <div className="relative self-start overflow-hidden rounded-3xl border border-line bg-night-2 p-5 sm:p-8">
      {/* Heat means work: cold while connecting, warm while waiting, hot while writing. */}
      <div
        aria-hidden
        className={cn(
          "heat-fill pointer-events-none absolute inset-x-0 -top-12 h-24 blur-3xl transition-opacity duration-700 ease-quiet",
          !linked ? "opacity-0" : tally.working ? "opacity-90 motion-safe:animate-pulse" : "opacity-30",
        )}
      />
      <div className="relative">
        <p aria-live="polite" className="flex items-center gap-4">
          <span
            aria-hidden
            className={cn(
              "h-3.5 w-3.5 shrink-0 rounded-full",
              linked ? "bg-heat-4 shadow-[0_0_18px_var(--color-heat-4)] motion-safe:animate-breathe" : "bg-faint",
            )}
          />
          <span
            className={cn(
              "wide font-display text-[clamp(1.5rem,7.5vw,3.75rem)] leading-none font-extrabold",
              linked ? "heat-text" : "text-hush",
            )}
          >
            {linked ? "Online" : "Connecting"}
          </span>
        </p>
        <p className="mt-4 text-hush">
          Serving {offer.modelName} as <span className="tnum text-mist">{shortAddress(offer.address)}</span>
          {offer.gpu && ` on ${offer.gpu}`}. {tally.working ? "Writing an answer now." : "Waiting for the next request."}
        </p>

        <dl className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line">
          {stats.map(([label, value]) => (
            <div key={label} className="bg-night px-3 py-3 sm:px-4">
              <dt className="text-[13px] text-hush">{label}</dt>
              <dd className="tnum mt-1 font-display text-xl font-extrabold break-words sm:text-2xl">{value}</dd>
            </div>
          ))}
          <div className="col-span-2 bg-night px-3 py-4 sm:px-4">
            <dt className="text-[13px] text-hush">{paid ? "Earned this session" : "Would have earned with payments on"}</dt>
            <dd className="mt-1 flex flex-wrap items-baseline gap-x-2">
              <span className="tnum font-display text-4xl font-extrabold">{usdg(earned)}</span>
              <span className="text-hush">USDG</span>
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-[15px] text-faint">
          {paid
            ? `Estimated from the tokens this tab wrote, at ${price}, of which you keep ${share}. The ledger records the exact amount, and during the beta it's paid out by hand in USDG.`
            : `At ${price}, of which lenders keep ${share}. Payments are off on this site, so none of it is paid.`}
        </p>

        {tally.failed && (
          <p role="alert" className="mt-5 text-[15px] text-ember">
            The last request failed. {tally.failed}
          </p>
        )}
        <p className="mt-6 border-l border-line-bright pl-4 text-[15px] text-mist">
          Keep this page open while you serve, ideally in its own window. Leaving it, or letting the computer sleep, takes
          you offline.
        </p>
        <Button variant="quiet" className="mt-8" onClick={onStop}>
          Go offline
        </Button>
      </div>
    </div>
  );
}
