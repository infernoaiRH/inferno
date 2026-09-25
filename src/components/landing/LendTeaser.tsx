import { Gpu, Pickaxe } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { Title } from "@/components/landing/Title";
import { cn } from "@/lib/cn";

const lanes = [
  {
    Icon: Pickaxe,
    title: "Mine on Bittensor",
    status: "Outside the browser",
    live: false,
    where: "For data-center GPUs, on your own servers, as a miner on subnet 64.",
    facts: [
      {
        term: "What you do",
        detail: "Run a Chutes miner. It serves open models to everyone who uses Chutes, Inferno's Bittensor chat included.",
      },
      {
        term: "What you earn",
        detail:
          "Subnet 64's alpha token, which swaps for TAO, paid by the Bittensor network rather than Inferno. Validators score every miner, so earnings follow how well yours serves.",
      },
      {
        term: "What you need",
        detail:
          "A server of data-center GPUs (Chutes tests 8× H200, B200 or RTX Pro 6000) running as Intel TDX confidential VMs, a Bittensor wallet registered on subnet 64, and TAO for the registration fee.",
      },
    ],
    href: "/lend#mine-bittensor",
    cta: "See the Bittensor mining guide",
  },
  {
    Icon: Gpu,
    title: "Mine on Inferno",
    status: "Live beta",
    live: true,
    where: "From any computer with a WebGPU browser, like a gaming PC. Nothing to install.",
    facts: [
      {
        term: "What you do",
        detail:
          "Load a model in a browser tab and go online. Your GPU answers chats on Inferno's own network, for people who pick you by wallet address.",
      },
      {
        term: "What you earn",
        detail:
          "70% of what each answer costs, when people pay with credits on Robinhood Chain. The split is planned, and during the beta payouts are sent by hand.",
      },
      { term: "What you need", detail: "A GPU with 8 GB or more, a recent Chrome or Edge, and a wallet on Robinhood Chain." },
    ],
    href: "/lend#serve",
    cta: "Start mining in your browser",
  },
];

// The meter idles cold, heats up as requests arrive, holds busy, then cools. Reduced motion shows it busy.
const css = `
@keyframes lend-meter {
  0%, 10% { clip-path: inset(0 96% 0 0); }
  55%, 88% { clip-path: inset(0 6% 0 0); }
  100% { clip-path: inset(0 96% 0 0); }
}`;

/** Can my GPU earn? Mining, two ways: in a browser on Inferno's own network, or on Bittensor with data-center GPUs. */
export function LendTeaser() {
  return (
    <section id="mine" aria-labelledby="mine-title" className="mx-auto max-w-7xl px-5 py-24 sm:px-8 sm:py-32">
      <style href="landing-lend" precedence="default">
        {css}
      </style>
      <Title id="mine-title" q="Can my GPU earn?">
        Mine with your GPU.
      </Title>
      <div className="mt-12 grid gap-x-16 gap-y-12 lg:grid-cols-12 lg:items-end">
        <p className="max-w-[52ch] text-lg text-hush lg:col-span-5">
          Mining here means your GPU answers people&apos;s AI questions and gets paid for the work. There are two ways in,
          depending on the GPU.
        </p>
        <figure className="lg:col-span-7">
          <p className="text-[15px] text-hush">GPU utilisation</p>
          {/* Twenty cells, like a level meter. The ramp spans the whole track, so only a busy GPU reaches the hot end. */}
          <div className="relative mt-4 h-20 sm:h-28">
            <div className="heat-fill absolute inset-0 opacity-15 [mask-image:repeating-linear-gradient(90deg,black_0_calc(5%_-_5px),transparent_calc(5%_-_5px)_5%)]" />
            <div className="heat-fill absolute inset-0 [clip-path:inset(0_6%_0_0)] [mask-image:repeating-linear-gradient(90deg,black_0_calc(5%_-_5px),transparent_calc(5%_-_5px)_5%)] motion-safe:animate-[lend-meter_7s_var(--ease-quiet)_infinite]" />
          </div>
          <p aria-hidden className="mt-3 flex justify-between text-[15px] text-hush">
            <span>Idle</span>
            <span>Serving requests</span>
          </p>
          <figcaption className="mt-5 text-[15px] text-hush">Illustrative: a mining GPU heating up as questions arrive.</figcaption>
        </figure>
      </div>

      <div className="mt-14 grid gap-6 lg:grid-cols-2">
        {lanes.map((l) => (
          <article key={l.title} className="flex flex-col rounded-3xl border border-line-bright bg-night-2 p-6 sm:p-8">
            <div className="flex items-center justify-between gap-4">
              <l.Icon aria-hidden size={28} className="text-flame" />
              <span
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-xs font-medium",
                  l.live ? "border-mint/50 text-mint" : "border-line-bright text-hush",
                )}
              >
                {l.status}
              </span>
            </div>
            <h3 className="mt-6 text-3xl">{l.title}</h3>
            <p className="mt-2 text-hush">{l.where}</p>
            <dl className="mt-6 mb-8 border-b border-line">
              {l.facts.map((f) => (
                <div key={f.term} className="border-t border-line py-4">
                  <dt className="font-display text-lg font-bold">{f.term}</dt>
                  <dd className="mt-1 text-hush">{f.detail}</dd>
                </div>
              ))}
            </dl>
            {/* Long labels wrap on a phone instead of pushing past the card. */}
            <ButtonLink href={l.href} size="lg" className="mt-auto h-auto min-h-12 self-start py-3 text-center whitespace-normal">
              {l.cta}
            </ButtonLink>
          </article>
        ))}
      </div>
    </section>
  );
}
