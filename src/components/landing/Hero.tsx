"use client";

import { ButtonLink } from "@/components/ui/Button";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { HushCanvas } from "@/components/hush/HushCanvas";
import { DemoChat } from "@/components/landing/DemoChat";
import { useChainPulse } from "@/lib/useChainPulse";
import { formatInt } from "@/lib/format";
import { cn } from "@/lib/cn";

/** What is this? The one line, the two actions, a live demo chat, and the chain's heartbeat underneath. */
export function Hero() {
  const { status, latest } = useChainPulse();
  return (
    <section aria-labelledby="hero-title" className="relative -mt-16 flex min-h-[100svh] flex-col overflow-hidden pt-16">
      <div className="mx-auto grid w-full max-w-7xl gap-x-12 gap-y-14 px-5 pt-12 sm:px-8 sm:pt-20 lg:grid-cols-12 lg:items-center">
        <div className="lg:col-span-7">
          <h1 id="hero-title" className="wide text-[clamp(2.5rem,5.4vw,4.75rem)] leading-[0.92] font-black tracking-[-0.02em]">
            Chat with AI that runs on <span className="heat-text">GPUs people lend.</span>
          </h1>
          <p className="mt-8 max-w-[60ch] text-lg text-hush sm:text-xl">
            Ask anything and a GPU answers: yours, in your browser; one lent by someone on the network; or a Bittensor
            miner inside sealed hardware. Pay with credits on Robinhood Chain.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <ButtonLink href="/chat" size="lg">
              Start chatting
            </ButtonLink>
            <ButtonLink href="/lend" size="lg" variant="quiet">
              Mine with your GPU
            </ButtonLink>
          </div>
        </div>
        <DemoChat className="lg:col-span-5" />
      </div>

      {/* The staff fills whatever height the copy leaves, so its lines never run behind the text. */}
      <div className="relative mt-10 min-h-44 flex-1">
        <HushCanvas />
      </div>
      <p className="mx-auto flex w-full max-w-7xl items-baseline gap-2.5 px-5 pb-10 text-[15px] text-hush sm:px-8">
        <span
          aria-hidden
          className={cn(
            "h-1.5 w-1.5 shrink-0 -translate-y-0.5 rounded-full",
            status === "live" ? "animate-breathe bg-heat-5" : "bg-faint",
          )}
        />
        <span>
          {latest ? (
            <>
              Every spike on those lines is a real Robinhood Chain block. The chain is at block{" "}
              <AnimatedNumber value={Number(latest.number)} format={formatInt} className="text-mist" /> right now.
            </>
          ) : (
            "Every spike on those lines is a real Robinhood Chain block, about ten a second."
          )}
        </span>
      </p>
    </section>
  );
}
