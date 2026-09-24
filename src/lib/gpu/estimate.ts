/**
 * Pure estimate maths for /lend. No imports, so `node scripts/lend-check.ts` loads it as is.
 * Decoding a token reads every weight once, so speed is bound by memory bandwidth, not compute.
 */

/** Model classes at 4-bit (q4), sized by the weights read for every token. */
export const MODELS = [
  { id: "1b", name: "1B class", gb: 0.9 },
  { id: "8b", name: "8B class", gb: 4.7 },
  { id: "70b", name: "70B class", gb: 40 },
];

/** Approximate spec bandwidth (GB/s) and memory. Apple chips share memory with the system; memGB is the largest option. */
export const REFERENCE_GPUS: { id: string; name: string; gbps: number; memGB: number; upTo?: boolean }[] = [
  { id: "rtx-4090", name: "RTX 4090", gbps: 1008, memGB: 24 },
  { id: "rx-7900-xtx", name: "Radeon RX 7900 XTX", gbps: 960, memGB: 24 },
  { id: "rtx-3090", name: "RTX 3090", gbps: 936, memGB: 24 },
  { id: "rtx-4080", name: "RTX 4080", gbps: 717, memGB: 16 },
  { id: "m3-max", name: "Apple M3 Max", gbps: 400, memGB: 128, upTo: true },
  { id: "rtx-3060", name: "RTX 3060 12GB", gbps: 360, memGB: 12 },
  { id: "m2", name: "Apple M2", gbps: 100, memGB: 24, upTo: true },
];

/** Credits per 1,000 tokens. One credit is $0.01 and the lender keeps 70%. Small is today's network price; large is planned. */
export const SIZES = {
  small: { label: "Small", model: MODELS[1], credits: 1 },
  large: { label: "Large", model: MODELS[2], credits: 6 },
};
export const LENDER_SHARE = 0.7;

/** Real decoding rarely gets near peak bandwidth; 0.55 is the share we assume it does. */
export const tokensPerSecond = (gbps: number, modelGB: number) => (gbps * 0.55) / modelGB;

/** A month is 30 days of `hoursADay`, of which `busy` (0 to 1) is spent serving. */
export function earnings(tokPerSec: number, hoursADay: number, busy: number, creditsPer1k: number) {
  const tokens = tokPerSec * 3600 * hoursADay * 30 * busy;
  const gross = (tokens / 1000) * creditsPer1k * 0.01;
  const month = gross * LENDER_SHARE;
  return { tokens, gross, month, year: month * 12 };
}

/** Bytes moved in `ms` milliseconds, as decimal GB a second (the unit on spec sheets). */
export const gbps = (bytes: number, ms: number) => bytes / ms / 1e6;

export function median(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
