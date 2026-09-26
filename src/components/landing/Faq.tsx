import { Plus } from "lucide-react";
import { Title } from "@/components/landing/Title";

const faqs = [
  {
    q: "What is Bittensor, and how does Inferno use it?",
    a: "Bittensor is a decentralized network where miners compete to serve AI, and the network pays them in TAO. Inferno's Bittensor mode asks subnet 64, run by Chutes, where miners serve big open models inside confidential-compute hardware, so they can't read your prompts. Chutes' gateway handles your words in memory and, by its privacy policy, doesn't store them.",
  },
  {
    q: "Can I pay with the Inferno coin?",
    a: "Yes. Send $INFERNOAI from your wallet to Inferno's treasury on Robinhood Chain, and it's credited at its live price: the lowest of the last 30 minutes on its Uniswap pool, less 10%, checked every 5 minutes. The credits page shows today's price.",
  },
  {
    q: "Can I pay with TAO?",
    a: "Not yet, soon. TAO reaches Robinhood Chain through Chainlink's CCIP bridge, and that's how you'll pay with it. For now, if you use your own Chutes key, Chutes takes TAO directly.",
  },
  {
    q: "Is Inferno part of Robinhood?",
    a: "No. Inferno is independent and built on Robinhood Chain, a public network anyone can build on. It isn't affiliated with or endorsed by Robinhood Markets.",
  },
  {
    q: "Do I need a wallet?",
    a: "Not to chat in private mode, or on Bittensor with your own Chutes key. You need one to pay with Inferno credits, to mine with your GPU and get paid, and to send sealed messages.",
  },
  {
    q: "Which models can I run now?",
    a: "SmolLM2 360M, Llama 3.2 1B and Qwen2.5 1.5B, in private mode on your own GPU, or on a lender's GPU in the network beta. The first load downloads the model once, from about 400 MB to 2 GB, and your browser keeps it. For much bigger models, like DeepSeek, Qwen3.5 397B, Kimi and GLM, switch to Bittensor mode.",
  },
  {
    q: "How does mining pay?",
    a: "On Inferno, your GPU earns 70% of what each answer it serves costs, when people pay with credits on Robinhood Chain. The split is planned, and during the beta payouts are sent by hand, in USDG. On Bittensor, the network pays miners in subnet 64's alpha token, which swaps for TAO; Inferno isn't involved.",
  },
  {
    q: "What stops a lender from faking work?",
    a: "Today, less than we'd like. Every lender signs its node key with its wallet, so you know which address served you, and you're never billed for more text than you actually received. Spot checks with known prompts, to confirm each GPU runs the model it lists, are planned.",
  },
  {
    q: "Is my chat stored?",
    a: "In private mode your chat stays in your browser, and you can delete it. On the network, Inferno doesn't store prompts, but the lender whose GPU serves a request can read it.",
  },
  {
    q: "Why Robinhood Chain?",
    a: "A new block lands about every 0.1 seconds and fees are low, so paying per token is practical. USDG is native to the chain, and it settles to Ethereum.",
  },
];

export function Faq() {
  return (
    <section id="faq" aria-labelledby="faq-title" className="mx-auto max-w-7xl px-5 py-24 sm:px-8 sm:py-32">
      <Title id="faq-title" q="Anything else?">
        Questions people ask
      </Title>
      <div className="mt-14 max-w-4xl border-b border-line">
        {faqs.map((f) => (
          <details key={f.q} className="group border-t border-line">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-6 font-display text-xl font-bold transition-colors hover:text-flame sm:text-2xl [&::-webkit-details-marker]:hidden">
              {f.q}
              <Plus aria-hidden size={22} className="shrink-0 transition-transform duration-300 ease-quiet group-open:rotate-45" />
            </summary>
            <p className="max-w-[62ch] pb-7 text-lg text-hush">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
