import { useEffect, useRef } from "react";
import { toPrompt, type Answer } from "@/lib/llm/engine";
import { watchRequests } from "@/lib/llm/requests";
import { newIdentity, open, seal, type Envelope, type Identity } from "@/lib/seal";
import { listen, sendSealed } from "./client";
import type { FromNode, ListedNode, NodeStats, ToNode, Turn } from "./protocol";

/** One network answer. `gpu` is the lender's GPU as its browser names it; `hosts` leave out the relay. `bill` is set when credits paid for it. */
export type RemoteAnswer = Answer & { gpu: string; bill?: { usd: number } };

// Paid network mode: when this server has payments on, a signed-in wallet pays per answer in credits.
let paymentsOnServer: Promise<boolean> | null = null;
export const networkPaid = () =>
  (paymentsOnServer ??= fetch("/api/credits/config", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .then((c: { enabled?: boolean } | null) => c?.enabled === true)
    .catch(() => false));

/** Two small answers' worth; below it, top up before asking a lender. */
const MIN_CREDITS_MICRO_USD = 20_000;

/** Throws a message for people when payments are on and this wallet can't pay. True when the answer will be charged. */
async function ensureCredits(): Promise<boolean> {
  if (!(await networkPaid())) return false;
  const r = await fetch("/api/credits/me", { cache: "no-store" });
  if (r.status === 401) throw new Error("Network answers are paid with Inferno credits. Sign in from the wallet menu, then ask again.");
  const me = (r.ok ? await r.json() : null) as { balanceMicroUsd?: number } | null;
  if (!me || (me.balanceMicroUsd ?? 0) < MIN_CREDITS_MICRO_USD)
    throw new Error("You're out of credits for network answers. Top up on the Credits page, or use private mode.");
  return true;
}

/** Books one answer against the signed-in wallet. The answer is kept even if this fails. */
async function settle(ref: string, lender: string, stats: NodeStats): Promise<{ usd: number } | undefined> {
  const r = await fetch("/api/credits/usage", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ref, lender, promptTokens: stats.promptTokens, answerTokens: stats.answerTokens }),
  }).catch(() => null);
  window.dispatchEvent(new Event("inferno:credits")); // refresh balances shown elsewhere
  if (!r?.ok) return undefined;
  const b = (await r.json().catch(() => null)) as { costMicroUsd?: number } | null;
  return typeof b?.costMicroUsd === "number" ? { usd: b.costMicroUsd / 1e6 } : undefined;
}

type Run = {
  id: string;
  me: Identity;
  node: ListedNode;
  /** The `seq` of the next chunk to show; chunks that arrive early wait in `held`. */
  next: number;
  held: Map<number, { text: string; tps: number }>;
  onDelta: (text: string, tps: number) => void;
  onAhead: (ahead: number) => void;
  done: (answer: Omit<RemoteAnswer, "hosts">) => void;
  fail: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

/** The lender is gone or silent, so the asker should pick another. */
export class LenderGone extends Error {}

const OFFLINE = "That lender just went offline. Pick another.";
const NO_RELAY = "The relay didn't answer. Try again in a moment.";
/** The relay refuses envelopes bigger than this (src/lib/relay/server.ts). */
const MAX_CT = 200_000;

/** The lender's numbers end up in a saved receipt: keep them only if they are numbers (JSON sends NaN as null). */
function numbers(s: NodeStats | undefined): NodeStats | undefined {
  if (!s) return undefined;
  const { promptTokens, answerTokens, tps, firstTokenS, totalS } = s;
  const n = { promptTokens, answerTokens, tps, firstTokenS, totalS };
  return Object.values(n).every((x) => x === null || typeof x === "number") ? n : undefined;
}

/**
 * Asks a lender's GPU through the relay. Each chat gets a throwaway key made in this tab and never
 * tied to a wallet, so the lender can't tell who is asking. Prompts are sealed to the node's key and
 * replies come back sealed to ours; the relay only routes ciphertext.
 */
export function useRemoteModel() {
  const keys = useRef(new Map<string, Identity>());
  const line = useRef<{ pub: string; ready: Promise<void>; close: () => void } | null>(null);
  const run = useRef<Run | null>(null);

  useEffect(
    () => () => {
      line.current?.close();
      line.current = null; // refs can outlive this cleanup (Strict Mode, Activity): the next ask listens again
    },
    [],
  );

  function onEnvelope(env: Envelope) {
    const r = run.current;
    // Anyone can seal a note to our key; only the node we asked speaks for this answer.
    if (!r || env.from !== r.node.key) return;
    let m: FromNode;
    try {
      m = JSON.parse(open(env, r.me));
    } catch {
      return;
    }
    if (m?.id !== r.id) return;
    clearTimeout(r.timer);
    if (m.t === "accepted") r.onAhead(Number.isInteger(m.ahead) && m.ahead > 0 ? m.ahead : 0);
    else if (m.t === "chunk") {
      if (typeof m.text !== "string" || !Number.isInteger(m.seq) || m.seq < r.next) return;
      r.held.set(m.seq, { text: m.text, tps: Number(m.tps) || 0 });
      for (let c = r.held.get(r.next); c; c = r.held.get(r.next)) {
        r.held.delete(r.next++);
        r.onDelta(c.text, c.tps);
      }
    } else if (m.t === "done") {
      // A chunk lost on the way leaves later ones held: show them in order rather than not at all.
      [...r.held].sort(([a], [b]) => a - b).forEach(([, c]) => r.onDelta(c.text, c.tps));
      const gpu = typeof m.gpu === "string" ? m.gpu.slice(0, 80) : (r.node.gpu ?? "");
      r.done({ stopped: m.stopped === true, stats: numbers(m.stats), gpu });
    } else if (m.t === "error") r.fail(new Error(String(m.message).slice(0, 300)));
  }

  /** One listener at a time: each holds a request open, and browsers allow only a few per site. */
  function listenAs(me: Identity): Promise<void> {
    if (line.current?.pub !== me.pub) {
      line.current?.close();
      let opened = () => {};
      const ready = new Promise<void>((resolve) => (opened = resolve));
      line.current = { pub: me.pub, ready, close: listen(me, onEnvelope, (ok) => ok && opened()) };
    }
    return line.current.ready;
  }

  /** Streams one answer from `node` for the chat `chatId`, chunks in order, with the lender's queue position. */
  async function generate(
    chatId: string,
    node: ListedNode,
    turns: Turn[],
    onDelta: Run["onDelta"],
    onAhead: Run["onAhead"],
  ): Promise<RemoteAnswer> {
    const paid = await ensureCredits();
    const me = keys.current.get(chatId) ?? newIdentity();
    keys.current.set(chatId, me);
    const ready = listenAs(me);
    const id = crypto.randomUUID();
    // Only what the model would read (toPrompt's trim), without the system prompt: the lender adds its own.
    const ask: ToNode = { t: "infer", id, turns: toPrompt(turns).filter((t) => t.role !== "system") as Turn[] };
    // Tokens are never fewer bytes than text, so the lender's counts are capped at what actually moved.
    const bytes = (s: string) => new TextEncoder().encode(s).length;
    const promptBytes = bytes(ask.turns.map((x) => x.content).join("\n"));
    let answerBytes = 0;
    const counted: Run["onDelta"] = (text, tps) => {
      answerBytes += bytes(text);
      onDelta(text, tps);
    };
    const env = seal(JSON.stringify(ask), me, node.key);
    if (env.ct.length > MAX_CT) throw new Error("That is too long to send to a lender. Send something shorter, or start a new chat.");
    const requests = watchRequests();
    try {
      const answer = await new Promise<Omit<RemoteAnswer, "hosts">>((done, fail) => {
        const timer = setTimeout(
          () => fail(new LenderGone("That lender didn't answer within 10 seconds. Pick another, or try again.")),
          10_000,
        );
        const r: Run = { id, me, node, next: 0, held: new Map(), onDelta: counted, onAhead, done, fail, timer };
        run.current = r;
        // The listener must be open before the lender replies. Skip the send if the wait already ended.
        ready
          .then(() => run.current !== r || sendSealed(env))
          .then((ok) => ok || fail(new LenderGone(OFFLINE)), () => fail(new Error(NO_RELAY)));
      });
      const hosts = requests().filter((h) => h !== location.host);
      const s = answer.stats;
      const billed = s && { ...s, promptTokens: Math.min(s.promptTokens, promptBytes), answerTokens: Math.min(s.answerTokens, answerBytes) };
      const bill = paid && billed ? await settle(id, node.address, billed) : undefined;
      return { ...answer, hosts, bill };
    } catch (err) {
      requests();
      throw err;
    } finally {
      clearTimeout(run.current?.timer);
      run.current = null;
    }
  }

  /** The lender answers a sealed stop with "done" and its numbers; if that doesn't come within 3 s, end here. */
  function stop() {
    const r = run.current;
    if (!r) return;
    void sendSealed(seal(JSON.stringify({ t: "stop", id: r.id } satisfies ToNode), r.me, r.node.key)).then(
      (ok) => ok || r.fail(new LenderGone(OFFLINE)),
      () => r.fail(new Error(NO_RELAY)),
    );
    setTimeout(() => r.done({ stopped: true, gpu: r.node.gpu ?? "" }), 3_000);
  }

  return { generate, stop };
}
