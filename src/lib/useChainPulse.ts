"use client";

import { useSyncExternalStore } from "react";
import type { Block } from "viem";
import { publicClient } from "@/lib/chain";

/**
 * Live Robinhood Chain heartbeat, shared by every component on the page.
 * One polling loop per tab, started by the first subscriber and stopped by the last.
 * Each poll reads `latest` and fills the gap since the previous poll (up to 12 blocks, batched into one
 * request). New blocks reach `onPulseBlock` listeners spread evenly across the next poll, so canvases get
 * a steady ~10 Hz stream of real blocks about a second behind the chain.
 */
export type PulseBlock = {
  number: bigint;
  timestamp: number;
  txCount: number;
  gasUsed: bigint;
  gasLimit: bigint;
  baseFeePerGas: bigint | null;
};

export type PulseStatus = "connecting" | "live" | "reconnecting";

export type PulseState = {
  status: PulseStatus;
  latest: PulseBlock | null;
  /** Oldest first, newest last. May skip blocks when a poll falls far behind. */
  recent: PulseBlock[];
  /** Seconds between the latest block and the latest `finalized` block. */
  finalizedLagSec: number | null;
};

const MAX_RECENT = 120;
const MAX_GAP = 12;
const FIRST_FILL = 23; // first paint: enough for the 24-bar tape and the 20-row table
const POLL_MS = 1000;
const HIDDEN_POLL_MS = 5000;
const MAX_BACKOFF_MS = 15_000;
const FINALIZED_EVERY_MS = 10_000;
const SERVER_STATE: PulseState = { status: "connecting", latest: null, recent: [], finalizedLagSec: null };

let state: PulseState = SERVER_STATE;
const stateListeners = new Set<() => void>();
const blockListeners = new Set<(b: PulseBlock) => void>();
let timer: ReturnType<typeof setTimeout> | null = null;
let running = false;
let inFlight = false;
let failures = 0;
let finalizedAt = 0;
// Paced replay: blocks waiting for block listeners, handed out one every `replayGap` ms.
const queue: PulseBlock[] = [];
let replayTimer: ReturnType<typeof setTimeout> | null = null;
let replayGap = 0;

function set(next: Partial<PulseState>) {
  state = { ...state, ...next };
  stateListeners.forEach((l) => l());
}

function toPulse(b: Block): PulseBlock {
  return {
    number: b.number ?? 0n,
    timestamp: Number(b.timestamp),
    txCount: b.transactions.length,
    gasUsed: b.gasUsed,
    gasLimit: b.gasLimit,
    baseFeePerGas: b.baseFeePerGas ?? null,
  };
}

const pollMs = () => (document.hidden ? HIDDEN_POLL_MS : POLL_MS);

function replay() {
  replayTimer = null;
  const b = queue.shift();
  if (!b) return;
  blockListeners.forEach((l) => l(b));
  if (queue.length) replayTimer = setTimeout(replay, replayGap);
}

async function tick() {
  timer = null;
  inFlight = true;
  const started = Date.now();
  const wantFinalized = started - finalizedAt >= FINALIZED_EVERY_MS;
  if (wantFinalized) finalizedAt = started;
  try {
    const [raw, finalized] = await Promise.all([
      publicClient.getBlock({ blockTag: "latest" }),
      wantFinalized ? publicClient.getBlock({ blockTag: "finalized" }).catch(() => null) : null,
    ]);
    const head = toPulse(raw);
    const prev = state.latest;
    const next: Partial<PulseState> = {};
    if (state.status !== "live") next.status = "live";
    if (finalized) next.finalizedLagSec = head.timestamp - Number(finalized.timestamp);
    if (!prev || head.number > prev.number) {
      // Fill the gap since the last poll (on the first poll, the blocks before head). Hidden tabs skip later gaps.
      const from = prev?.number ?? head.number - BigInt(FIRST_FILL + 1);
      const gap = document.hidden && prev ? 0 : Math.min(prev ? MAX_GAP : FIRST_FILL, Number(head.number - from) - 1);
      const filled = await Promise.all(
        Array.from({ length: gap }, (_, i) => publicClient.getBlock({ blockNumber: head.number - BigInt(gap - i) })),
      ).catch(() => []);
      const fresh = [...filled.map(toPulse), head];
      next.latest = head;
      next.recent = [...state.recent, ...fresh].slice(-MAX_RECENT);
      queue.push(...fresh);
      replayGap = pollMs() / queue.length;
      if (!replayTimer) replay();
    }
    if (Object.keys(next).length) set(next);
    failures = 0;
  } catch {
    failures++;
    const status = state.latest ? "reconnecting" : "connecting";
    if (state.status !== status) set({ status });
  }
  inFlight = false;
  if (running) {
    const wait = failures ? Math.min(MAX_BACKOFF_MS, POLL_MS * 2 ** failures) : pollMs() - (Date.now() - started);
    timer = setTimeout(tick, Math.max(0, wait));
  }
}

/** Back from a hidden tab: poll now instead of waiting out the slow hidden interval. */
function onVisibility() {
  if (!document.hidden && timer && !failures) {
    clearTimeout(timer);
    void tick();
  }
}

function refresh() {
  const wanted = stateListeners.size + blockListeners.size > 0;
  if (wanted && !running) {
    running = true;
    document.addEventListener("visibilitychange", onVisibility);
    if (!inFlight) void tick();
  } else if (!wanted && running) {
    running = false;
    document.removeEventListener("visibilitychange", onVisibility);
    if (timer) clearTimeout(timer);
    timer = null;
  }
}

function subscribe(l: () => void) {
  stateListeners.add(l);
  refresh();
  return () => {
    stateListeners.delete(l);
    refresh();
  };
}

export function useChainPulse(): PulseState {
  return useSyncExternalStore(subscribe, () => state, () => SERVER_STATE);
}

/** Per-block callback for canvases and tickers, paced at the chain's rhythm. Returns an unsubscribe function. */
export function onPulseBlock(fn: (b: PulseBlock) => void): () => void {
  blockListeners.add(fn);
  refresh();
  return () => {
    blockListeners.delete(fn);
    refresh();
  };
}

/**
 * Block time and throughput over `blocks` (oldest first), plus the newest base fee.
 * Timestamps are whole seconds, so block time is measured between the first blocks of two different
 * seconds, which is exact to one block. ArbOS opens every block with one system transaction; tx/s leaves it out.
 */
export function pulseStats(blocks: PulseBlock[]) {
  let first: PulseBlock | undefined;
  let last: PulseBlock | undefined;
  let txs = 0;
  blocks.forEach((b, i) => {
    txs += Math.max(0, b.txCount - 1);
    if (i && b.timestamp !== blocks[i - 1].timestamp) {
      first ??= b;
      last = b;
    }
  });
  const blockTimeMs =
    first && last && last !== first ? ((last.timestamp - first.timestamp) * 1000) / Number(last.number - first.number) : null;
  const fee = blocks.at(-1)?.baseFeePerGas;
  return {
    blockTimeMs,
    txPerSec: blockTimeMs ? (txs / blocks.length) * (1000 / blockTimeMs) : null,
    baseFeeGwei: fee == null ? null : Number(fee) / 1e9,
  };
}
