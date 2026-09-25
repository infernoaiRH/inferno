"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { ArrowUp, ReceiptText } from "lucide-react";
import { LogoMark } from "@/components/brand/Logo";
import { cn } from "@/lib/cn";

/** Scripted exchanges. `rate` is the tokens/s on the receipt; it also sets the pacing and how hot the words glow. */
const SCRIPT = [
  {
    q: "What does a GPU do when I ask you something?",
    a: "It does the maths that picks each next word. A model is billions of numbers, and a GPU multiplies thousands of them at once. That's why a gaming card can write faster than you can read.",
    rate: 86,
    receipt: "Llama 3.1 8B on a lent RTX 4090. 212 tokens at 86 tokens/s. $0.0021, settled on Robinhood Chain.",
  },
  {
    q: "Can you answer without sending my question anywhere?",
    a: "Yes. Switch to private mode and I run on your own GPU, inside this browser tab. Your question and my answer never leave your device, and it costs nothing.",
    rate: 24,
    receipt: "Llama 3.2 1B on your GPU (Apple M3), in private mode. 96 tokens at 24 tokens/s. Free, and nothing left this tab.",
  },
  {
    q: "Is there a much bigger model that keeps my question private?",
    a: "Yes, on Bittensor. A miner on subnet 64 answers with a big open model like DeepSeek-V3.2, inside sealed hardware, so the miner can't read your words. Chutes' gateway passes them along in memory and doesn't keep them.",
    rate: 42,
    receipt: "Served on Bittensor subnet 64 (Chutes), confidential compute. DeepSeek-V3.2, 54 tokens at 42 tokens/s. $0.0001, billed to your Chutes account.",
  },
  {
    q: "I have a gaming PC. Could it earn?",
    a: "Yes. Start mining from the Lend page and your GPU answers people on Inferno's network, right in your browser. You keep 70% of what each answer costs when people pay with credits on Robinhood Chain. That split is planned.",
    rate: 58,
    receipt: "Qwen2.5 7B on a lent RTX 3090. 164 tokens at 58 tokens/s. $0.0016, settled on Robinhood Chain.",
  },
].map((ex) => ({ ...ex, words: ex.a.match(/\S+\s*/g) ?? [] }));
type Exchange = (typeof SCRIPT)[number];

// One frame per step: the question, then each word, then the receipt. A word is ~1.33 tokens, streamed at half the
// receipt's rate so it stays readable. `n` past the last word means the receipt is showing.
const FRAMES = SCRIPT.flatMap(({ words, rate }, k) => [
  { k, n: 0, wait: 700 },
  ...words.map((_, i) => ({ k, n: i + 1, wait: i < words.length - 1 ? 2667 / rate : 1200 })),
  { k, n: words.length + 1, wait: 5000 },
]);
const STILL = SCRIPT[0].words.length + 1; // reduced motion: the first answer, finished

const REDUCE = "(prefers-reduced-motion: reduce)";
const onReduceChange = (cb: () => void) => {
  const m = matchMedia(REDUCE);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};

// The heat trace, tuned like /chat's (src/components/chat/Heat.module.css): a new word lands hot and cools to text
// colour in 1 to 1.5 s. --heat (0 to 1) follows tokens/s, so faster writing glows wider and cools slower.
const css = `
@keyframes heat-cool {
  from { color: var(--color-heat-5); text-shadow: 0 0 calc(var(--heat, 0.5) * 18px) var(--color-heat-4); }
  30% { color: var(--color-heat-4); }
  65% { color: var(--color-heat-3); text-shadow: 0 0 0 transparent; }
  to { color: var(--color-mist); text-shadow: 0 0 0 transparent; }
}
.heat-word { animation: heat-cool calc(1s + var(--heat, 0.5) * 0.5s) linear both; }`;
const heatOf = (tps: number) => Math.min(1, Math.sqrt(tps / 80)); // same curve as /chat

/** The hero's live demo: a scripted chat that streams with the heat trace and prints a receipt under each answer. */
export function DemoChat({ className }: { className?: string }) {
  const ref = useRef<HTMLElement>(null);
  const still = useSyncExternalStore(onReduceChange, () => matchMedia(REDUCE).matches, () => false);
  const [onScreen, setOnScreen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting));
    if (ref.current) io.observe(ref.current);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (still || !onScreen) return;
    const t = setTimeout(() => setStep((s) => (s + 1) % FRAMES.length), FRAMES[step].wait);
    return () => clearTimeout(t);
  }, [still, onScreen, step]);

  const { k, n } = FRAMES[still ? STILL : step];
  const prev = (k + SCRIPT.length - 1) % SCRIPT.length;

  return (
    <figure
      ref={ref}
      aria-label="Demo chat"
      className={cn(
        "overflow-hidden rounded-3xl border border-line-bright bg-night-2 shadow-[0_40px_120px_-48px_var(--color-heat-3)]",
        className,
      )}
    >
      <style href="heat-trace" precedence="default">
        {css}
      </style>
      <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-3.5">
        <span className="flex items-center gap-2 text-[15px] font-medium">
          <LogoMark className="h-6 w-6" />
          Inferno chat
        </span>
        <span className="rounded-full border border-flame/60 px-2.5 py-0.5 text-[13px] font-semibold text-flame">Demo</span>
      </div>
      <div
        aria-hidden
        className="flex h-[23rem] flex-col justify-end gap-8 overflow-hidden px-5 pt-5 pb-4 [mask-image:linear-gradient(to_bottom,transparent,black_4rem)] sm:h-[25rem]"
      >
        <Turn key={prev} ex={SCRIPT[prev]} />
        <Turn key={k} ex={SCRIPT[k]} n={n} />
      </div>
      <Link
        href="/chat"
        className="mx-3 mb-3 flex h-12 items-center justify-between gap-3 rounded-2xl border border-line bg-night pr-1.5 pl-4 text-[15px] text-hush transition-colors hover:border-flame/60 hover:text-mist"
      >
        Ask your own question
        <span aria-hidden className="flex h-9 w-9 items-center justify-center rounded-xl bg-flame text-night">
          <ArrowUp size={18} />
        </span>
      </Link>
      <div className="sr-only">
        <p>A scripted demo, not a live chat.</p>
        {SCRIPT.map((ex) => (
          <p key={ex.q}>
            Question: {ex.q} Answer: {ex.a} Receipt: {ex.receipt}
          </p>
        ))}
      </div>
    </figure>
  );
}

/** One question and answer. Without `n` it's finished history; with it, the answer streams word by word. */
function Turn({ ex, n }: { ex: Exchange; n?: number }) {
  return (
    <div className="animate-rise">
      <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-night-3 px-4 py-2.5 text-[15px] leading-snug">{ex.q}</p>
      <p className="mt-4 text-[15px] leading-relaxed" style={{ "--heat": heatOf(ex.rate) } as CSSProperties}>
        {n === undefined ? (
          ex.a
        ) : n === 0 ? (
          <span className="inline-block h-2 w-2 animate-breathe rounded-full bg-heat-4" />
        ) : (
          ex.words.slice(0, n).map((w, i) => (
            <span key={i} className="heat-word">
              {w}
            </span>
          ))
        )}
      </p>
      {(n === undefined || n > ex.words.length) && (
        <p className="mt-3 flex animate-rise gap-2 border-t border-dashed border-line-bright pt-3 text-[13px] leading-snug text-hush">
          <ReceiptText aria-hidden size={15} className="mt-px shrink-0" />
          {ex.receipt}
        </p>
      )}
    </div>
  );
}
