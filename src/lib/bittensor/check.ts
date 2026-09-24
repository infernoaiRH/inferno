/** Self-check for chutes.ts: model list, credit pricing, SSE parsing. Run: node src/lib/bittensor/check.ts */
import assert from "node:assert/strict";
// @ts-expect-error -- Node's type stripping needs the .ts extension; the shared tsconfig doesn't allow it
import { BITTENSOR_MARGIN, costUsd, creditsMicroUsd, estimateTokens, parseChunk, sseReader, toModels } from "./chutes.ts";

// Only confidential-compute models with sane numbers are listed.
const models = toModels({
  data: [
    { id: "google/gemma-4-31B-turbo-TEE", confidential_compute: true, context_length: 131072, pricing: { prompt: 0.12, completion: 0.37 } },
    { id: "open/plain", confidential_compute: false, context_length: 8192, pricing: { prompt: 1, completion: 1 } },
    { id: "bad/price-TEE", confidential_compute: true, context_length: 8192, pricing: { prompt: "free", completion: 1 } },
  ],
});
assert.deepEqual(models, [{ id: "google/gemma-4-31B-turbo-TEE", name: "gemma-4-31B-turbo", context: 131072, input: 0.12, output: 0.37 }]);
assert.deepEqual(toModels(null), []);

// Credits: (1,000 x $0.12 + 500 x $0.37) per million = $0.000305, plus the 20% margin = 366 micro-USD.
const gemma = models[0];
assert.equal(BITTENSOR_MARGIN, 0.2);
assert.ok(Math.abs(costUsd(gemma, { prompt_tokens: 1000, completion_tokens: 500 }) - 0.000305) < 1e-12);
assert.equal(creditsMicroUsd(gemma, { prompt_tokens: 1000, completion_tokens: 500 }), 366);
// Whole micro-dollars, rounded up: one prompt token (0.144 micro-USD) costs 1, nothing costs 0.
assert.equal(creditsMicroUsd(gemma, { prompt_tokens: 1, completion_tokens: 0 }), 1);
assert.equal(creditsMicroUsd(gemma, { prompt_tokens: 0, completion_tokens: 0 }), 0);
// The route's hold before an answer: a token per byte of a 100-byte chat plus 1,024 answer tokens (469.056, rounded up).
assert.equal(creditsMicroUsd(gemma, { prompt_tokens: 100, completion_tokens: 1024 }), 470);

// Estimates run high: a token per 3 UTF-8 bytes.
assert.equal(estimateTokens(""), 0);
assert.equal(estimateTokens("abcd"), 2);
assert.equal(estimateTokens("日本"), 2);

// SSE: payloads split anywhere (even inside a character) come out whole; comments and [DONE] are skipped.
const got: string[] = [];
const feed = sseReader((d: string) => got.push(d));
const bytes = new TextEncoder().encode('data: {"t":"é"}\n\nda');
feed(bytes.slice(0, 13));
feed(bytes.slice(13));
feed(new TextEncoder().encode('ta: {"b":2}\r\n\n: ping\n\ndata: [DONE]\n\n'));
assert.deepEqual(got, ['{"t":"é"}', '{"b":2}']);

// Chunks: answer text, thinking text, finish reason and the usage chunk.
assert.deepEqual(parseChunk('{"choices":[{"delta":{"content":"Hi"}}]}'), { text: "Hi", thought: "", finish: undefined, usage: undefined });
assert.equal(parseChunk('{"choices":[{"delta":{"reasoning_content":"hmm"},"finish_reason":null}]}').thought, "hmm");
assert.equal(parseChunk('{"choices":[{"delta":{},"finish_reason":"length"}],"usage":null}').finish, "length");
assert.deepEqual(parseChunk('{"choices":[],"usage":{"prompt_tokens":12,"completion_tokens":34,"total_tokens":46}}').usage, {
  prompt_tokens: 12,
  completion_tokens: 34,
});
assert.equal(parseChunk('{"usage":{"prompt_tokens":"12","completion_tokens":3}}').usage, undefined);
assert.deepEqual(parseChunk("not json"), { text: "", thought: "" });

console.log("bittensor check: ok");
