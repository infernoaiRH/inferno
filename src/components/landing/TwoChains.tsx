"use client";

import { Blocks } from "lucide-react";
import { LogoMark } from "@/components/brand/Logo";
import { Tau } from "@/components/brand/Tau";
import { Title } from "@/components/landing/Title";
import { ButtonLink } from "@/components/ui/Button";
import { useSubnet } from "@/lib/bittensor/useSubnet";
import { cn } from "@/lib/cn";

// One 5 s cycle, left to right (top to bottom on a phone): a cold pulse of money leaves Robinhood Chain, Inferno
// flares as it turns it into credits, a hot pulse carries the credits on, and Bittensor heats up and writes the
// answer line by line, then cools. Delays line each step up with the pulse's arrival. Reduced motion drops the
// pulses and holds Bittensor warm, its answer written.
const css = `
@keyframes chains-x { from { translate: -100% 0; } 24%, to { translate: 100% 0; } }
@keyframes chains-y { from { translate: 0 -100%; } 24%, to { translate: 0 100%; } }
@keyframes chains-flare {
  0%, 16%, 100% { scale: 1; filter: drop-shadow(0 0 0 transparent); }
  6% { scale: 1.1; filter: drop-shadow(0 0 14px var(--color-heat-3)); }
}
@keyframes chains-heat { from, to { opacity: 0.25; } 12%, 30% { opacity: 1; } }
@keyframes chains-write { from { scale: 0 1; } 7%, 50% { scale: 1 1; opacity: 1; } 75%, to { scale: 1 1; opacity: 0.2; } }`;

/** How do Robinhood Chain and Bittensor fit together? One carries the payment, the other works out the answer. */
export function TwoChains() {
  const { credits } = useSubnet();
  const status = credits ? "Live" : "When payments are on";

  return (
    <section id="two-chains" aria-labelledby="two-chains-title" className="mx-auto max-w-7xl px-5 py-24 sm:px-8 sm:py-32">
      <style href="landing-two-chains" precedence="default">
        {css}
      </style>
      <Title id="two-chains-title" q="How do Robinhood Chain and Bittensor fit together?">
        Two chains. Two jobs.
      </Title>

      <div className="mt-14 grid lg:grid-cols-[minmax(0,1fr)_13rem_minmax(0,1fr)]">
        {/* Money is a plain transfer, no compute, so this side stays cold. */}
        <article className="flex flex-col rounded-3xl border border-line-bright bg-night-2 bg-[radial-gradient(ellipse_at_top_left,color-mix(in_oklab,var(--color-heat-1)_70%,transparent),transparent_60%)] p-6 sm:p-8">
          <span className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-line-bright bg-night text-hush">
            <Blocks aria-hidden size={24} />
          </span>
          <h3 className="mt-6 text-2xl sm:text-3xl">Robinhood Chain moves the money.</h3>
          <p className="mt-3 max-w-[52ch] text-hush">
            Send USDG or $INFERNOAI, the Inferno coin, from your wallet to Inferno&apos;s treasury. It becomes credits
            once Ethereum finalizes the transfer, about 15 to 20 minutes after you send it.
          </p>
          <ul aria-label="What you can pay with" className="mt-6 flex flex-wrap gap-2 text-sm">
            {["USDG", "$INFERNOAI"].map((coin) => (
              <li key={coin} className={cn("rounded-full border px-3 py-1", credits ? "border-mint/50" : "border-line-bright")}>
                <span className="font-semibold text-mist">{coin}</span>{" "}
                <span className={cn("text-xs", credits ? "text-mint" : "text-hush")}>{status}</span>
              </li>
            ))}
            <li className="rounded-full border border-dashed border-line-bright px-3 py-1 text-hush">
              TAO via Chainlink CCIP: soon
            </li>
          </ul>
          <p className="mt-6 max-w-[52ch] text-[15px] text-hush">
            One USDG buys $1 of credit. $INFERNOAI counts at its live price: the lowest of the last 30 minutes on its
            Uniswap pool on Robinhood Chain, less 10%, checked every 5 minutes. Lenders are paid in USDG, by hand during
            the beta.
          </p>
          <div className="mt-auto pt-8">
            <ButtonLink href="/credits" variant="quiet">
              See today&apos;s prices
            </ButtonLink>
          </div>
        </article>

        {/* Inferno sits between them. The rails run down on a phone and across on a wide screen. */}
        <div className="grid justify-items-center lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-center lg:self-center">
          <Rail />
          <LogoMark className="h-16 w-16 motion-safe:animate-[chains-flare_5s_linear_0.3s_infinite_both]" />
          <p className="my-3 max-w-[26ch] text-center text-[15px] text-hush lg:col-span-3 lg:row-start-2 lg:mt-4 lg:mb-0 lg:px-3">
            <span className="block font-display text-lg font-bold text-mist">Inferno connects them.</span>
            Your transfer becomes credits. Credits pay for answers.
          </p>
          <Rail hot />
        </div>

        {/* Compute is heat: this side glows from where the credits arrive while each answer is worked out. */}
        <article className="relative isolate flex flex-col overflow-hidden rounded-3xl border border-heat-3/50 bg-night-2 p-6 sm:p-8">
          <span
            aria-hidden
            className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,color-mix(in_oklab,var(--color-heat-3)_40%,transparent),color-mix(in_oklab,var(--color-heat-2)_35%,transparent)_35%,transparent_75%)] motion-safe:animate-[chains-heat_5s_linear_1.3s_infinite_both] lg:bg-[radial-gradient(ellipse_at_left,color-mix(in_oklab,var(--color-heat-3)_40%,transparent),color-mix(in_oklab,var(--color-heat-2)_35%,transparent)_35%,transparent_75%)]"
          />
          <span className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-heat-3/70 bg-night text-heat-4 shadow-[0_0_40px_-6px_var(--color-heat-3)]">
            <Tau className="text-[1.75rem]" />
          </span>
          <h3 className="mt-6 text-2xl sm:text-3xl">
            <span className="heat-text">Bittensor does the thinking.</span>
          </h3>
          <p className="mt-3 max-w-[52ch] text-hush">
            Answers come from sealed miners on Bittensor subnet 64, run by Chutes, inside Intel TDX confidential-compute
            hardware. Your credits pay for each answer.
          </p>
          {/* The answer being written: tokens glow as they stream, then cool. */}
          <div aria-hidden className="flex flex-1 flex-col justify-center gap-3 pt-8">
            {["100%", "88%", "94%", "60%"].map((width, i) => (
              <span key={width} className="h-2 overflow-hidden rounded-full bg-night-3" style={{ width }}>
                <span
                  className="heat-fill block h-full origin-left motion-safe:animate-[chains-write_5s_linear_infinite_both]"
                  style={{ animationDelay: `${1.4 + i * 0.35}s` }}
                />
              </span>
            ))}
          </div>
          <div className="pt-8">
            <ButtonLink href="/chat?mode=bittensor">
              <Tau />
              Chat on Bittensor
            </ButtonLink>
          </div>
        </article>
      </div>

      <div className="mt-16 grid gap-x-16 gap-y-4 lg:grid-cols-12 lg:items-baseline">
        <h3 className="text-3xl sm:text-4xl lg:col-span-5">Your words never touch a chain.</h3>
        <p className="max-w-[56ch] text-lg text-hush lg:col-span-7">
          Only the payment goes on-chain. Your prompts and replies go to the sealed miner and back, and are never written
          to Robinhood Chain or to Bittensor.
        </p>
      </div>
    </section>
  );
}

/** A rail into or out of Inferno. Money runs cold into it; credits run hot out of it. */
function Rail({ hot }: { hot?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative h-16 w-1 overflow-hidden rounded-full lg:h-1 lg:w-full",
        hot ? "bg-heat-2/40 lg:col-start-3 lg:row-start-1" : "bg-line",
      )}
    >
      <span
        className={cn(
          "absolute inset-0 bg-linear-to-b from-transparent motion-reduce:hidden lg:bg-linear-to-r",
          hot
            ? "via-heat-3 to-heat-5 animate-[chains-y_5s_linear_0.7s_infinite_both] lg:animate-[chains-x_5s_linear_0.7s_infinite_both]"
            : "via-line-bright to-hush animate-[chains-y_5s_linear_infinite_both] lg:animate-[chains-x_5s_linear_infinite_both]",
        )}
      />
    </span>
  );
}
