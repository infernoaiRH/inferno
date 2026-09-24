/**
 * Bittensor subnet 64 (Chutes): an OpenAI-compatible API whose miners run every model here inside
 * confidential-compute hardware (Intel TDX with NVIDIA H100/H200 confidential computing).
 * Shared by the browser (own key) and /api/bittensor/chat (Inferno credits). No imports, so
 * `node src/lib/bittensor/check.ts` can load it.
 */

export const CHUTES = "https://llm.chutes.ai/v1";
/** Longest answer we ask for; the credits route holds this many tokens' worth before asking. */
export const MAX_TOKENS = 1024;
/** Planned: Inferno's margin on answers paid with credits, on top of Chutes' listed price. */
export const BITTENSOR_MARGIN = 0.2;

export type ChutesModel = {
  /** Chutes' model id, sent as `model`. */
  id: string;
  /** The id without its org and "-TEE" suffix. */
  name: string;
  /** Context window, tokens. */
  context: number;
  /** USD per million prompt (input) and completion (output) tokens. */
  input: number;
  output: number;
};

export type Usage = { prompt_tokens: number; completion_tokens: number };

/** The confidential-compute models in a `/v1/models` reply, with their prices. Anything malformed is left out. */
export function toModels(json: unknown): ChutesModel[] {
  const data = (json as { data?: unknown } | null)?.data;
  if (!Array.isArray(data)) return [];
  return data.flatMap((m) => {
    const input = Number(m?.pricing?.prompt);
    const output = Number(m?.pricing?.completion);
    const context = Number(m?.context_length);
    const ok = m?.confidential_compute === true && typeof m.id === "string" && input >= 0 && output >= 0 && context > 0;
    return ok ? [{ id: m.id, name: m.id.split("/").pop().replace(/-TEE$/, ""), context, input, output }] : [];
  });
}

let cached: { at: number; models: Promise<ChutesModel[]> } | undefined;

/** Chutes' live model list, cached for 10 minutes in this tab or server process. A failed fetch isn't cached. */
export function chutesModels(): Promise<ChutesModel[]> {
  if (!cached || Date.now() - cached.at > 600_000) {
    const models = fetch(`${CHUTES}/models`).then(async (r) => {
      if (!r.ok) throw new Error(`Chutes' model list answered HTTP ${r.status}`);
      return toModels(await r.json());
    });
    const entry = { at: Date.now(), models };
    cached = entry;
    models.catch(() => cached === entry && (cached = undefined));
  }
  return cached.models;
}

/** What Chutes lists for these tokens, in USD. */
export const costUsd = (m: ChutesModel, u: Usage) => (u.prompt_tokens * m.input + u.completion_tokens * m.output) / 1e6;

/** What Inferno credits pay: Chutes' price plus the margin, in whole micro-USD, rounded up. */
export const creditsMicroUsd = (m: ChutesModel, u: Usage) =>
  Math.ceil((u.prompt_tokens * m.input + u.completion_tokens * m.output) * (1 + BITTENSOR_MARGIN));

/** A high guess at the token count of text Chutes never counted for us: a token per 3 UTF-8 bytes. */
export const estimateTokens = (text: string) => Math.ceil(new TextEncoder().encode(text).length / 3);

/** Takes SSE bytes in any chunking and calls `onData` with each complete `data:` payload except [DONE]. */
export function sseReader(onData: (data: string) => void): (bytes: Uint8Array) => void {
  const decoder = new TextDecoder();
  let rest = "";
  return (bytes) => {
    const lines = (rest + decoder.decode(bytes, { stream: true })).split("\n");
    rest = lines.pop() ?? "";
    for (const line of lines) {
      const data = line.startsWith("data:") ? line.slice(5).trim() : "";
      if (data && data !== "[DONE]") onData(data);
    }
  };
}

/**
 * One streamed chat completion chunk: its answer text, any thinking text (billed like the answer),
 * why it finished, and the token counts when it is the usage chunk.
 */
export function parseChunk(data: string): { text: string; thought: string; finish?: string; usage?: Usage } {
  const str = (x: unknown) => (typeof x === "string" ? x : "");
  const count = (x: unknown) => (typeof x === "number" && x >= 0 ? x : NaN);
  try {
    const j = JSON.parse(data);
    const choice = j?.choices?.[0];
    const d = choice?.delta ?? {};
    const usage = { prompt_tokens: count(j?.usage?.prompt_tokens), completion_tokens: count(j?.usage?.completion_tokens) };
    return {
      text: str(d.content),
      thought: str(d.reasoning_content) || str(d.reasoning),
      finish: str(choice?.finish_reason) || undefined,
      usage: usage.prompt_tokens >= 0 && usage.completion_tokens >= 0 ? usage : undefined,
    };
  } catch {
    return { text: "", thought: "" };
  }
}
