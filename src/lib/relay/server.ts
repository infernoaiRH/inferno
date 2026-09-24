import { newIdentity, seal, toB64u, type Envelope, type Identity } from "@/lib/seal";
import { CHAIN } from "@/lib/chain";
import { Bucket, MemoryStore, type Store } from "./hub";
import { NODE_TTL_MS, verifyNodeOffer, type NodeOffer } from "./protocol";
import { RedisStore } from "./redis";

/**
 * With REDIS_URL (or KV_URL) set, the relay keeps its state in Redis and runs on any number of
 * instances (Vercel). Without it, the state lives in this process's memory, which needs exactly one
 * long-running server (docs/deploy.md); on Vercel that would split lenders across instances, so
 * the relay stays off there instead. Rate limits are per instance either way.
 */
type Relay = { me: Identity; send: Bucket; announce: Bucket; challenge: Bucket; list: Bucket };
// Each route is bundled on its own; globalThis is what they share.
const g = globalThis as unknown as { infernoRelay?: Relay; infernoStore?: Store<NodeOffer> | null };
export const relay = (g.infernoRelay ??= {
  me: newIdentity(), // seals challenges; one per process
  // Per IP: tokens a second, burst.
  send: new Bucket(20, 60),
  announce: new Bucket(0.5, 3),
  challenge: new Bucket(5, 10),
  list: new Bucket(2, 20), // each listing is 2 Redis commands; the lender list polls every 10 s
});
// How long a key stays online without a sign of life; streams open at once in all, per IP and per key.
const limits ={ ttlMs: NODE_TTL_MS, streams: 1_000, perIp: 20, perKey: 4 };
const redisUrl = process.env.REDIS_URL || process.env.KV_URL;
const store = (g.infernoStore ??= redisUrl
  ? new RedisStore<NodeOffer>(redisUrl, limits)
  : process.env.VERCEL === "1"
    ? null
    : new MemoryStore<NodeOffer>(limits));

/** Where the relay keeps its state, or a 503 on a server with nowhere to keep it (Vercel without Redis). */
export function relayStore(): Store<NodeOffer> | Response {
  return store ?? refuse(503, "The relay isn't set up on this server yet.");
}

const B64U = /^[A-Za-z0-9_-]+$/;
export const isKey = (s: unknown): s is string => typeof s === "string" && s.length === 43 && B64U.test(s);
const MAX_BODY = 256 * 1024;

/**
 * The caller's IP for limits: the first hop of `x-forwarded-for` (or of CLIENT_IP_HEADER, such as
 * fly-client-ip on Fly), trusted only with TRUST_PROXY=1. Without a proxy vouching for the header
 * anyone could forge it, so every caller shares one set of limits.
 * ponytail: an IPv6 client can rotate addresses within its /64; count by /64 if that gets abused.
 */
export function clientIp(req: Request): string {
  // Vercel overwrites x-forwarded-for with the real client address, so it is trusted there by default.
  if (process.env.TRUST_PROXY !== "1" && process.env.VERCEL !== "1") return "direct";
  return req.headers.get(process.env.CLIENT_IP_HEADER || "x-forwarded-for")?.split(",")[0].trim() || "unknown";
}

/** A plain-text refusal. `retryAfter` (seconds) goes out as a retry-after header. */
export function refuse(status: number, message: string, retryAfter?: number): Response {
  return new Response(message, { status, headers: retryAfter ? { "retry-after": String(retryAfter) } : {} });
}

/** A 429 when the caller's bucket is empty, otherwise null (and a token spent). */
export function limit(bucket: Bucket, req: Request): Response | null {
  const wait = bucket.take(clientIp(req), Date.now());
  return wait ? refuse(429, "Too many requests from your network. Wait a moment and try again.", wait) : null;
}

/** The parsed JSON body (null if it isn't JSON), or a 413 Response past 256 KB, checked before and while reading. */
export async function readJson(req: Request): Promise<unknown> {
  const tooBig = () => refuse(413, "That request is over 256 KB.");
  if (Number(req.headers.get("content-length")) > MAX_BODY) return tooBig();
  const reader = req.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (let r = await reader.read(); !r.done; r = await reader.read()) {
    size += r.value.length;
    if (size > MAX_BODY) {
      reader.cancel().catch(() => {});
      return tooBig();
    }
    chunks.push(r.value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return null;
  }
}

/** A random nonce sealed to `key` by the relay, or null when nothing can be sealed to it (a low-order point). */
export async function challenge(store: Store<NodeOffer>, key: string): Promise<{ id: string; envelope: Envelope } | null> {
  const nonce = toB64u(crypto.getRandomValues(new Uint8Array(32)));
  let envelope: Envelope;
  try {
    envelope = seal(nonce, relay.me, key);
  } catch {
    return null;
  }
  return { id: await store.challenge(key, nonce), envelope };
}

/** Shape checks only; the relay can't and doesn't open envelopes. */
export function isEnvelope(e: unknown): e is Envelope {
  const x = e as Envelope;
  return (
    !!x &&
    x.v === 1 &&
    isKey(x.from) &&
    isKey(x.to) &&
    Number.isFinite(x.ts) &&
    typeof x.nonce === "string" &&
    x.nonce.length === 32 &&
    B64U.test(x.nonce) &&
    typeof x.ct === "string" &&
    x.ct.length > 0 &&
    x.ct.length <= 200_000 &&
    B64U.test(x.ct)
  );
}

/** Accepts an offer only if it is for this chain, well formed, and signed by its wallet. */
export async function checkOffer(o: unknown): Promise<NodeOffer | null> {
  const x = o as NodeOffer;
  if (!x || x.chainId !== CHAIN.id || !isKey(x.key) || typeof x.address !== "string" || typeof x.signature !== "string") return null;
  if (typeof x.model !== "string" || x.model.length > 120 || typeof x.modelName !== "string" || x.modelName.length > 60) return null;
  const offer: NodeOffer = {
    address: x.address,
    key: x.key,
    model: x.model,
    modelName: x.modelName,
    gpu: typeof x.gpu === "string" ? x.gpu.slice(0, 80) : undefined,
    tps: typeof x.tps === "number" && Number.isFinite(x.tps) ? Math.max(0, Math.min(x.tps, 10_000)) : undefined,
    chainId: x.chainId,
    signature: x.signature,
  };
  // Heartbeats repeat the same signature every 10 s; recover it once.
  const id = `${offer.address}|${offer.key}|${offer.signature}`;
  if (verified.has(id)) return offer;
  if (!(await verifyNodeOffer(offer))) return null;
  if (verified.size > 10_000) verified.clear();
  verified.add(id);
  return offer;
}

const verified = new Set<string>();
