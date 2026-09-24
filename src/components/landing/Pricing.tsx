"use client";

import { useState } from "react";
import { Title } from "@/components/landing/Title";
import { formatInt, formatUsd } from "@/lib/format";
import { BITTENSOR_MARGIN } from "@/lib/bittensor/chutes";
import { LENDER_SHARE, USD_PER_1K_TOKENS } from "@/lib/relay/protocol";

const MIN_WORDS = 200;
const MAX_WORDS = 20_000;
const STEPS = 100;

/** Slider position to words a day on a log scale, rounded to 5, 50 or 500 so the readout stays readable. */
function wordsAt(pos: number) {
  const w = MIN_WORDS * (MAX_WORDS / MIN_WORDS) ** (pos / STEPS);
  const unit = 10 ** Math.floor(Math.log10(w)) / 20;
  return Math.round(w / unit) * unit;
}

/** A word is about 4/3 of a token (the 1.33 rule), over 30 days: 40 tokens a month per daily word. */
const tokensPerMonth = (wordsPerDay: number) => wordsPerDay * 40;

const models = [
  { name: "Private mode", detail: "Runs on your GPU, in your browser", usdPer1k: 0 },
  { name: "Network model", detail: `A lender's GPU, ${formatUsd(USD_PER_1K_TOKENS)} per 1,000 tokens`, usdPer1k: USD_PER_1K_TOKENS },
  {
    name: "Bittensor model",
    detail: `Chutes' price for the model, plus ${Math.round(BITTENSOR_MARGIN * 100)}% when you pay with credits`,
    usdPer1k: null,
  },
];

export function Pricing() {
  const [pos, setPos] = useState(STEPS / 2); // 2,000 words a day: $0.80 on the network
  const words = wordsAt(pos);
  const tokens = tokensPerMonth(words);

  return (
    <section id="pricing" aria-labelledby="pricing-title" className="mx-auto max-w-7xl px-5 py-24 sm:px-8 sm:py-32">
      <Title id="pricing-title" q="What does it cost?">
        Pay per token. Private mode is free.
      </Title>
      <div className="mt-14 grid gap-x-16 gap-y-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div>
          <p className="max-w-[52ch] text-lg text-hush">
            Network models charge for the tokens they read and write, and nothing else. No subscription, no minimum.
          </p>
          <p className="mt-4 max-w-[52ch] text-lg text-hush">
            Pay with Inferno credits: send USDG on Robinhood Chain and your balance shows up once the chain finalizes
            it, in about 16 minutes. It doesn&apos;t expire.
          </p>
          <p className="mt-8 max-w-[52ch] border-l-2 border-flame pl-4 text-[15px] text-mist">
            The lender whose GPU answers gets {Math.round(LENDER_SHARE * 100)}% of what you pay. During the beta, lender
            payouts go out by hand in USDG.
          </p>
        </div>

        <div>
          <label htmlFor="words-per-day" className="block text-mist">
            How much do you write with AI each day?
          </label>
          <p className="mt-4 font-display">
            <span className="wide tnum text-5xl font-black sm:text-6xl">{formatInt(words)}</span>
            <span className="ml-3 text-xl text-hush sm:text-2xl">words a day</span>
          </p>
          <input
            id="words-per-day"
            type="range"
            min={0}
            max={STEPS}
            value={pos}
            onChange={(e) => setPos(Number(e.target.value))}
            aria-valuetext={`${formatInt(words)} words a day`}
            className="mt-6 w-full cursor-pointer accent-flame"
          />
          <div aria-hidden className="tnum mt-1 flex justify-between text-sm text-hush">
            <span>{formatInt(MIN_WORDS)}</span>
            <span>{formatInt(MAX_WORDS)}</span>
          </div>

          <dl className="mt-10 border-b border-line">
            {models.map((m) => (
              <div key={m.name} className="flex items-baseline justify-between gap-6 border-t border-line py-4">
                <dt>
                  {m.name}
                  <span className="block text-sm text-hush">{m.detail}</span>
                </dt>
                <dd className="tnum shrink-0 text-right">
                  {m.usdPer1k === null ? (
                    <span className="text-hush">Varies by model</span>
                  ) : m.usdPer1k ? (
                    <>
                      {formatUsd((tokens / 1000) * m.usdPer1k)} <span className="text-hush">a month</span>
                    </>
                  ) : (
                    "Free"
                  )}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-sm text-hush">
            About {formatInt(tokens)} tokens a month. Models count text in tokens, roughly 1.33 per word.
          </p>
        </div>
      </div>
    </section>
  );
}
