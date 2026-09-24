import { open, type Envelope, type Identity } from "@/lib/seal";
import type { ListedNode, NodeOffer } from "./protocol";

/** Browser side of the relay. Everything sent through here is already sealed. */

export async function fetchNodes(): Promise<ListedNode[]> {
  const r = await fetch("/api/relay/nodes", { cache: "no-store" });
  if (!r.ok) throw new Error("The relay didn't answer. Try again in a moment.");
  return ((await r.json()) as { nodes: ListedNode[] }).nodes;
}

export async function announceNode(offer: NodeOffer): Promise<void> {
  const r = await fetch("/api/relay/nodes", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(offer),
  });
  if (!r.ok) throw new Error(((await r.json().catch(() => ({}))) as { error?: string }).error ?? "The relay refused this node.");
}

/**
 * Streams envelopes addressed to `me`. The relay opens a stream only for a key's holder, so every
 * connect first opens a fresh sealed challenge. Each proof works once, so this reconnects by
 * itself after a drop: a new challenge after 1 s, doubling up to 15 s. The relay ends each stream
 * after a few minutes with `bye`; then this reconnects at once. Either way it asks for everything
 * after the last id it saw, so envelopes sent in between still arrive.
 */
export function listen(me: Identity, onEnvelope: (e: Envelope) => void, onOpen?: (open: boolean) => void): () => void {
  let es: EventSource | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let wait = 1_000;
  let closed = false;
  let after = "";

  function retry() {
    es?.close();
    if (closed) return;
    onOpen?.(false);
    timer = setTimeout(connect, wait);
    wait = Math.min(wait * 2, 15_000);
  }

  async function connect() {
    try {
      const r = await fetch(`/api/relay/challenge?key=${encodeURIComponent(me.pub)}`, { cache: "no-store" });
      if (!r.ok) throw new Error(r.statusText);
      const { id, envelope } = (await r.json()) as { id: string; envelope: Envelope };
      const proof = open(envelope, me);
      if (closed) return;
      const q = new URLSearchParams({ key: me.pub, id, proof });
      if (after) q.set("after", after);
      es = new EventSource(`/api/relay/stream?${q}`);
    } catch {
      return retry();
    }
    const seen = (m: MessageEvent) => (after = m.lastEventId || after);
    es.addEventListener("ready", seen);
    es.addEventListener("bye", () => {
      es?.close();
      void connect();
    });
    es.onmessage = (m) => {
      seen(m);
      try {
        onEnvelope(JSON.parse(m.data) as Envelope);
      } catch {
        // not an envelope; ignore
      }
    };
    es.onopen = () => {
      wait = 1_000;
      onOpen?.(true);
    };
    es.onerror = retry;
  }

  void connect();
  return () => {
    closed = true;
    clearTimeout(timer);
    es?.close();
  };
}

/** True when someone was listening on the envelope's `to` key. */
export async function sendSealed(env: Envelope): Promise<boolean> {
  const post = () =>
    fetch("/api/relay/send", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(env),
    });
  let r = await post();
  // Over the relay's rate limit: wait as long as it says, then try once more rather than give up on the peer.
  if (r.status === 429) {
    await new Promise((ok) => setTimeout(ok, 1000 * (Number(r.headers.get("retry-after")) || 1)));
    r = await post();
  }
  return r.status === 202;
}
