"use client";

import Link from "next/link";
import { type ReactNode } from "react";
import { ExternalLink, LockKeyhole } from "lucide-react";
import { Tau } from "@/components/brand/Tau";
import { Title } from "@/components/landing/Title";
import { ButtonLink, buttonClass } from "@/components/ui/Button";
import { BITTENSOR_MARGIN } from "@/lib/bittensor/chutes";
import { useSubnet } from "@/lib/bittensor/useSubnet";
import { cn } from "@/lib/cn";

const link = "text-flame underline decoration-flame/40 underline-offset-4 hover:decoration-flame";

/** Is Bittensor in here? What it is, what Inferno uses, what's live on subnet 64 right now, and how to pay. */
export function BittensorSection() {
  const { models, loading, credits } = useSubnet();

  const ways: { term: string; status: string; live?: boolean; detail: ReactNode }[] = [
    {
      term: "Your own Chutes key",
      status: "Live",
      live: true,
      detail:
        "Paste a key from chutes.ai and answers bill your Chutes account, which takes TAO too. The key stays in your browser and goes only to Chutes.",
    },
    {
      term: "Inferno credits",
      status: credits ? "Live" : "When payments are on",
      live: credits,
      detail: (
        <>
          Send USDG or $INFERNOAI from your wallet to Inferno on Robinhood Chain; TAO through Chainlink CCIP is coming
          soon. Each answer costs Chutes&apos; price plus {Math.round(BITTENSOR_MARGIN * 100)}%, our planned margin. The{" "}
          <Link href="/credits" className={link}>
            credits page
          </Link>{" "}
          shows what this server takes today.
        </>
      ),
    },
  ];

  return (
    <section id="bittensor" aria-labelledby="bittensor-title" className="mx-auto max-w-7xl px-5 py-24 sm:px-8 sm:py-32">
      <Title id="bittensor-title" q="What powers the answers?">
        Powered by Bittensor.
      </Title>
      <div className="mt-14 grid gap-x-16 gap-y-14 lg:grid-cols-12 lg:items-center">
        <SealedChip className="lg:order-last lg:col-span-5" />

        <div className="lg:col-span-7">
          <p className="max-w-[56ch] text-lg text-hush">
            Bittensor is a decentralized network where miners compete to serve AI. The network pays them in TAO, its own
            coin.
          </p>
          <p className="mt-4 max-w-[56ch] text-lg text-hush">
            Inferno uses subnet 64, run by Chutes. Every model it lists there runs inside confidential-compute hardware, a
            sealed enclave that stops the miner reading your prompts.
          </p>

          <p className="mt-10 flex items-center gap-2.5 text-[15px] text-hush">
            <span
              aria-hidden
              className={cn("h-1.5 w-1.5 shrink-0 rounded-full", models?.length ? "animate-breathe bg-heat-5" : "bg-faint")}
            />
            {loading ? (
              "Asking subnet 64 which models are live…"
            ) : models === null ? (
              "Chutes' model list didn't load. The chat asks again when you open it."
            ) : models.length === 0 ? (
              "Chutes lists no sealed models right now."
            ) : (
              <span>
                <span className="tnum text-mist">{models.length}</span> sealed models live on subnet 64 right now, listed
                in the strip above.
              </span>
            )}
          </p>

          <h3 className="mt-12 text-2xl">Two ways to pay</h3>
          <dl className="mt-4 border-b border-line">
            {ways.map((w) => (
              <div key={w.term} className="border-t border-line py-5">
                <dt className="flex flex-wrap items-center gap-x-3 gap-y-1 font-display text-xl font-bold">
                  {w.term}
                  <span
                    className={cn(
                      "rounded-full border px-2.5 py-0.5 font-sans text-xs font-medium",
                      w.live ? "border-mint/50 text-mint" : "border-line-bright text-hush",
                    )}
                  >
                    {w.status}
                  </span>
                </dt>
                <dd className="mt-1.5 max-w-[56ch] text-hush">{w.detail}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-10 flex flex-wrap gap-3">
            <ButtonLink href="/chat?mode=bittensor" size="lg">
              Chat on Bittensor
            </ButtonLink>
            <a
              href="https://chutes.ai/privacy"
              target="_blank"
              rel="noreferrer"
              className={buttonClass({ variant: "quiet", size: "lg" })}
            >
              <ExternalLink aria-hidden size={16} />
              Chutes&apos; privacy policy
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * The signature: subnet 64 as a sealed chip. Heat means work, and here it stays inside: the enclave glows while the
 * package and its pins stay cold, because nothing readable leaves. Reduced motion holds the glow still.
 */
function SealedChip({ className }: { className?: string }) {
  // Seven pins per side, each centred in its slot. Written out whole so Tailwind finds the classes.
  const across =
    "absolute inset-x-[25%] h-[10%] bg-line-bright [mask-image:repeating-linear-gradient(90deg,transparent_0_3.6%,black_3.6%_10.7%,transparent_10.7%_14.286%)]";
  const down =
    "absolute inset-y-[25%] w-[10%] bg-line-bright [mask-image:repeating-linear-gradient(180deg,transparent_0_3.6%,black_3.6%_10.7%,transparent_10.7%_14.286%)]";
  return (
    <figure className={cn("mx-auto w-full max-w-[20rem] lg:max-w-[28rem]", className)}>
      <div aria-hidden className="@container relative aspect-square">
        <span className={cn(across, "top-0")} />
        <span className={cn(across, "bottom-0")} />
        <span className={cn(down, "left-0")} />
        <span className={cn(down, "right-0")} />
        <div className="absolute inset-[8%] rounded-[12%] border-2 border-line-bright bg-night-2">
          <span className="absolute top-[7%] left-[7%] size-[4%] rounded-full bg-line-bright" />
          <div className="absolute inset-[15%] flex flex-col items-center justify-center overflow-hidden rounded-[10%] border-2 border-dashed border-heat-3/70 bg-night">
            <span className="absolute inset-0 bg-[radial-gradient(circle,color-mix(in_oklab,var(--color-heat-2)_60%,transparent),transparent_70%)] motion-safe:animate-breathe" />
            <Tau className="relative text-heat-4 text-[length:26cqi] drop-shadow-[0_0_20px_var(--color-heat-3)] motion-safe:animate-breathe" />
            <span className="relative mt-2 flex items-center gap-1.5 text-[13px] text-hush">
              <LockKeyhole size={13} /> Sealed
            </span>
          </div>
        </div>
      </div>
      <figcaption className="mt-6 text-center text-[15px] text-hush">
        Subnet 64 runs each model inside a sealed enclave. The miner owns the hardware but can&apos;t look in.
      </figcaption>
    </figure>
  );
}
