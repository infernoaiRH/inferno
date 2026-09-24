import { Bucket } from "@/lib/relay/hub";

/**
 * Per-visitor token buckets (tokens a second, burst) for the sign-in, credits and Bittensor routes.
 * The relay keeps its own in src/lib/relay/server.ts. Use with `limit(bucket, req)` from there.
 */
const g = globalThis as unknown as { infernoLimits?: Record<"auth" | "credits" | "usage" | "bittensor", Bucket> };
export const limits = (g.infernoLimits ??= {
  auth: new Bucket(1, 10), // nonce and verify
  credits: new Bucket(5, 20), // config and account reads
  usage: new Bucket(5, 20), // network settlements
  bittensor: new Bucket(1, 5), // credit-paid Bittensor answers (one at a time per wallet as well)
});
