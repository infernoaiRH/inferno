/** Self-check for the /lend estimate maths. Run: node scripts/lend-check.ts */
import assert from "node:assert/strict";
// @ts-expect-error -- Node's type stripping needs the .ts extension; the shared tsconfig doesn't allow it
import { MODELS, REFERENCE_GPUS, SIZES, earnings, gbps, median, tokensPerSecond } from "../src/lib/gpu/estimate.ts";

const near = (actual: number, expected: number) =>
  assert.ok(Math.abs(actual - expected) < 1e-6 * Math.max(1, Math.abs(expected)), `${actual} should be ${expected}`);

// Speed: bandwidth × 0.55 ÷ model size. 1,000 GB/s on a 5.5 GB model is 100 tokens a second.
near(tokensPerSecond(1000, 5.5), 100);

// A tested figure is already below spec, so it gets 0.65, not 0.55 again: 254 GB/s measured on an M5 Pro
// (307 GB/s spec) on the 8B class is 254 × 0.65 ÷ 4.7, close to the spec figure's 307 × 0.55 ÷ 4.7.
near(tokensPerSecond(254, MODELS[1].gb, true), (254 * 0.65) / 4.7);
const [tested, spec] = [tokensPerSecond(254, 4.7, true), tokensPerSecond(307, 4.7)];
assert.ok(Math.abs(tested - spec) / spec < 0.05, `${tested} should be within 5% of ${spec}`);

// An RTX 4090 on the 8B class: 1008 × 0.55 ÷ 4.7.
const [rtx4090] = REFERENCE_GPUS;
assert.equal(rtx4090.id, "rtx-4090");
near(tokensPerSecond(rtx4090.gbps, MODELS[1].gb), 117.9574468085);

// 100 tokens a second, 10 hours a day, busy half the time, over 30 days.
const small = earnings(100, 10, 0.5, SIZES.small.credits);
near(small.tokens, 54_000_000);
near(small.gross, 540); // 54,000 thousand-token blocks at 1 credit ($0.01)
near(small.month, 378); // the lender keeps 70%
near(small.year, 4536);

// Large models cost 6 credits per 1,000 tokens.
near(earnings(100, 10, 0.5, SIZES.large.credits).month, 378 * 6);
assert.equal(SIZES.large.model.gb, 40);

// Nothing lent, nothing earned.
assert.equal(earnings(100, 10, 0, 1).month, 0);

// 2 GB moved in one second is 2 GB/s; 512 MiB in 0.5 ms is about 1,074 GB/s.
near(gbps(2e9, 1000), 2);
near(gbps(512 * 2 ** 20, 0.5), 1073.741824);

// Median of odd and even counts, and it doesn't reorder the input.
const xs = [5, 1, 3];
assert.equal(median(xs), 3);
assert.deepEqual(xs, [5, 1, 3]);
assert.equal(median([4, 1, 3, 2]), 2.5);

console.log("lend-check: ok");
