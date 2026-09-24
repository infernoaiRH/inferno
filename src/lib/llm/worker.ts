/**
 * Runs the model off the main thread so the page stays smooth. It also watches its own network
 * requests while answering, because a page-side observer cannot see a worker's requests.
 */
import { MLCEngine } from "@mlc-ai/web-llm";
import type { FromWorker, Stats, ToWorker } from "./engine";
import { watchRequests } from "./requests";

const send = (message: FromWorker) => postMessage(message);
const engine = new MLCEngine({
  initProgressCallback: ({ text, progress }) => send({ type: "progress", text, progress }),
});
let stopped = false;

self.onmessage = async ({ data }: MessageEvent<ToWorker>) => {
  if (data.type === "stop") {
    stopped = true;
    void engine.interruptGenerate();
    return;
  }
  let requests: (() => string[]) | undefined;
  try {
    if (data.type === "load") {
      await engine.reload(data.model);
      send({ type: "ready", model: data.model });
      return;
    }
    stopped = false;
    requests = watchRequests();
    const chunks = await engine.chat.completions.create({
      messages: data.messages,
      stream: true,
      stream_options: { include_usage: true },
      max_tokens: 1024,
    });
    let stats: Stats | undefined;
    let sent = 0;
    let first = 0;
    // Let the stream end on its own: breaking out early would leave the engine's lock held.
    for await (const chunk of chunks) {
      const text = chunk.choices[0]?.delta.content;
      // The last chunk carries the engine's measurements, after a stop too. Its prompt count is
      // only the new part: web-llm keeps earlier turns of the same chat cached.
      const u = chunk.usage;
      if (u) {
        const { decode_tokens_per_s: tps, time_to_first_token_s: firstTokenS, e2e_latency_s: totalS } = u.extra;
        stats = { promptTokens: u.prompt_tokens, answerTokens: u.completion_tokens, tps, firstTokenS, totalS };
      }
      // A stop can land before generation starts, when the engine resets its flag, so repeat it.
      if (stopped) void engine.interruptGenerate();
      else if (text) {
        // Average speed since the first chunk, timed here where chunks are made, so a busy page
        // receiving several at once doesn't read as a spike. About one token per chunk.
        const now = performance.now();
        first ||= now;
        send({ type: "delta", text, tps: now > first ? (sent * 1000) / (now - first) : 0 });
        sent++;
      }
    }
    send({ type: "done", hosts: requests(), stopped, stats });
  } catch (err) {
    requests?.();
    send({ type: "error", message: err instanceof Error ? err.message : String(err) });
  }
};
