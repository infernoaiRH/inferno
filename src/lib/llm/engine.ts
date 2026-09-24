import { useEffect, useRef, useState } from "react";
import type { ChatCompletionMessageParam } from "@mlc-ai/web-llm";
import { watchRequests } from "./requests";

/** web-llm's own measurements for one answer (its usage chunk). Times are in seconds. */
export type Stats = { promptTokens: number; answerTokens: number; tps: number; firstTokenS: number; totalS: number };

/** Messages between the page and the model worker. */
export type ToWorker =
  | { type: "load"; model: string }
  | { type: "chat"; messages: ChatCompletionMessageParam[] }
  | { type: "stop" };

export type FromWorker =
  | { type: "progress"; text: string; progress: number }
  | { type: "ready"; model: string }
  | { type: "delta"; text: string; tps: number }
  | { type: "done"; hosts: string[]; stopped: boolean; stats?: Stats }
  | { type: "error"; message: string };

/**
 * Builds from web-llm 0.2.85's prebuiltAppConfig; `mb` is its vram_required_MB.
 * The f16 builds are smaller and faster but need the GPU's shader-f16 feature.
 */
export const MODELS = [
  {
    name: "SmolLM2 360M",
    note: "Tiny and quick. Good for short questions and rewording.",
    f16: { id: "SmolLM2-360M-Instruct-q4f16_1-MLC", mb: 376.06 },
    f32: { id: "SmolLM2-360M-Instruct-q4f32_1-MLC", mb: 579.61 },
  },
  {
    name: "Llama 3.2 1B",
    note: "Balanced. A steady writer for everyday questions.",
    f16: { id: "Llama-3.2-1B-Instruct-q4f16_1-MLC", mb: 879.04 },
    f32: { id: "Llama-3.2-1B-Instruct-q4f32_1-MLC", mb: 1128.82 },
  },
  {
    name: "Qwen2.5 1.5B",
    note: "The strongest here. Slower to load, better with reasoning and code.",
    f16: { id: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC", mb: 1629.75 },
    f32: { id: "Qwen2.5-1.5B-Instruct-q4f32_1-MLC", mb: 1888.97 },
  },
];

export const modelName = (id: string) => MODELS.find((m) => m.f16.id === id || m.f32.id === id)?.name ?? id;

const SYSTEM =
  "You are a helpful assistant running privately inside the user's own web browser. " +
  "Answer plainly and kindly. Keep answers short unless asked for more, and use Markdown when it helps.";

/** For answers a lender's GPU writes for someone else, who reads them in their own browser. */
export const NETWORK_SYSTEM =
  "You are a helpful assistant answering through the Inferno network. " +
  "Answer plainly and kindly. Keep answers short unless asked for more, and use Markdown when it helps.";

/** The system prompt plus the latest turns that fit. The newest turn is always kept. */
export function toPrompt(turns: { role: "user" | "assistant"; content: string }[], system = SYSTEM): ChatCompletionMessageParam[] {
  // ponytail: 8,000 characters stands in for a token count (these models hold 4,096 tokens);
  // count real tokens if long chats start getting cut off.
  const kept: ChatCompletionMessageParam[] = [];
  let chars = 0;
  for (let i = turns.length - 1; i >= 0; i--) {
    const { role, content } = turns[i];
    chars += content.length;
    if (kept.length > 0 && chars > 8000) break;
    if (content) kept.unshift({ role, content });
  }
  return [{ role: "system", content: system }, ...kept];
}

/** Turns web-llm's errors into something a person can act on. */
export function friendlyError(message: string): string {
  if (/device was lost|out of memory|\bOOM\b/i.test(message))
    return "The graphics card ran out of memory. Try a smaller model, or close other heavy tabs.";
  if (/model not loaded/i.test(message))
    return "The model is no longer loaded, often after the graphics card ran low on memory. Load it again.";
  if (/quota/i.test(message)) return "This browser has no room left to store the model. Free some space or pick a smaller model.";
  if (/fetch|network/i.test(message)) return "The download stopped. Check your connection and try again. Finished parts stay cached.";
  if (/context window/i.test(message)) return "That is longer than the model can hold at once. Send something shorter, or start a new chat.";
  return `The model hit an error: ${message.slice(0, 200)}`;
}

/** `name` is the adapter as the browser describes it ("Apple metal-3"), or "" when it shares nothing. */
export type Gpu = { state: "checking" } | { state: "ok"; f16: boolean; name: string } | { state: "missing" };

// TypeScript's DOM types don't include WebGPU yet; this is the slice we use.
type GpuInfo = { vendor?: string; architecture?: string; description?: string };
type GpuNavigator = Navigator & {
  gpu?: {
    requestAdapter(options?: {
      powerPreference?: "high-performance";
    }): Promise<{ features: { has(name: string): boolean }; info?: GpuInfo } | null>;
  };
};

const VENDORS: Record<string, string> = { amd: "AMD", nvidia: "NVIDIA" };

/** Browsers usually blank the description for privacy, so vendor plus architecture is the common case. */
function gpuName({ vendor = "", architecture = "", description = "" }: GpuInfo = {}): string {
  if (description) return description;
  return `${VENDORS[vendor] ?? vendor.charAt(0).toUpperCase() + vendor.slice(1)} ${architecture}`.trim();
}

/** WebGPU counts only when the browser hands out an adapter, not just when navigator.gpu exists. */
export function useWebGPU(): Gpu {
  const [gpu, setGpu] = useState<Gpu>({ state: "checking" });
  useEffect(() => {
    let live = true;
    // web-llm asks for the high-performance adapter too, so the name is the GPU that answers.
    Promise.resolve((navigator as GpuNavigator).gpu?.requestAdapter({ powerPreference: "high-performance" }))
      .then((a): Gpu =>
        a ? { state: "ok", f16: a.features.has("shader-f16"), name: gpuName(a.info) } : { state: "missing" },
      )
      .catch((): Gpu => ({ state: "missing" }))
      .then((g) => live && setGpu(g));
    return () => {
      live = false;
    };
  }, []);
  return gpu;
}

export type Status =
  | { state: "idle" }
  | { state: "loading"; model: string; text: string; progress: number }
  | { state: "ready"; model: string }
  | { state: "error"; message: string };

export type Answer = { hosts: string[]; stopped: boolean; stats?: Stats };
type OnDelta = (text: string, tps: number) => void;
type Run = { onDelta: OnDelta; done: (answer: Answer) => void; fail: (error: Error) => void };

/** The model lives in one web worker, created on the first explicit load and ended with the page. */
export function useLocalModel() {
  const worker = useRef<Worker | null>(null);
  const run = useRef<Run | null>(null);
  const [status, setStatus] = useState<Status>({ state: "idle" });

  useEffect(() => () => worker.current?.terminate(), []);

  function onMessage({ data: m }: MessageEvent<FromWorker>) {
    if (m.type === "progress") setStatus((s) => (s.state === "loading" ? { ...s, text: m.text, progress: m.progress } : s));
    else if (m.type === "ready") setStatus({ state: "ready", model: m.model });
    else if (m.type === "delta") run.current?.onDelta(m.text, m.tps);
    else if (m.type === "done") run.current?.done(m);
    else if (run.current) run.current.fail(new Error(m.message));
    else setStatus({ state: "error", message: friendlyError(m.message) });
  }

  function load(model: string) {
    let w = worker.current;
    if (!w) {
      w = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
      w.onmessage = onMessage;
      w.onerror = (e) => {
        const message = e.message || "The model worker stopped.";
        run.current?.fail(new Error(message));
        setStatus({ state: "error", message: friendlyError(message) });
        worker.current?.terminate();
        worker.current = null;
      };
      worker.current = w;
    }
    setStatus({ state: "loading", model, text: "Starting", progress: 0 });
    w.postMessage({ type: "load", model } satisfies ToWorker);
  }

  /** Streams one answer with its running tokens/s. The privacy meter joins this page's requests with the worker's. */
  async function generate(messages: ChatCompletionMessageParam[], onDelta: OnDelta): Promise<Answer> {
    const w = worker.current;
    if (!w) throw new Error("Model not loaded");
    const requests = watchRequests();
    try {
      const answer = await new Promise<Answer>((done, fail) => {
        run.current = { onDelta, done, fail };
        w.postMessage({ type: "chat", messages } satisfies ToWorker);
      });
      return { hosts: [...new Set([...requests(), ...answer.hosts])], stopped: answer.stopped, stats: answer.stats };
    } catch (err) {
      requests();
      throw err;
    } finally {
      run.current = null;
    }
  }

  function stop() {
    worker.current?.postMessage({ type: "stop" } satisfies ToWorker);
  }

  return { status, load, generate, stop };
}
