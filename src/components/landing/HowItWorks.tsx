import { Blocks, Gpu, MessageSquareText } from "lucide-react";
import { Title } from "@/components/landing/Title";

// One 5 s cycle: a heat pulse leaves You, rides the first rail to the GPU, then the second rail to the chain.
// Each node heats as the pulse reaches it. Delays line the node glow up with the pulse's arrival.
const steps = [
  {
    Icon: MessageSquareText,
    title: "You ask",
    body: "Type in the chat. In private mode, your question never leaves your device.",
    node: "0s",
    rail: "0.6s",
  },
  {
    Icon: Gpu,
    title: "A GPU answers",
    body: "A Bittensor miner's, on subnet 64, inside sealed hardware, so the miner can't read your words. A lender's, picked by wallet address, in the network beta. Or your own, through WebGPU.",
    node: "1.1s",
    rail: "2s",
  },
  {
    Icon: Blocks,
    title: "The chain pays",
    body: "Payment per token, in USDG, $INFERNOAI or TAO, settles on Robinhood Chain. The lender keeps 70% (planned).",
    node: "2.45s",
  },
];

const css = `
@keyframes how-node {
  0%, 22%, 100% { color: var(--color-hush); border-color: var(--color-line-bright); box-shadow: 0 0 0 0 transparent; }
  6%, 14% { color: var(--color-heat-5); border-color: var(--color-heat-4); box-shadow: 0 0 44px -4px var(--color-heat-3); }
}
@keyframes how-x { from { translate: -100% 0; } 30%, to { translate: 100% 0; } }
@keyframes how-y { from { translate: 0 -100%; } 30%, to { translate: 0 100%; } }`;

export function HowItWorks() {
  return (
    <section id="how" aria-labelledby="how-title" className="mx-auto max-w-7xl px-5 py-24 sm:px-8 sm:py-32">
      <style href="landing-how" precedence="default">
        {css}
      </style>
      <Title id="how-title" q="How does it work?">
        One question, one GPU, one payment.
      </Title>
      <ol className="mt-16 grid lg:mt-20 lg:grid-cols-3">
        {steps.map(({ Icon, title, body, node, rail }) => (
          <li
            key={title}
            className="relative grid grid-cols-[3.5rem_minmax(0,1fr)] gap-x-5 pb-14 last:pb-0 lg:block lg:pr-12 lg:pb-0"
          >
            <span
              className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-line-bright bg-night-2 text-hush motion-safe:animate-[how-node_5s_linear_infinite_both]"
              style={{ animationDelay: node }}
            >
              <Icon aria-hidden size={24} />
            </span>
            {rail && (
              <span
                aria-hidden
                className="absolute top-16 bottom-2 left-7 w-1 -translate-x-1/2 overflow-hidden rounded-full bg-line lg:top-7 lg:right-2 lg:bottom-auto lg:left-16 lg:h-1 lg:w-auto lg:translate-x-0 lg:-translate-y-1/2"
              >
                <span
                  className="absolute inset-0 animate-[how-y_5s_linear_infinite_both] bg-[linear-gradient(to_bottom,transparent,var(--color-heat-2)_45%,var(--color-heat-4)_85%,var(--color-heat-5))] motion-reduce:hidden lg:animate-[how-x_5s_linear_infinite_both] lg:bg-[linear-gradient(to_right,transparent,var(--color-heat-2)_45%,var(--color-heat-4)_85%,var(--color-heat-5))]"
                  style={{ animationDelay: rail }}
                />
              </span>
            )}
            <div className="pt-3 lg:pt-8">
              <h3 className="text-2xl sm:text-3xl">{title}</h3>
              <p className="mt-3 max-w-[38ch] text-hush">{body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
