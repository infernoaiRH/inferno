import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import { CopyButton, CreditsAccount } from "@/components/credits/CreditsAccount";
import { buttonClass } from "@/components/ui/Button";
import { CHAIN, explorerAddress } from "@/lib/chain";
import { cn } from "@/lib/cn";
import { publicConfig } from "@/lib/credits/config";
import { formatUsd, shortAddress } from "@/lib/format";
import { site } from "@/lib/site";

// Reads the server's payment settings on every request, not at build time.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Credits",
  description: "Top up Inferno credits by sending USDG, $INFERNOAI or TAO from your wallet to the treasury on Robinhood Chain. Credits pay for AI answers.",
  alternates: { canonical: "/credits" },
};

const wrap = "mx-auto max-w-7xl px-5 sm:px-8";
const split = "grid gap-x-16 gap-y-10 py-16 sm:py-24 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]";
const link = "text-flame underline decoration-flame/40 underline-offset-4 hover:decoration-flame";
/** ForeverMoney's bridge: TAO from Bittensor to Robinhood Chain over Chainlink CCIP. */
const TAO_BRIDGE = "https://forevermoney.ai/bridge?type=bridge&from=finney&to=robinhood";

function Rules({ rows }: { rows: { term: string; detail: string }[] }) {
  return (
    <dl className="border-b border-line">
      {rows.map((r) => (
        <div key={r.term} className="grid gap-x-8 gap-y-1 border-t border-line py-5 sm:grid-cols-[13rem_minmax(0,1fr)]">
          <dt>{r.term}</dt>
          <dd className="text-hush">{r.detail}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Decimal places that keep a sub-$1 price to ~3 significant digits, e.g. $0.000239 or $0.0000239. */
function tinyDigits(usd: number): number {
  return usd > 0 && usd < 1 ? 2 - Math.floor(Math.log10(usd)) : 2;
}

export default async function CreditsPage() {
  const cfg = await publicConfig();
  const sym = (t: (typeof cfg.tokens)[number]) => (t.symbol === site.token.symbol ? `$${t.symbol}` : t.symbol);
  const final = " Your transfer is credited at the price when it's final, about 15–20 minutes after you send it.";
  const bridge = (
    <a className={link} href={TAO_BRIDGE} target="_blank" rel="noreferrer">
      ForeverMoney&apos;s bridge
    </a>
  );
  /** How a token's price is worked out, or, for a live one without a price yet, why its transfers wait. */
  const explain = (t: (typeof cfg.tokens)[number]): ReactNode => {
    const priced = t.usdPrice !== null;
    if (t.symbol === "USDG") return "One USDG is one dollar of credit.";
    if (t.live && t.symbol === "TAO")
      return priced ? (
        <>
          That&apos;s Chainlink&apos;s TAO/USD price, less 10%, read from its feed on Arbitrum since Robinhood Chain has none. Only TAO
          bridged over Chainlink CCIP counts; {bridge} brings it over from Bittensor.{final}
        </>
      ) : (
        <>
          Chainlink&apos;s TAO/USD feed is stale or out of reach. TAO sent now isn&apos;t lost: it waits, and is credited once there&apos;s
          a price. Only TAO bridged over Chainlink CCIP counts ({bridge}).
        </>
      );
    if (t.live)
      return priced
        ? `That's the lowest price of the last 30 minutes on its Uniswap pool on Robinhood Chain, less 10%, checked every 5 minutes: nobody sets it by hand, and a quick pump can't be cashed in.${final}`
        : "It needs 20 minutes of pool checks first, and pauses while the pool is too thin or a check is late. Coins sent now aren't lost: they wait, and are credited once there's a price.";
    return "We set this price by hand and update it; your transfer is credited at the price shown here when it's final.";
  };
  const symbols = cfg.tokens.map(sym);
  const sendable = symbols.length > 1 ? `${symbols.slice(0, -1).join(", ")} or ${symbols.at(-1)}` : (symbols[0] ?? "tokens");
  const cap = cfg.maxCreditUsd === null ? "" : formatUsd(cfg.maxCreditUsd, cfg.maxCreditUsd % 1 ? 2 : 0);

  return (
    <>
      <section aria-labelledby="credits-title" className={cn(wrap, "pt-16 pb-16 sm:pt-24 sm:pb-20")}>
        <h1 id="credits-title" className="wide text-[clamp(2.75rem,7.5vw,6rem)] leading-[0.92]">
          <span className="block">Credits.</span>
          <span className="heat-text block">Pay by transfer.</span>
        </h1>
        <p className="mt-10 max-w-[62ch] text-lg text-hush sm:text-xl">
          Credits pay for answers from GPUs on the network and from Bittensor models. To top up, you send {sendable} from your wallet to
          Inferno&apos;s treasury on {CHAIN.name}. There&apos;s no card, no checkout and no account to make. Private chat on your own GPU is
          free and needs no credits.
        </p>
      </section>

      {!cfg.enabled || !cfg.treasury ? (
        <section aria-labelledby="off-title" className="border-t border-line">
          <div className={cn(wrap, "py-16 sm:py-24")}>
            <div className="max-w-3xl rounded-3xl border border-line-bright bg-night-2 p-8 sm:p-10">
              <h2 id="off-title" className="text-3xl sm:text-4xl">
                Payments aren&apos;t switched on for this server yet.
              </h2>
              <p className="mt-4 text-lg text-hush">
                Don&apos;t send anything until this page shows a treasury address. Nothing you send before then is credited.
              </p>
            </div>
          </div>
        </section>
      ) : (
        <>
          <section aria-labelledby="how-title" className="border-t border-line">
            <div className={cn(wrap, split)}>
              <h2 id="how-title" className="wide text-4xl sm:text-6xl">
                How to top up
              </h2>
              <ol className="border-b border-line">
                <li className="border-t border-line py-6">
                  <h3 className="text-2xl">1. Sign in with your wallet</h3>
                  <p className="mt-2 text-hush">
                    Credits belong to the wallet that sends the tokens, and you spend them by signing in with that same wallet. Signing in is
                    free and moves no funds.
                  </p>
                </li>
                <li className="border-t border-line py-6">
                  <h3 className="text-2xl">2. Send tokens to the treasury</h3>
                  <p className="mt-2 text-hush">
                    On {CHAIN.name} (chain {cfg.chainId}) only. Send {sendable} to this address:
                  </p>
                  <p className="tnum mt-4 rounded-2xl border border-line-bright bg-night-2 px-4 py-3 text-lg break-all text-mist">{cfg.treasury}</p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <CopyButton text={cfg.treasury} label="Copy address" />
                    <a className={buttonClass({ variant: "ghost" })} href={explorerAddress(cfg.treasury)} target="_blank" rel="noreferrer">
                      <ExternalLink size={16} aria-hidden />
                      View on explorer
                    </a>
                  </div>
                </li>
                <li className="border-t border-line py-6">
                  <h3 className="text-2xl">3. Wait for finality</h3>
                  <p className="mt-2 text-hush">
                    Robinhood Chain settles on Ethereum. Your credits appear once Ethereum finalizes the transfer, about 15 to 20 minutes after
                    you send it.
                  </p>
                </li>
              </ol>
              <p className="rounded-3xl border-2 border-flame bg-night-2 p-6 text-xl text-mist lg:col-start-2" role="note">
                Send from your own wallet, the one you sign in with, not from an exchange or a contract: credits go to the address that
                sends. They appear after Ethereum finality, about 15–20 minutes.
              </p>
            </div>
          </section>

          <section aria-labelledby="tokens-title" className="border-t border-line">
            <div className={cn(wrap, split)}>
              <div>
                <h2 id="tokens-title" className="wide text-4xl sm:text-6xl">
                  What you can send
                </h2>
                {cfg.minTopUpNote ? <p className="mt-6 max-w-[40ch] text-hush">{cfg.minTopUpNote}</p> : null}
              </div>
              <dl className="border-b border-line">
                {cfg.tokens.map((t) => (
                  <div key={t.address} className="grid gap-x-8 gap-y-1 border-t border-line py-5 sm:grid-cols-[13rem_minmax(0,1fr)]">
                    <dt>
                      <span className="text-xl text-mist">{sym(t)}</span>
                      <a
                        className="tnum mt-1 flex items-center gap-1.5 text-[13px] text-faint hover:text-mist"
                        href={explorerAddress(t.address)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {shortAddress(t.address)}
                        <ExternalLink size={13} aria-hidden />
                        <span className="sr-only">View the {t.symbol} contract on the explorer</span>
                      </a>
                    </dt>
                    <dd className="text-hush">
                      {t.usdPrice === null ? (
                        <span className="text-mist">No live price right now. </span>
                      ) : (
                        <>
                          <span className="tnum text-mist">
                            {formatUsd(t.usdPrice, t.live ? tinyDigits(t.usdPrice) : t.usdPrice < 1 ? 6 : 2)} per {sym(t)}
                          </span>
                          .{" "}
                        </>
                      )}
                      {explain(t)}
                    </dd>
                  </div>
                ))}
                <div className="grid gap-x-8 gap-y-1 border-t border-line py-5 sm:grid-cols-[13rem_minmax(0,1fr)]">
                  <dt className="text-xl text-mist">ETH</dt>
                  <dd className="text-hush">
                    Not accepted yet. A plain ETH transfer leaves no token log for us to read, so it can&apos;t be credited. Don&apos;t send ETH.
                  </dd>
                </div>
              </dl>
            </div>
          </section>

          <section id="account" aria-labelledby="account-title" className="border-t border-line">
            <div className={cn(wrap, "py-16 sm:py-24")}>
              <h2 id="account-title" className="wide mb-10 text-4xl sm:text-6xl">
                Your credits
              </h2>
              <CreditsAccount />
            </div>
          </section>

          <section aria-labelledby="terms-title" className="border-t border-line">
            <div className={cn(wrap, split)}>
              <h2 id="terms-title" className="wide text-4xl sm:text-6xl">
                Beta terms
              </h2>
              <Rules
                rows={[
                  {
                    term: "Non-refundable",
                    detail: "Credits are prepaid and can't be refunded or withdrawn during the beta. Top up only what you plan to use.",
                  },
                  {
                    term: `${cap} per transfer`,
                    detail: `Each transfer credits at most ${cap}. Anything above that is recorded and held for a manual review, not credited automatically.`,
                  },
                  {
                    term: "Listed tokens only",
                    detail:
                      "ETH isn't accepted yet, and neither is any token not listed above. Tokens sent from an exchange credit the exchange's address, not yours, so send from your own wallet.",
                  },
                  {
                    term: "Beta software",
                    detail: "Payments are new. Start with a small transfer and check it shows up here before sending more.",
                  },
                ]}
              />
            </div>
          </section>
        </>
      )}
    </>
  );
}
