import { after } from "next/server";
import { CHUTES, MAX_TOKENS, chutesModels, completion, creditsMicroUsd, estimateTokens, parseChunk, sseReader, usageOnly, type Usage } from "@/lib/bittensor/chutes";
import { db, keyAddress, paymentsEnabled, sessionAddress } from "@/lib/credits";
import { hold, holdUsed, release, sweepHolds } from "@/lib/credits/ledger";
import { limits } from "@/lib/limits";
import { limit, readJson } from "@/lib/relay/server";

/** The most a chat may send, as JSON, in bytes. */
const MAX_BYTES = 64 * 1024;
/** The longest an answer may run. Then the request to Chutes stops and the wallet is settled, even if nobody is reading. */
const MAX_MS = 4 * 60_000;
/** How often a running answer saves what it has used, for the stale-hold sweep to settle by if this invocation dies. */
const SAVE_MS = 5_000;
const ROLES = ["system", "user", "assistant"];
const TOO_LONG = "That chat is too long to send. Start a new chat, or send something shorter.";

/** Keeps only well-formed turns, rebuilt so nothing else rides along to Chutes. */
function readMessages(x: unknown): { role: string; content: string }[] | null {
  if (!Array.isArray(x) || x.length === 0) return null;
  if (!x.every((m) => ROLES.includes(m?.role) && typeof m?.content === "string")) return null;
  return x.map(({ role, content }) => ({ role, content }));
}

const between = (x: unknown, lo: number, hi: number) => (typeof x === "number" && x >= lo && x <= hi ? x : undefined);

/**
 * One Bittensor answer paid with Inferno credits. Before Chutes is asked, the wallet pays a hold for
 * the worst case, which also keeps it to one answer at a time. When the answer ends, stops, breaks
 * or runs out of time, the wallet keeps paying only what Chutes' own token counts (or an estimate)
 * say it used and gets the rest of the hold back, all in this invocation. If the invocation dies
 * first, the stale-hold sweep settles by what it last saved. Prompts are never stored or logged.
 *
 * `api` false: a signed-in browser (/api/bittensor/chat); Chutes' stream passes through unchanged.
 * `api` true: the OpenAI-compatible API (/api/v1/chat/completions); the caller is the wallet behind an
 * Inferno API key, errors come in OpenAI's shape, `max_tokens`, `temperature` and `top_p` are honored,
 * and the answer streams only when asked (without the usage chunk unless asked, as OpenAI does), or
 * else comes back whole as one chat.completion.
 */
export async function answer(req: Request, api: boolean): Promise<Response> {
  const refuse = (status: number, message: string) => Response.json(api ? { error: { message } } : { error: message }, { status });
  const busy = limit(limits.bittensor, req);
  if (busy) return busy;
  const apiKey = process.env.CHUTES_API_KEY;
  if (!apiKey || !(await paymentsEnabled())) return refuse(503, "Bittensor credits aren't configured on this server.");
  const address = api ? await keyAddress(req) : await sessionAddress(req);
  if (!address) return refuse(401, api ? "Send an Inferno API key as `Authorization: Bearer inf_…`. Make one on the Credits page." : "Sign in with your wallet first.");
  // JSON only: a cross-site form can't send it without a CORS preflight, which this route doesn't answer.
  if (!req.headers.get("content-type")?.startsWith("application/json")) return refuse(415, "Send the chat as JSON.");
  if (Number(req.headers.get("content-length")) > MAX_BYTES + 1024) return refuse(413, TOO_LONG);

  const body = await readJson(req); // at most 256 KB, whatever Content-Length says
  if (body instanceof Response) return body;
  const b = (body ?? {}) as Record<string, unknown>;
  const messages = readMessages(b.messages);
  if (!messages) return refuse(400, "Send the model and the chat's messages, each with a role and text.");
  const prompt = JSON.stringify(messages);
  const bytes = new TextEncoder().encode(prompt).length;
  if (bytes > MAX_BYTES) return refuse(413, TOO_LONG);
  const models = await chutesModels().catch(() => null);
  if (!models) return refuse(502, "Chutes didn't answer. Nothing was charged. Try again in a moment.");
  const model = models.find((m) => m.id === b.model);
  if (!model) return refuse(400, api ? "Unknown model. GET /api/v1/models lists them." : "That model isn't offered here. Pick one from the list.");
  const wanted = api ? (b.max_completion_tokens ?? b.max_tokens) : undefined;
  const maxTokens = Number.isSafeInteger(wanted) && (wanted as number) > 0 ? Math.min(wanted as number, MAX_TOKENS) : MAX_TOKENS;
  const streaming = !api || b.stream === true;
  const withUsage = !api || (b.stream_options as { include_usage?: unknown } | undefined)?.include_usage === true;

  const d = await db();
  await sweepHolds(d); // frees a wallet whose last answer died unsettled
  // The hold: a token per byte of the chat (no tokenizer does worse) plus a full answer, with the margin.
  const worst = creditsMicroUsd(model, { prompt_tokens: bytes, completion_tokens: maxTokens });
  // Made here and never sent to the caller, so no other charge can claim it.
  const ref = `bt:${crypto.randomUUID()}`;
  const held = await hold(d, address, worst, ref);
  if (!held.ok)
    return held.reason === "busy"
      ? refuse(429, "Your last answer is still being written. Wait for it, or stop it first.")
      : refuse(402, "Not enough credits. Top up on the Credits page.");

  let usage: Usage | undefined;
  let text = "";
  let thought = "";
  let finish: string | undefined;
  /** Chutes' own counts, or a high estimate from the bytes when it stopped before sending them. */
  const cost = () => creditsMicroUsd(model, usage ?? { prompt_tokens: estimateTokens(prompt), completion_tokens: estimateTokens(text + thought) });
  /** Keeps `used` of the hold (never more), refunds the rest and frees the wallet. If this fails, the sweep settles it later. */
  const settle = (used: number) =>
    release(d, address, ref, used).catch((err) => console.error(`bittensor: settling ${ref} for ${address} failed; the stale-hold sweep will`, err));

  // Stop means stop: the reader leaving or the time running out ends the request to Chutes too.
  const stop = new AbortController();
  const up = await fetch(`${CHUTES}/chat/completions`, {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: model.id,
      messages,
      stream: true,
      stream_options: { include_usage: true },
      max_tokens: maxTokens,
      ...(api && { temperature: between(b.temperature, 0, 2), top_p: between(b.top_p, 0, 1) }),
    }),
    signal: AbortSignal.any([req.signal, stop.signal, AbortSignal.timeout(MAX_MS)]),
  }).catch(() => null);
  if (!up?.ok || !up.body) {
    await settle(0);
    void up?.body?.cancel();
    if (up) console.error(`bittensor: Chutes answered HTTP ${up.status}`);
    return refuse(502, up ? `Chutes answered with an error (HTTP ${up.status}). Nothing was charged.` : "Chutes didn't answer. Nothing was charged. Try again in a moment.");
  }

  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const out = streaming ? writable.getWriter() : null;
  const send = (bytes: Uint8Array) => void out?.write(bytes).catch(() => stop.abort()); // the reader left
  const encoder = new TextEncoder();
  const feed = sseReader((data) => {
    const c = parseChunk(data);
    usage = c.usage ?? usage;
    text += c.text;
    thought += c.thought;
    finish = c.finish ?? finish;
    // The API passes chunks on one by one, dropping the usage-only chunk unless it was asked for.
    if (api && streaming && (withUsage || !usageOnly(c))) send(encoder.encode(`data: ${data}\n\n`));
  });
  const reader = up.body.getReader();
  // Reads Chutes to the end whether or not anyone reads here (an answer is at most MAX_TOKENS), so it settles in this invocation.
  const pump = (async () => {
    let failed: unknown = null;
    let saved = Date.now();
    try {
      for (let r = await reader.read(); !r.done; r = await reader.read()) {
        feed(r.value);
        if (!api) send(r.value);
        if (Date.now() - saved > SAVE_MS) {
          saved = Date.now();
          await holdUsed(d, address, ref, cost()).catch(() => {});
        }
      }
    } catch (err) {
      failed = err; // stopped, broken or out of time
    }
    await settle(cost());
    if (api && streaming && !failed) send(encoder.encode("data: [DONE]\n\n"));
    void (failed ? out?.abort(failed) : out?.close())?.catch(() => {});
    return failed === null;
  })();

  // Chutes' id, for the caller's receipt only; the ledger uses `ref`.
  const invocation = up.headers.get("x-chutes-invocationid");
  const receipt: Record<string, string> = invocation ? { "x-chutes-invocationid": invocation } : {};
  if (!streaming) {
    // Cut off by the time limit or a broken stream: what was written comes back, as a "length" stop.
    const whole = await pump;
    return Response.json(
      completion({ id: `chatcmpl-${invocation ?? ref.slice(3)}`, model: model.id, created: Math.floor(Date.now() / 1000), text, thought, finish: finish ?? (whole ? "stop" : "length"), usage }),
      { headers: { "cache-control": "no-store", ...receipt } },
    );
  }
  // When the reader leaves early, settling finishes after the response: keep the invocation alive for it.
  after(pump);
  return new Response(readable, {
    headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-store, no-transform", "x-accel-buffering": "no", ...receipt },
  });
}
