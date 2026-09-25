import type { Metadata } from "next";
import { BittensorMining } from "@/components/lend/BittensorMining";
import { GpuEstimator } from "@/components/lend/GpuEstimator";
import { Rules } from "@/components/lend/Rules";
import { ServeNode } from "@/components/lend/ServeNode";
import { WalletCta } from "@/components/lend/WalletCta";
import { buttonClass } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { formatUsd } from "@/lib/format";
import { LENDER_SHARE, USD_PER_1K_TOKENS } from "@/lib/relay/protocol";

const share = `${Math.round(LENDER_SHARE * 100)}%`;

export const metadata: Metadata = {
  title: "Mine with your GPU",
  description: `Mine Bittensor's subnet 64 with data-center GPUs, or mine on Inferno from a browser tab and earn ${share} of each paid answer your GPU serves. Test your GPU and see which fits.`,
  alternates: { canonical: "/lend" },
};

const wrap = "mx-auto max-w-7xl px-5 sm:px-8";
const split = "grid gap-x-16 gap-y-10 py-20 sm:py-28 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]";

const lanes = [
  {
    href: "#mine-bittensor",
    title: "Mine on Bittensor, with data-center GPUs",
    detail: "Run open models for Chutes on subnet 64, inside confidential-compute servers, and earn subnet 64's alpha token.",
    status: "Live on Bittensor. Needs eight data-center GPUs, and TAO to register.",
  },
  {
    href: "#serve",
    title: "Mine on Inferno, right in your browser",
    detail:
      "Load an open model on your GPU and answer chats for people on Inferno. Any recent GPU with WebGPU, and nothing to install.",
    status: `Live beta. When the site has payments on, you earn ${share} of each answer, paid out by hand in USDG.`,
  },
];

const needs = [
  {
    term: "A GPU with enough memory",
    detail:
      "8 GB or more for small models. Large models need at least 24 GB, and a whole 70B-class model at 4-bit takes about 40 GB.",
  },
  {
    term: "A steady connection",
    detail:
      "Your computer stays online while you mine. Requests and answers are text, so an ordinary home connection is fine once the model has downloaded.",
  },
  {
    term: "A wallet on Robinhood Chain",
    detail: "Payouts go there, in USDG. MetaMask, Robinhood Wallet or any wallet that can add Robinhood Chain will do.",
  },
  {
    term: "The worker",
    detail: "You can serve from a browser tab today, on the beta relay, with nothing to install. A native app is planned.",
  },
];

const terms = [
  {
    term: "Paid per answer",
    detail: `People pay for network answers with Inferno credits, at ${formatUsd(USD_PER_1K_TOKENS)} per 1,000 tokens. You earn ${share} of each answer your GPU serves, and the ledger records it.`,
  },
  {
    term: "Paid out in USDG",
    detail: "During the beta, payouts go out by hand, in USDG, to the wallet you serve with. There's no payment contract.",
  },
  {
    term: "Only while payments are on",
    detail: "The site's operator turns payments on. While they're off, network chat is free and serving earns nothing.",
  },
  {
    term: "Vetted lenders",
    detail: "Planned. Today any wallet can serve on the beta relay, and chat only lists lenders whose wallet signed their key.",
  },
  { term: "Spot checks", detail: "Planned: prompts with known answers, to check you run the model you say you run." },
  {
    term: "Faked work isn't paid",
    detail: "You're paid for answers your GPU actually wrote. Once spot checks are live, an answer that fails one earns nothing.",
  },
];

export default function LendPage() {
  return (
    <>
      <section aria-labelledby="mine-title" className={cn(wrap, "pt-16 pb-20 sm:pt-24 sm:pb-28")}>
        {/* 2.5rem floor: "Bittensor," is the widest word and must fit 320px of content at a 360px viewport. */}
        <h1 id="mine-title" className="wide text-[clamp(2.5rem,7.5vw,6rem)] leading-[0.92]">
          <span className="block">Mine with your GPU.</span>
          <span className="heat-text block">On Bittensor, or in a browser.</span>
        </h1>
        <p className="mt-10 max-w-[58ch] text-lg text-hush sm:text-xl">
          Mining here means your GPU answers people&apos;s AI questions and earns for the work. There are two ways in, and the
          GPU you have decides which.
        </p>
        <ul className="mt-10 grid gap-4 md:grid-cols-2">
          {lanes.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                className="flex h-full flex-col rounded-3xl border border-line bg-night-2 p-6 transition-colors hover:border-line-bright sm:p-8"
              >
                <span className="wide font-display text-2xl leading-tight font-extrabold sm:text-3xl">{l.title}</span>
                <span className="mt-3 text-hush">{l.detail}</span>
                <span className="mt-auto pt-6">
                  <span className="block border-l border-line-bright pl-4 text-[15px] text-mist">{l.status}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
        <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
          <a href="#test" className={buttonClass({ variant: "quiet" })}>
            Test my GPU
          </a>
          <p className="text-[15px] text-hush">Not sure what yours can do? The test runs right in this tab.</p>
        </div>
      </section>

      <BittensorMining />

      <GpuEstimator />

      <ServeNode />

      <section id="need" aria-labelledby="need-title" className="border-t border-line">
        <div className={cn(wrap, split)}>
          <h2 id="need-title" className="wide text-4xl sm:text-6xl">
            What you need to mine on Inferno
          </h2>
          <Rules rows={needs} />
        </div>
      </section>

      <section aria-labelledby="paid-title" className="border-t border-line">
        <div className={cn(wrap, split)}>
          <div>
            <h2 id="paid-title" className="wide text-4xl sm:text-6xl">
              How Inferno pays you, and keeps you honest
            </h2>
            <p className="heat-text xwide tnum mt-10 font-display text-[clamp(4rem,14vw,9rem)] leading-none font-extrabold">
              {share}
            </p>
            <p className="mt-3 max-w-[40ch] text-hush">
              of what each answer costs goes to the lender whose GPU served it, while the site has payments on.
            </p>
          </div>
          <Rules rows={terms} />
        </div>
      </section>

      <section aria-labelledby="wallet-title" className="border-t border-line">
        <div className={cn(wrap, "py-20 sm:py-28")}>
          <h2 id="wallet-title" className="xwide text-[clamp(2.5rem,7vw,6rem)] leading-[0.95]">
            Start with a wallet
          </h2>
          <p className="mt-6 max-w-[60ch] text-lg text-hush">
            Your wallet address is how people pick you, and where your USDG goes. Connecting adds Robinhood Chain to your
            wallet and shows this page your address. Nothing is signed until you go online.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <WalletCta />
          </div>
        </div>
      </section>
    </>
  );
}
