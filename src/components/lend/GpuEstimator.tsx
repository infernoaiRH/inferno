"use client";

import { useState, useSyncExternalStore } from "react";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { Button } from "@/components/ui/Button";
import { BenchError, hasWebGPU, runBench, type BenchResult } from "@/lib/gpu/bench";
import { MODELS, REFERENCE_GPUS, SIZES, earnings, tokensPerSecond } from "@/lib/gpu/estimate";
import { formatInt, formatUsd } from "@/lib/format";
import { cn } from "@/lib/cn";

type Run = { state: "idle" } | { state: "running"; done: number; total: number; gbps?: number } | { state: "failed"; message: string };
type Source = { id: string; name: string; gbps: number; memGB?: number; upTo?: boolean };

const wrap = "mx-auto max-w-7xl px-5 sm:px-8";
const noop = () => () => {};

/** The gauge reads on a log scale from 10 to 2,000 GB/s, marked with three reference cards. */
const scale = (gbps: number) => Math.min(1, Math.max(0, Math.log(gbps / 10) / Math.log(200)));
const TICKS = [
  ["Apple M2", 100],
  ["RTX 3060", 360],
  ["RTX 4090", 1008],
] as const;
const SEGMENTS = "repeating-linear-gradient(90deg, var(--color-night) 0 10px, transparent 10px 14px)";

const decimal = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
const wordy = new Intl.NumberFormat("en-US", { notation: "compact", compactDisplay: "long", maximumFractionDigits: 1 });
const speed = (tps: number) => (tps < 10 ? decimal.format(tps) : formatInt(tps));
const usdg = (n: number | undefined) => {
  if (n === undefined) return "–";
  const digits = n < 1000 ? 2 : 0;
  return n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
};
const bytes = (n: number) => (n >= 2 ** 30 ? `${decimal.format(n / 2 ** 30)} GB` : `${formatInt(n / 2 ** 20)} MB`);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** "Test my GPU" and "What it could earn": the benchmark or a picked card drives both. */
export function GpuEstimator() {
  const webgpu = useSyncExternalStore(noop, hasWebGPU, () => true);
  const [run, setRun] = useState<Run>({ state: "idle" });
  const [mine, setMine] = useState<BenchResult | null>(null);
  const [pick, setPick] = useState("rtx-3060");
  const [hours, setHours] = useState(8);
  const [busy, setBusy] = useState(30);
  const [want, setWant] = useState<keyof typeof SIZES>("small");

  const sources: Source[] = mine ? [{ id: "mine", name: "Your GPU, tested here", gbps: mine.gbps }, ...REFERENCE_GPUS] : REFERENCE_GPUS;
  const source = sources.find((s) => s.id === pick) ?? sources[0];
  const tested = source.id === "mine";
  const who = tested ? "your GPU" : `the ${source.name}`;
  const tooBig = (gb: number) => source.memGB !== undefined && gb > source.memGB;
  const served = tooBig(SIZES.large.model.gb) ? SIZES.small : SIZES[want];
  const tps = tokensPerSecond(source.gbps, served.model.gb, tested);
  const e = earnings(tps, hours, busy / 100, served.credits);

  const running = run.state === "running";
  const reading = (running ? run.gbps : mine?.gbps) ?? 0;
  const status = running
    ? run.done === 0
      ? "Warming up your GPU…"
      : `Pass ${run.done} of ${run.total}`
    : run.state === "failed"
      ? run.message
      : mine
        ? `Done. Your GPU moved about ${formatInt(mine.gbps)} GB of memory a second.`
        : webgpu
          ? "It takes a few seconds. Nothing downloads, and nothing leaves this page."
          : "This browser doesn't have WebGPU, so it can't test your GPU from here. Try a recent Chrome, Edge or Safari on a computer, or pick your card from the list below.";

  async function test() {
    setRun({ state: "running", done: 0, total: 1 });
    try {
      const result = await runBench((done, total, gbps) => setRun({ state: "running", done, total, gbps }));
      setMine(result);
      setPick("mine");
      setRun({ state: "idle" });
    } catch (err) {
      setRun({
        state: "failed",
        message:
          err instanceof BenchError ? err.message : "The test stopped before it finished. Try again, or pick your card from the list below.",
      });
    }
  }

  return (
    <>
      <section id="test" aria-labelledby="test-title" className="border-t border-line">
        <div className={cn(wrap, "grid gap-x-16 gap-y-12 py-20 sm:py-28 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]")}>
          <div>
            <h2 id="test-title" className="wide text-4xl sm:text-6xl">
              Test my GPU
            </h2>
            <p className="mt-5 max-w-[52ch] text-hush">
              To write each token, about three quarters of a word, a model reads all of its weights from GPU memory. So how
              fast your card moves memory sets how fast it can answer. This test measures that with WebGPU, right in this tab.
            </p>
            <Button size="lg" className="mt-8" onClick={() => void test()} disabled={!webgpu || running}>
              {running ? "Testing…" : mine ? "Test again" : "Test my GPU"}
            </Button>
            <p aria-live="polite" className={cn("mt-4 max-w-[52ch] text-[15px]", run.state === "failed" ? "text-ember" : "text-hush")}>
              {status}
            </p>
          </div>

          <div>
            <p className="flex flex-wrap items-baseline gap-x-4">
              <AnimatedNumber
                value={reading}
                format={(n) => formatInt(n ?? 0)}
                className="wide font-display text-[clamp(3.5rem,15vw,9rem)] leading-none font-extrabold"
              />
              <span className="text-xl text-hush sm:text-2xl">GB/s</span>
            </p>
            <p className="mt-3 text-hush">Memory bandwidth, estimated in this browser</p>
            <Gauge value={reading} running={running} />
            {mine && (
              <dl className="mt-6 grid gap-x-8 gap-y-4 border-t border-line pt-5 text-[15px] sm:grid-cols-3">
                <div>
                  <dt className="text-hush">GPU</dt>
                  <dd className="mt-1">{mine.name || "Not reported by your browser"}</dd>
                </div>
                <div>
                  <dt className="text-hush">Largest block the browser allows</dt>
                  <dd className="tnum mt-1">{bytes(mine.maxBufferSize)}</dd>
                </div>
                <div>
                  <dt className="text-hush">Test data</dt>
                  <dd className="tnum mt-1">{bytes(mine.testBytes)}</dd>
                </div>
              </dl>
            )}
          </div>
        </div>

        <div className={cn(wrap, "grid gap-x-16 gap-y-14 pb-20 sm:pb-28 lg:grid-cols-2")}>
          <fieldset>
            <legend className="font-display text-2xl font-extrabold">Which GPU?</legend>
            <p className="mt-2 max-w-[52ch] text-[15px] text-hush">
              Not on the computer with the GPU? Pick its card instead. Card figures are approximate, from spec sheets.
            </p>
            <div className="mt-5 border-b border-line">
              {sources.map((s) => (
                <label
                  key={s.id}
                  className="grid cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 border-t border-line px-2 py-3 transition-colors hover:bg-night-2 has-checked:bg-night-2"
                >
                  <input
                    type="radio"
                    name="gpu"
                    checked={s.id === source.id}
                    onChange={() => setPick(s.id)}
                    className="accent-flame"
                  />
                  <span>{s.name}</span>
                  <span className="tnum text-right text-[15px]">
                    {formatInt(s.gbps)} GB/s
                    <span className="block text-hush sm:ml-4 sm:inline">
                      {s.memGB === undefined ? "Memory not reported" : `${s.upTo ? "Up to " : ""}${s.memGB} GB`}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <h3 className="text-2xl">Estimated speed</h3>
            <p className="mt-2 text-[15px] text-hush">For {who}, with 4-bit models, one conversation at a time.</p>
            <table className="mt-5 w-full border-b border-line text-left">
              <thead>
                <tr className="text-[15px] text-hush">
                  <th scope="col" className="pb-2 font-normal">
                    Model
                  </th>
                  <th scope="col" className="pb-2 font-normal">
                    Size
                  </th>
                  <th scope="col" className="pb-2 text-right font-normal">
                    Tokens a second
                  </th>
                </tr>
              </thead>
              <tbody>
                {MODELS.map((m) => (
                  <tr key={m.id} className="border-t border-line">
                    <th scope="row" className="py-3 font-normal">
                      {m.name}
                    </th>
                    <td className="tnum text-hush">{m.gb} GB</td>
                    <td className="tnum text-right">
                      {tooBig(m.gb) ? (
                        <span className="text-hush">Won&apos;t fit in {source.memGB} GB</span>
                      ) : (
                        `About ${speed(tokensPerSecond(source.gbps, m.gb, tested))}`
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-4 text-[15px] text-hush">
              {tested
                ? "Speed is your tested bandwidth × 0.65 ÷ model size. Answering never reaches a card's spec bandwidth, and a tested figure is already below spec, so it takes off less than the 0.55 used for cards from the list."
                : "Speed is bandwidth × 0.55 ÷ model size, because answering never quite reaches a card's spec bandwidth."}
              {source.memGB === undefined && " Browsers don't report GPU memory, so check your card has room for the model."}
            </p>
          </div>
        </div>
      </section>

      <section id="earn" aria-labelledby="earn-title" className="border-t border-line">
        <div className={cn(wrap, "grid gap-x-16 gap-y-12 py-20 sm:py-28 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]")}>
          <div>
            <h2 id="earn-title" className="wide text-4xl sm:text-6xl">
              What it could earn
            </h2>
            <p className="mt-5 text-hush">
              For {who}. {source.id === "mine" ? "The figures come from your test." : "Test your GPU or pick another card to change it."}
            </p>

            <div className="mt-10 space-y-9">
              <div>
                <div className="flex items-baseline justify-between gap-4">
                  <label htmlFor="lend-hours">Hours a day you lend</label>
                  <output htmlFor="lend-hours" className="tnum font-display text-2xl font-extrabold">
                    {hours}
                  </output>
                </div>
                <input
                  id="lend-hours"
                  type="range"
                  min={1}
                  max={24}
                  value={hours}
                  onChange={(ev) => setHours(Number(ev.target.value))}
                  aria-valuetext={`${plural(hours, "hour")} a day`}
                  className="mt-3 w-full cursor-pointer accent-flame"
                />
              </div>
              <div>
                <div className="flex items-baseline justify-between gap-4">
                  <label htmlFor="lend-busy">How busy it stays</label>
                  <output htmlFor="lend-busy" className="tnum font-display text-2xl font-extrabold">
                    {busy}%
                  </output>
                </div>
                <input
                  id="lend-busy"
                  type="range"
                  min={5}
                  max={100}
                  step={5}
                  value={busy}
                  onChange={(ev) => setBusy(Number(ev.target.value))}
                  aria-valuetext={`${busy}% of those hours`}
                  aria-describedby="lend-busy-note"
                  className="mt-3 w-full cursor-pointer accent-flame"
                />
                <p id="lend-busy-note" className="mt-2 text-[15px] text-hush">
                  The share of those hours your GPU spends answering requests.
                </p>
              </div>
              <fieldset>
                <legend>Model you serve</legend>
                <div className="mt-3 border-b border-line">
                  {(["small", "large"] as const).map((k) => {
                    const s = SIZES[k];
                    const off = tooBig(s.model.gb);
                    return (
                      <label
                        key={k}
                        className={cn(
                          "flex gap-3 border-t border-line px-2 py-3",
                          off ? "cursor-not-allowed" : "cursor-pointer transition-colors hover:bg-night-2 has-checked:bg-night-2",
                        )}
                      >
                        <input
                          type="radio"
                          name="served"
                          checked={served === s}
                          disabled={off}
                          onChange={() => setWant(k)}
                          className="mt-1.5 accent-flame"
                        />
                        <span>
                          {s.label}, {s.model.name}
                          <span className="block text-[15px] text-hush">
                            {off
                              ? `Needs about ${s.model.gb} GB, and ${who} has ${source.memGB} GB.`
                              : `${plural(s.credits, "credit")} per 1,000 tokens${k === "large" ? ", planned" : ""}`}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            </div>
          </div>

          <div className="lg:pt-28">
            <p className="flex flex-wrap items-baseline gap-x-4">
              <AnimatedNumber
                value={e.month}
                format={usdg}
                className="heat-text wide font-display text-[clamp(3rem,11vw,7.5rem)] leading-none font-extrabold"
              />
              <span className="text-xl text-hush">USDG a month</span>
            </p>
            <p className="mt-6 flex flex-wrap items-baseline gap-x-4">
              <AnimatedNumber
                value={e.year}
                format={usdg}
                className="wide font-display text-[clamp(2.25rem,7vw,4.5rem)] leading-none font-extrabold"
              />
              <span className="text-lg text-hush">USDG a year</span>
            </p>
            <p className="mt-10 max-w-[60ch] border-t border-line pt-5 text-hush">
              {speed(tps)} tokens a second, {busy}% of the time, for {plural(hours, "hour")} a day over 30 days comes to{" "}
              {wordy.format(e.tokens)} tokens a month. At {plural(served.credits, "credit")} per 1,000 tokens, and $0.01 a
              credit, people would pay {formatUsd(e.gross)} for them. You keep 70%, which is {usdg(e.month)} USDG.
            </p>
            <p className="mt-5 max-w-[60ch] border-l border-line-bright pl-4 text-[15px] text-mist">
              Estimate from {source.id === "mine" ? "your benchmark" : "the card you picked"}. The small price is what the
              network charges today; the large price is planned. Real earnings depend on demand.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}

/** A segmented thermal strip: cold violet at the low end, hot yellow at the top. Glows while the test runs. */
function Gauge({ value, running }: { value: number; running: boolean }) {
  const p = value > 0 ? scale(value) : 0;
  // The ramp is sized to the whole strip, so a slow card only ever reaches the cold colours.
  const fill = { width: `${p * 100}%`, backgroundSize: `${100 / Math.max(p, 0.01)}% 100%` };
  return (
    <div className="mt-8">
      <div
        role="meter"
        aria-label="Memory bandwidth"
        aria-valuemin={0}
        aria-valuemax={2000}
        aria-valuenow={Math.round(value)}
        aria-valuetext={`${formatInt(value)} GB/s`}
        className="relative h-14 sm:h-16"
      >
        <div
          aria-hidden
          className={cn(
            "heat-fill absolute inset-y-0 left-0 blur-xl transition-all duration-700 ease-quiet",
            running ? "opacity-70 motion-safe:animate-pulse" : "opacity-35",
          )}
          style={fill}
        />
        <div aria-hidden className="absolute inset-0 bg-night-3" style={{ maskImage: SEGMENTS, WebkitMaskImage: SEGMENTS }}>
          <div className="heat-fill h-full transition-all duration-700 ease-quiet" style={fill} />
        </div>
      </div>
      <div aria-hidden className="relative mt-2 h-9 text-[13px] text-hush">
        {TICKS.map(([label, gbps]) => (
          <span
            key={label}
            className="absolute top-0 flex -translate-x-1/2 flex-col items-center"
            style={{ left: `${scale(gbps) * 100}%` }}
          >
            <span className="h-2 w-px bg-line-bright" />
            <span className="mt-1 whitespace-nowrap">{label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
