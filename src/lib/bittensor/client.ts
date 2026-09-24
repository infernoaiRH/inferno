import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { toPrompt, type Answer, type Stats } from "@/lib/llm/engine";
import { watchRequests } from "@/lib/llm/requests";
import {
  CHUTES,
  MAX_TOKENS,
  costUsd,
  creditsMicroUsd,
  estimateTokens,
  parseChunk,
  sseReader,
  type ChutesModel,
  type Usage,
} from "./chutes";

/** Who pays for a Bittensor answer: the reader's own Chutes key, or their Inferno credits. */
export type Pay = "key" | "credits";
/** What a Bittensor answer cost in USD (an estimate when `estimated`), and Chutes' id for the request. */
export type ChutesBill = { usd: number; estimated?: boolean; requestId?: string };
export type ChutesAnswer = Answer & { gpu: string; bill?: ChutesBill; error?: string };

const SYSTEM =
  "You are a helpful assistant answering through Inferno on Bittensor subnet 64. " +
  "Answer plainly and kindly. Keep answers short unless asked for more, and use Markdown when it helps.";
const NO_ANSWER =
  "No answer came back. Thinking models can spend the whole 1,024-token budget before they write, so try again or pick another model.";

const KEY = "inferno.chutesKey";
const keyListeners = new Set<() => void>();

function readKey(): string {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

/** Keeps the key in this browser's localStorage only; "" forgets it. False when the browser won't store it. */
export function saveChutesKey(key: string): boolean {
  let ok = true;
  try {
    if (key) localStorage.setItem(KEY, key);
    else localStorage.removeItem(KEY);
  } catch {
    ok = false;
  }
  keyListeners.forEach((l) => l());
  return ok;
}

function subscribeKey(listener: () => void) {
  keyListeners.add(listener);
  // Saved or forgotten in another tab.
  const onStorage = (e: StorageEvent) => (e.key === KEY || e.key === null) && listener();
  window.addEventListener("storage", onStorage);
  return () => {
    keyListeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** The Chutes key saved in this browser, or "". */
export const useChutesKey = () => useSyncExternalStore(subscribeKey, readKey, () => "");

/** Whether this server takes Inferno credits (GET /api/credits/config). Asked each time `ask` turns true. */
export function useCreditsEnabled(ask: boolean): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    if (!ask) return;
    let live = true;
    fetch("/api/credits/config")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => live && setEnabled(j?.enabled === true))
      .catch(() => live && setEnabled(false));
    return () => {
      live = false;
    };
  }, [ask]);
  return enabled;
}

/** Turns a refused request into something a person can act on. */
async function refusal(res: Response, pay: Pay): Promise<string> {
  if (pay === "key" && res.status === 401) return "Chutes didn't accept your key. Check it at chutes.ai, or paste it again.";
  if (pay === "key" && res.status === 402) return "Your Chutes account is out of balance. Top it up at chutes.ai.";
  if (pay === "key" && res.status === 429) return "Chutes is limiting requests from your key right now. Wait a moment and try again.";
  const j = await res.json().catch(() => null);
  const said = typeof j?.error === "string" ? j.error : (j?.error?.message ?? j?.detail);
  return typeof said === "string" && said ? said.slice(0, 300) : `Chutes answered with an error (HTTP ${res.status}).`;
}

/**
 * Asks Bittensor subnet 64 through Chutes. With the reader's key this tab calls llm.chutes.ai
 * directly; with credits it calls /api/bittensor/chat, which passes Chutes' stream through unchanged.
 * Stop aborts the fetch.
 */
export function useChutes() {
  const run = useRef<AbortController | null>(null);
  useEffect(() => () => run.current?.abort(), []);

  async function generate(
    model: ChutesModel,
    turns: { role: "user" | "assistant"; content: string }[],
    pay: Pay,
    onDelta: (text: string, tps: number) => void,
  ): Promise<ChutesAnswer> {
    const messages = toPrompt(turns, SYSTEM);
    const ctrl = new AbortController();
    run.current = ctrl;
    const requests = watchRequests();
    const hosts = () => requests().filter((h) => h !== new URL(CHUTES).host && h !== location.host);
    const t0 = performance.now();
    let first = 0;
    let n = 0;
    let text = "";
    let said = "";
    let finish: string | undefined;
    let usage: Usage | undefined;
    try {
      const res = await fetch(pay === "key" ? `${CHUTES}/chat/completions` : "/api/bittensor/chat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(pay === "key" && { authorization: `Bearer ${readKey()}` }),
        },
        body: JSON.stringify(
          pay === "key"
            ? { model: model.id, messages, stream: true, stream_options: { include_usage: true }, max_tokens: MAX_TOKENS }
            : { model: model.id, messages },
        ),
        signal: ctrl.signal,
      }).catch((err) => {
        if (ctrl.signal.aborted) return null;
        throw new Error(
          pay === "key"
            ? "Couldn't reach Chutes (llm.chutes.ai). Check your connection and try again."
            : "Couldn't reach Inferno's server. Check your connection and try again.",
          { cause: err },
        );
      });
      // Stopped before anything came back: nothing to show or count.
      if (!res) return { hosts: hosts(), stopped: true, gpu: "" };
      if (!res.ok) throw new Error(await refusal(res, pay));

      const feed = sseReader((data) => {
        const c = parseChunk(data);
        usage = c.usage ?? usage;
        finish = c.finish ?? finish;
        if (!c.text && !c.thought) return;
        const now = performance.now();
        first ||= now;
        n++;
        text += c.text;
        said += c.text + c.thought;
        if (c.text) onDelta(c.text, n > 1 ? (n - 1) / ((now - first) / 1000) : 0);
      });
      const reader = res.body?.getReader();
      // A stream that breaks off keeps what came, with its estimated bill: tokens were used either way.
      let dropped = false;
      try {
        for (let r = await reader?.read(); r && !r.done; r = await reader?.read()) feed(r.value);
      } catch {
        dropped = !ctrl.signal.aborted;
      }

      const end = performance.now();
      // Stopped before Chutes sent its counts: estimate them, the same way the credits route charges.
      const used = usage ?? { prompt_tokens: estimateTokens(JSON.stringify(messages)), completion_tokens: estimateTokens(said) };
      const stats: Stats = {
        promptTokens: used.prompt_tokens,
        answerTokens: used.completion_tokens,
        tps: n > 1 ? used.completion_tokens / ((end - first) / 1000) : NaN,
        firstTokenS: ((first || end) - t0) / 1000,
        totalS: (end - t0) / 1000,
      };
      return {
        hosts: hosts(),
        // A reply cut at MAX_TOKENS also ends early.
        stopped: ctrl.signal.aborted || dropped || finish === "length",
        gpu: "",
        stats,
        bill: {
          usd: pay === "credits" ? creditsMicroUsd(model, used) / 1e6 : costUsd(model, used),
          estimated: !usage || undefined,
          requestId: res.headers.get("x-chutes-invocationid") || undefined,
        },
        error: dropped ? "The answer broke off: the connection dropped. Try again." : text || ctrl.signal.aborted ? undefined : NO_ANSWER,
      };
    } catch (err) {
      requests();
      throw err;
    } finally {
      run.current = null;
    }
  }

  const stop = () => run.current?.abort();

  return { generate, stop };
}
