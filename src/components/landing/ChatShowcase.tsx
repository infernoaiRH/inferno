import { Check, ChevronDown, Gpu, Laptop } from "lucide-react";
import { Tau } from "@/components/brand/Tau";
import { ButtonLink } from "@/components/ui/Button";
import { Title } from "@/components/landing/Title";
import { cn } from "@/lib/cn";

const features = [
  { term: "Heat trace", detail: "Words arrive hot and cool as they settle. The faster the GPU, the hotter they burn." },
  { term: "Receipts", detail: "Every answer ends with what it cost, which model wrote it and where it ran." },
  { term: "Private mode", detail: "The model runs on your own GPU. Nothing leaves the tab, and it's free." },
  {
    term: "Model choice",
    detail: "SmolLM2 360M, Llama 3.2 1B and Qwen2.5 1.5B run in your browser, or on a lender's GPU in the network beta. For much bigger models, like DeepSeek, Qwen3.5 397B, Kimi and GLM, switch to Bittensor.",
  },
];

const models = [
  { name: "SmolLM2 360M", size: "380 MB" },
  { name: "Llama 3.2 1B", size: "880 MB", picked: true },
  { name: "Qwen2.5 1.5B", size: "1.6 GB" },
];

// The answer the moment it finished: its last words are still cooling, hottest last.
const ANSWER = "A token is a chunk of text, often part of a word. Models read and write in tokens, and that's what you pay for: about four tokens for every three words.".split(" ");
const COOLING = ["text-heat-5 [text-shadow:0_0_14px_var(--color-heat-4)]", "text-heat-5", "text-heat-4", "text-heat-4", "text-heat-3", "text-heat-3"];

/** Why is the chat different? The four things it does, beside a still of the chat itself. */
export function ChatShowcase() {
  return (
    <section id="chat" aria-labelledby="chat-title" className="mx-auto max-w-7xl px-5 py-24 sm:px-8 sm:py-32">
      <Title id="chat-title" q="Why is the chat different?">
        It shows the work behind every answer.
      </Title>
      <div className="mt-14 grid gap-x-16 gap-y-16 lg:grid-cols-12 lg:items-center">
        <div className="lg:col-span-5">
          <dl className="border-b border-line">
            {features.map((f) => (
              <div key={f.term} className="border-t border-line py-5">
                <dt className="font-display text-xl font-bold">{f.term}</dt>
                <dd className="mt-1.5 max-w-[48ch] text-hush">{f.detail}</dd>
              </div>
            ))}
          </dl>
          <ButtonLink href="/chat" size="lg" className="mt-10">
            Open the chat
          </ButtonLink>
        </div>

        {/* A still of the chat, open on its model menu. Decorative: the list beside it says the same in words. */}
        <div aria-hidden className="lg:col-span-7">
          <div className="ml-auto w-72 max-w-full rounded-2xl border border-line-bright bg-night-3 p-2 text-[15px] shadow-2xl shadow-night sm:mr-4">
            <p className="px-3 pt-1 pb-2 text-[13px] text-hush">In your browser, today</p>
            {models.map((m) => (
              <p
                key={m.name}
                className={cn("flex items-center gap-2.5 rounded-xl px-3 py-2", m.picked ? "bg-night-2 text-mist" : "text-hush")}
              >
                <Check size={15} className={m.picked ? "text-flame" : "invisible"} />
                {m.name}
                <span className="tnum ml-auto text-[13px] text-hush">{m.size}</span>
              </p>
            ))}
            <p className="mt-1 border-t border-line px-3 pt-2.5 pb-1.5 text-[13px] text-hush">
              Or pick a lender by wallet address: network beta
            </p>
            <p className="px-3 pb-1.5 text-[13px] text-hush">Or ask Bittensor for DeepSeek, Kimi and more</p>
          </div>

          <div className="relative -mt-3 rounded-3xl border border-line-bright bg-night-2 shadow-[0_40px_120px_-48px_var(--color-heat-2)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 text-[13px]">
              <span className="flex rounded-full border border-line p-1">
                <span className="flex items-center gap-1.5 px-3 py-1 text-hush">
                  <Tau className="hidden text-[14px] sm:block" /> Bittensor
                </span>
                <span className="flex items-center gap-1.5 rounded-full bg-night-3 px-3 py-1 text-mist">
                  <Laptop size={14} className="hidden sm:block" /> Private
                </span>
                <span className="flex items-center gap-1.5 px-3 py-1 text-hush">
                  <Gpu size={14} className="hidden sm:block" /> Network
                </span>
              </span>
              <span className="flex items-center gap-1.5 rounded-full border border-flame/60 px-3 py-1.5">
                Llama 3.2 1B <ChevronDown size={14} />
              </span>
            </div>

            <div className="px-5 pt-6 pb-5 sm:px-7">
              <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-night-3 px-4 py-2.5 text-[15px]">
                Explain tokens like I&apos;m new to this.
              </p>
              <p className="mt-5 text-base leading-relaxed sm:text-[17px]">
                {ANSWER.map((w, i) => (
                  <span key={i} className={COOLING[ANSWER.length - 1 - i]}>
                    {w}{" "}
                  </span>
                ))}
              </p>
              <dl className="tnum mt-6 grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-1.5 border-t border-dashed border-line-bright pt-4 text-[14px] [&_dt]:text-hush">
                <dt>Model</dt>
                <dd>Llama 3.2 1B</dd>
                <dt>Ran on</dt>
                <dd>Your GPU, Apple M3, in private mode</dd>
                <dt>Speed</dt>
                <dd className="flex items-center gap-3">
                  24 tokens/s
                  <span className="h-1.5 w-24 overflow-hidden rounded-full bg-night-3">
                    {/* The ramp spans the whole track, so a slow run only reaches the cold end. */}
                    <span className="heat-fill block h-full w-[28%]" style={{ backgroundSize: "6rem 100%" }} />
                  </span>
                </dd>
                <dt>Tokens</dt>
                <dd>61</dd>
                <dt>Cost</dt>
                <dd>Free. Nothing left this tab.</dd>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
