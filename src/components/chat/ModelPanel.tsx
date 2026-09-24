"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { MODELS, type Gpu, type Status } from "@/lib/llm/engine";
import { HeatBar } from "./Heat";

export const card = "rounded-3xl border border-line bg-night-2 p-5 sm:p-7";
const size = (mb: number) => (mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`);
// Opened from the model chip, the panel may mount below the fold of a long chat.
export const reveal = (el: HTMLElement | null) => el?.scrollIntoView({ block: "nearest" });

type Props = { gpu: Gpu; status: Status; onLoad: (id: string) => void; onClose?: () => void };

/** Nothing downloads until the reader presses Load model. */
export function ModelPanel({ gpu, status, onLoad, onClose }: Props) {
  const [pick, setPick] = useState(0);

  if (gpu.state === "missing") {
    return (
      <section ref={onClose ? reveal : undefined} aria-labelledby="model-title" className={card}>
        <h2 id="model-title" className="text-2xl">
          This browser can&apos;t run the model
        </h2>
        <p className="mt-2 text-hush">
          Private mode needs a browser with WebGPU, such as a recent Chrome or Edge on desktop. Your saved chats are
          still here to read.
        </p>
      </section>
    );
  }

  const known = gpu.state === "ok";
  const build = (i: number) => (known && gpu.f16 ? MODELS[i].f16 : MODELS[i].f32);
  const chosen = build(pick);
  const loading = status.state === "loading";
  const loaded = status.state === "ready" && status.model === chosen.id;

  return (
    <section ref={onClose ? reveal : undefined} aria-labelledby="model-title" className={card}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="model-title" className="text-2xl">
            Choose a model for this device
          </h2>
          <p className="mt-1.5 text-[15px] text-hush">
            It runs on your graphics card. Sizes are the graphics memory each one needs. Nothing downloads until you
            press Load model.
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close the model list"
            className="-mt-1 -mr-1 shrink-0 rounded-full p-2 text-hush hover:text-mist"
          >
            <X size={18} />
          </button>
        )}
      </div>

      <fieldset disabled={loading} className="mt-5 grid gap-2">
        <legend className="sr-only">Model</legend>
        {MODELS.map((m, i) => (
          <label
            key={m.name}
            className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line bg-night p-4 transition-colors hover:border-line-bright has-checked:border-flame/70 has-checked:bg-night-3/50 has-disabled:cursor-default"
          >
            <input
              type="radio"
              name="model"
              checked={pick === i}
              onChange={() => setPick(i)}
              className="mt-1.5 shrink-0 accent-flame"
            />
            <span className="min-w-0 flex-1">
              <span className="block font-medium text-mist">{m.name}</span>
              <span className="block text-[15px] text-hush">{m.note}</span>
            </span>
            {known && <span className="tnum shrink-0 pt-0.5 text-sm text-faint">about {size(build(i).mb)}</span>}
          </label>
        ))}
      </fieldset>

      <div className="mt-5">
        {status.state === "loading" ? (
          <Progress text={status.text} value={status.progress} />
        ) : (
          <Button onClick={() => onLoad(chosen.id)} disabled={!known || loaded}>
            {loaded ? "Loaded" : "Load model"}
          </Button>
        )}
      </div>
      {status.state === "error" && (
        <p role="alert" className="mt-3 text-[15px] text-ember">
          {status.message}
        </p>
      )}
      <p className="mt-5 text-sm text-faint">
        The first load downloads the model from Hugging Face. After that it is cached in this browser and loads without
        downloading again. Only the model comes over the network; your messages never do.
      </p>
    </section>
  );
}

/** Driven by web-llm's init progress: its first sentence, and the fraction of the current step. */
function Progress({ text, value }: { text: string; value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-4 text-sm">
        <span className="min-w-0 text-heat-4">{text.split(". ")[0]}</span>
        <span className="tnum shrink-0 text-hush">{pct}%</span>
      </div>
      <HeatBar
        value={value}
        role="progressbar"
        aria-label="Loading the model"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="mt-2"
      />
    </div>
  );
}
