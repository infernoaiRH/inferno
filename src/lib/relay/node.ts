import { useEffect, useEffectEvent, useState } from "react";
import { getAddress, toHex } from "viem";
import { CHAIN } from "@/lib/chain";
import { friendlyError, modelName, NETWORK_SYSTEM, toPrompt, useLocalModel, useWebGPU } from "@/lib/llm/engine";
import { newIdentity, open, seal, type Envelope, type Identity } from "@/lib/seal";
import { announceNode, listen, sendSealed } from "./client";
import { HEARTBEAT_MS, nodeBindingMessage, type FromNode, type NodeOffer, type ToNode, type Turn } from "./protocol";

/**
 * A lender's node in a browser tab. People's words pass through memory on their way to and from
 * the model worker, and are never rendered, stored or logged here. Askers use throwaway keys, so
 * the node never learns who is asking.
 */

/** Requests waiting beyond this many are turned away. */
const MAX_QUEUE = 5;
/** Streamed text leaves in batches about this often. */
const BATCH_MS = 250; // each flush is a sealed envelope, about 4 Redis commands on Vercel; 4 a second still reads as streaming
const BUSY = "This lender is busy. Try another.";
const OFFLINE = "This lender went offline. Try another.";

export type Session = { node: Identity; offer: NodeOffer };
/** What the lender's dashboard shows: counts only, never words. `lastAt` is 0 until a request comes. */
export type Tally = { requests: number; tokens: number; waiting: number; working: boolean; lastAt: number; failed: string | null };
type Model = Pick<ReturnType<typeof useLocalModel>, "generate" | "stop">;
type Provider = { request(args: { method: string; params?: unknown[] }): Promise<unknown> };
type Job = { id: string; from: string; turns: Turn[]; gone: boolean; tail: Promise<void> };

const IDLE: Tally = { requests: 0, tokens: 0, waiting: 0, working: false, lastAt: 0, failed: null };

const isTurn = (x: unknown): x is Turn => {
  const t = x as Turn;
  return !!t && (t.role === "user" || t.role === "assistant") && typeof t.content === "string";
};

/** Anyone can send to a node key, so only well-formed requests get through. */
function parse(text: string): ToNode | null {
  const m = JSON.parse(text) as { t?: unknown; id?: unknown; turns?: unknown } | null;
  if (!m || typeof m.id !== "string" || m.id.length > 100) return null;
  if (m.t === "stop") return { t: "stop", id: m.id };
  if (m.t === "infer" && Array.isArray(m.turns) && m.turns.every(isTurn)) return { t: "infer", id: m.id, turns: m.turns };
  return null;
}

/**
 * Serves one online session until the returned function is called: listens for sealed requests,
 * answers them one at a time, and re-announces the offer every HEARTBEAT_MS.
 */
export function runNode(
  { node, offer }: Session,
  model: Model,
  setTally: (t: Tally) => void,
  setLinked: (linked: boolean) => void,
): () => void {
  const queue: Job[] = [];
  let current: Job | null = null;
  let closed = false;
  let tps = offer.tps;
  let requests = 0;
  let tokens = 0;
  let lastAt = 0;
  let failed: string | null = null;

  const tally = () => {
    if (!closed) setTally({ requests, tokens, waiting: queue.length, working: current !== null, lastAt, failed });
  };

  /** The request being answered is interrupted; a waiting one leaves the line. */
  function drop(job: Job) {
    if (job === current) return model.stop();
    const i = queue.indexOf(job);
    if (i < 0) return;
    queue.splice(i, 1);
    tally();
  }

  // Replies to one request leave one at a time, in order. `make` runs when its turn comes, so a
  // chunk carries all the text written by then. A reply that reaches nobody means the asker left.
  function reply(job: Job, make: () => FromNode | null) {
    job.tail = job.tail.then(async () => {
      const msg = job.gone ? null : make();
      if (!msg || (await sendSealed(seal(JSON.stringify(msg), node, job.from)).catch(() => false))) return;
      job.gone = true;
      drop(job);
    });
  }

  async function answer(job: Job) {
    let text = "";
    let rate = 0;
    let seq = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const flush = () => {
      clearTimeout(timer);
      timer = undefined;
      reply(job, () => {
        if (!text) return null;
        const chunk: FromNode = { t: "chunk", id: job.id, seq: seq++, text, tps: rate };
        text = "";
        return chunk;
      });
    };
    let end: FromNode;
    try {
      const a = await model.generate(toPrompt(job.turns, NETWORK_SYSTEM), (delta, t) => {
        text += delta;
        rate = t;
        timer ??= setTimeout(flush, BATCH_MS);
      });
      tps = a.stats?.tps ?? tps;
      end = closed ? { t: "error", id: job.id, message: OFFLINE } : { t: "done", id: job.id, stopped: a.stopped, stats: a.stats, gpu: offer.gpu };
      if (!job.gone) {
        requests++;
        tokens += a.stats?.answerTokens ?? 0;
        failed = null;
      }
    } catch (err) {
      failed = friendlyError(err instanceof Error ? err.message : String(err));
      end = { t: "error", id: job.id, message: failed };
    }
    flush();
    reply(job, () => end);
    await job.tail;
  }

  async function work() {
    if (current) return;
    for (let job = queue.shift(); job; job = queue.shift()) {
      current = job;
      tally();
      await answer(job);
    }
    current = null;
    tally();
  }

  function onEnvelope(env: Envelope) {
    let msg: ToNode | null = null;
    try {
      msg = parse(open(env, node));
    } catch {
      // Not sealed for this node, changed on the way, or not JSON: ignore it.
    }
    if (!msg) return;
    const { id } = msg;
    if (msg.t === "stop") {
      const job = [current, ...queue].find((j) => j?.id === id && j.from === env.from);
      if (!job) return;
      drop(job);
      if (job !== current) reply(job, () => ({ t: "done", id, stopped: true }));
      return;
    }
    const job: Job = { id, from: env.from, turns: msg.turns, gone: false, tail: Promise.resolve() };
    if (queue.length >= MAX_QUEUE) return reply(job, () => ({ t: "error", id, message: BUSY }));
    const ahead = queue.length + (current ? 1 : 0);
    reply(job, () => ({ t: "accepted", id, model: offer.model, ahead }));
    queue.push(job);
    lastAt = Date.now();
    tally();
    void work();
  }

  const unlisten = listen(node, onEnvelope, setLinked);
  // ponytail: browsers slow timers in tabs hidden for minutes, which can stretch this past the
  // relay's NODE_TTL_MS; let the relay count an open stream as alive if lenders drop off the list.
  const beat = setInterval(() => void announceNode({ ...offer, tps }).catch(() => {}), HEARTBEAT_MS);
  return () => {
    closed = true;
    clearInterval(beat);
    unlisten();
    for (const job of queue.splice(0)) reply(job, () => ({ t: "error", id: job.id, message: OFFLINE }));
    if (current) model.stop();
  };
}

/** Load a model, sign a node key with the wallet, and answer sealed requests from this tab. */
export function useServeNode() {
  const gpu = useWebGPU();
  const { status, load, generate, stop } = useLocalModel();
  const [session, setSession] = useState<Session | null>(null);
  const [tally, setTally] = useState(IDLE);
  const [linked, setLinked] = useState(false);
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // useLocalModel hands out new functions each render; these always call the current ones.
  const generateNow = useEffectEvent(generate);
  const stopNow = useEffectEvent(stop);

  useEffect(() => {
    if (!session) return;
    return runNode(session, { generate: (m, onDelta) => generateNow(m, onDelta), stop: () => stopNow() }, setTally, setLinked);
  }, [session]);

  /** Call on a button press. The node key lives in this tab's memory for this session only. */
  async function goOnline(address: `0x${string}`, provider: Provider) {
    if (status.state !== "ready" || session || signing) return;
    const model = status.model;
    setError(null);
    setSigning(true);
    try {
      const node = newIdentity();
      const message = nodeBindingMessage(address, node.pub, CHAIN.id);
      const signature = (await provider.request({ method: "personal_sign", params: [toHex(message), address] })) as `0x${string}`;
      const offer: NodeOffer = {
        address: getAddress(address),
        key: node.pub,
        model,
        modelName: modelName(model),
        gpu: (gpu.state === "ok" && gpu.name) || undefined,
        chainId: CHAIN.id,
        signature,
      };
      await announceNode(offer);
      setTally(IDLE);
      setLinked(false);
      setSession({ node, offer });
    } catch (err) {
      const e = err as { code?: number; message?: string } | null;
      setError(e?.code === 4001 ? "You declined the signature, so this tab stays offline." : e?.message || "Going online didn't work. Try again.");
    } finally {
      setSigning(false);
    }
  }

  return {
    gpu,
    status,
    load,
    online: session?.offer ?? null,
    tally,
    linked,
    signing,
    error,
    goOnline,
    goOffline: () => setSession(null),
  };
}
