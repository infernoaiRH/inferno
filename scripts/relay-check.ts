/**
 * Self-check for src/lib/relay: both stores (memory always, Redis too when REDIS_URL is set), node-key
 * binding, key-possession proofs, limits. Run: node scripts/relay-check.ts
 * Redis: docker run --rm -d -p 6399:6379 redis:7-alpine, then REDIS_URL=redis://127.0.0.1:6399 node scripts/relay-check.ts
 */
import assert from "node:assert/strict";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
// @ts-expect-error -- Node's type stripping needs the .ts extension; the shared tsconfig doesn't allow it
import { Bucket, Challenges, MemoryStore, Streams, type Limits, type Store } from "../src/lib/relay/hub.ts";
// @ts-expect-error -- as above
import { RedisStore } from "../src/lib/relay/redis.ts";
// @ts-expect-error -- as above
import { nodeBindingMessage, verifyNodeOffer } from "../src/lib/relay/protocol.ts";
// @ts-expect-error -- as above
import { newIdentity, open, seal, toB64u } from "../src/lib/seal/index.ts";

type O = { key: string; model: string };
const sleep = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

/** The relay's behavior through the Store interface. `make(ttlMs)` builds a fresh store; `tag` keeps runs apart in a shared Redis. */
async function checkStore(name: string, make: (ttlMs: number) => Store<O>) {
  const store = make(30_000);
  const tag = crypto.randomUUID().slice(0, 8);
  const K = (s: string) => `${tag}-${s}`;
  const listen = async (s: Store<O>, ip: string, key: string, after?: string) => {
    const l = await s.open(ip, key, after);
    assert.ok(typeof l === "object", `${name}: opened a stream on ${key}`);
    return l;
  };
  const listed = async (s: Store<O>) => (await s.list()).map((o) => o.key).filter((k) => k.startsWith(tag)).sort();

  // Offline recipient: nobody has a stream on the key, so /send answers 404.
  assert.equal(await store.send(K("nobody"), "x"), false, `${name}: offline recipient`);

  // Resume: a stream the host cuts off comes back after the last id it saw, and loses nothing sent in between.
  const a = await listen(store, "ip", K("asker"));
  assert.equal(await store.send(K("asker"), "e1"), true);
  const [e1] = await a.read(1_000);
  assert.equal(e1.data, "e1");
  assert.equal(a.last, e1.id);
  await a.close(false);
  assert.equal(await store.send(K("asker"), "e2"), true, `${name}: accepted while the client reconnects`);
  assert.equal(await store.send(K("asker"), "e3"), true);
  const b = await listen(store, "ip", K("asker"), e1.id);
  assert.deepEqual((await b.read(1_000)).map((e) => e.data), ["e2", "e3"], `${name}: resumes after the last id seen`);
  const waiting = b.read(5_000);
  assert.equal(await store.send(K("asker"), "e4"), true);
  assert.deepEqual((await waiting).map((e) => e.data), ["e4"], `${name}: a waiting read wakes up`);
  // A stream that saw nothing resumes from where it started (the `ready` id).
  const quiet = await listen(store, "ip", K("quiet"));
  const start = quiet.last;
  await quiet.close(false);
  assert.equal(await store.send(K("quiet"), "q1"), true);
  const quiet2 = await listen(store, "ip", K("quiet"), start);
  assert.deepEqual((await quiet2.read(1_000)).map((e) => e.data), ["q1"], `${name}: resumes from the start id`);
  await quiet2.close(true);
  const fresh = await listen(store, "ip", K("quiet"));
  assert.deepEqual(await fresh.read(50), [], `${name}: a new stream starts after the newest entry`);
  await fresh.close(true);
  // A drop noticed late, after the client is back on a new stream, leaves the key online.
  const back = await listen(store, "ip", K("asker"), b.last);
  await b.close(true);
  assert.equal(await store.send(K("asker"), "e5"), true, `${name}: still online on the new stream`);
  assert.deepEqual((await back.read(1_000)).map((e) => e.data), ["e5"]);
  // The listener left for good: its key goes offline at once.
  await back.close(true);
  assert.equal(await store.send(K("asker"), "e6"), false, `${name}: offline once the stream is gone`);
  assert.deepEqual(await b.read(50), [], `${name}: a closed stream reads nothing`);

  // Challenges answer once, for their own key and nonce.
  let id = await store.challenge(K("holder"), "nonce");
  assert.equal(await store.redeem(id, K("eve"), "nonce"), false, `${name}: another key`);
  assert.equal(await store.redeem(id, K("holder"), "nonce"), false, `${name}: a wrong answer uses it up`);
  id = await store.challenge(K("holder"), "nonce");
  assert.equal(await store.redeem(id, K("holder"), "guess"), false, `${name}: wrong nonce`);
  id = await store.challenge(K("holder"), "nonce");
  assert.equal(await store.redeem(id, K("holder"), "nonce"), true);
  assert.equal(await store.redeem(id, K("holder"), "nonce"), false, `${name}: used once`);
  assert.equal(await store.redeem("no-such-id", K("holder"), "nonce"), false, `${name}: unknown id`);

  // Caps: 4 streams per key; a refused stream holds no slot, a closed one gives its slot back.
  const held = [];
  for (let i = 0; i < 4; i++) held.push(await listen(store, `ip-${i}`, K("capped")));
  assert.equal(await store.open("ip-9", K("capped")), "busy", `${name}: 5th stream on one key`);
  await held[0].close(false);
  held[0] = await listen(store, "ip-9", K("capped"));
  assert.equal(await store.open("ip-9", K("capped")), "busy", `${name}: and only one`);
  await Promise.all(held.map((l) => l.close(true)));

  // Listing: announced nodes with an open stream; a node whose stream closed drops off.
  await store.announce({ key: K("n1"), model: "m" });
  await store.announce({ key: K("n2"), model: "m" });
  assert.deepEqual(await listed(store), [], `${name}: announced but not listening`);
  const s1 = await listen(store, "ip", K("n1"));
  const s2 = await listen(store, "ip", K("n2"));
  assert.deepEqual(await listed(store), [K("n1"), K("n2")]);
  await s1.close(true);
  assert.deepEqual(await listed(store), [K("n2")], `${name}: n1's stream closed`);
  await s2.close(true);
  assert.deepEqual(await listed(store), [], `${name}: n2's too`);

  // With a short TTL: an open stream keeps its node listed past the offer's TTL (a background tab's
  // heartbeats come late), and a stream that stops touching (its function crashed) goes offline.
  const ttl = 300;
  const short = make(ttl);
  await short.announce({ key: K("n3"), model: "m" });
  const s3 = await listen(short, "ip", K("n3"));
  for (let i = 0; i < 3; i++) {
    await sleep(ttl * 0.6);
    await s3.touch();
  }
  assert.deepEqual(await listed(short), [K("n3")], `${name}: listed while its stream touches`);
  await sleep(ttl * 1.5);
  assert.deepEqual(await listed(short), [], `${name}: gone after the TTL without a touch`);
  assert.equal(await short.send(K("n3"), "x"), false, `${name}: and offline`);
  await s3.close(false);
}

const limits = (ttlMs: number, streams = 1_000): Limits => ({ ttlMs, streams, perIp: 20, perKey: 4 });
await checkStore("memory", (ttlMs) => new MemoryStore<O>(limits(ttlMs)));
const url = process.env.REDIS_URL;
if (url) await checkStore("redis", (ttlMs) => new RedisStore<O>(url, limits(ttlMs)));

// The global cap: the relay refuses streams once it holds `streams` of them.
const tiny = new MemoryStore<O>(limits(30_000, 1));
assert.equal(typeof (await tiny.open("ip", "k1")), "object");
assert.equal(await tiny.open("ip", "k2"), "full");

// Binding: a wallet's signature vouches for exactly its node key, on its chain.
const account = privateKeyToAccount(generatePrivateKey());
const key = "A".repeat(43);
const signature = await account.signMessage({ message: nodeBindingMessage(account.address, key, 4663) });
const offer = { address: account.address, key, model: "m", modelName: "M", chainId: 4663, signature };
assert.equal(await verifyNodeOffer(offer), true);
assert.equal(await verifyNodeOffer({ ...offer, key: "B".repeat(43) }), false, "swapped key");
assert.equal(await verifyNodeOffer({ ...offer, chainId: 1 }), false, "other chain");
assert.equal(await verifyNodeOffer({ ...offer, address: privateKeyToAccount(generatePrivateKey()).address }), false, "other wallet");

// Proof of key possession, as /challenge and /stream use it: a nonce sealed to a key opens only for
// its holder, and a challenge answers once, within 60 s, for the key it was made for.
const relayId = newIdentity();
const holder = newIdentity();
const eve = newIdentity();
const ch = new Challenges(60_000);
const ask = (key: string, now: number) => {
  const nonce = toB64u(crypto.getRandomValues(new Uint8Array(32)));
  return { id: ch.add(key, nonce, now), envelope: seal(nonce, relayId, key) };
};
let c = ask(holder.pub, 0);
assert.throws(() => open(c.envelope, eve), "only the key's holder opens it");
const proof = open(c.envelope, holder);
assert.equal(ch.redeem(c.id, holder.pub, proof, 60_000), true);
assert.equal(ch.redeem(c.id, holder.pub, proof, 60_000), false, "used once");
c = ask(holder.pub, 0);
assert.equal(ch.redeem(c.id, eve.pub, open(c.envelope, holder), 1), false, "another key");
c = ask(holder.pub, 0);
assert.equal(ch.redeem(c.id, holder.pub, "guess", 1), false, "wrong nonce");
assert.equal(ch.redeem(c.id, holder.pub, open(c.envelope, holder), 1), false, "a wrong answer uses it up");
c = ask(holder.pub, 0);
assert.equal(ch.redeem(c.id, holder.pub, open(c.envelope, holder), 60_001), false, "expired");
c = ask(holder.pub, 0);
ask(holder.pub, 120_000); // sweeps the expired ones
assert.equal(ch.redeem(c.id, holder.pub, open(c.envelope, holder), 1), false, "swept");
assert.equal(ch.redeem("no-such-id", holder.pub, proof, 1), false, "unknown id");

// Token buckets: /send allows 20 a second with a burst of 60, per client.
const send = new Bucket(20, 60);
for (let i = 0; i < 60; i++) assert.equal(send.take("1.2.3.4", 0), 0);
assert.equal(send.take("1.2.3.4", 0), 1, "burst spent: retry after 1 s");
assert.equal(send.take("5.6.7.8", 0), 0, "each client has its own bucket");
assert.equal(send.take("1.2.3.4", 50), 0, "one token back after 50 ms");
assert.equal(send.take("1.2.3.4", 50), 1);
const announce = new Bucket(0.5, 1);
assert.equal(announce.take("ip", 0), 0);
assert.equal(announce.take("ip", 0), 2, "one per 2 s");
assert.equal(announce.take("ip", 2_000), 0);

// Stream caps: 4 per key and 20 per IP; a release frees exactly one slot, however often it's called.
const streams = new Streams(20, 4);
const onKey = [1, 2, 3, 4].map(() => streams.add("ip-a", "key-1"));
assert.ok(onKey.every(Boolean));
assert.equal(streams.add("ip-b", "key-1"), null, "5th stream on one key");
onKey[0]!();
onKey[0]!();
assert.equal(streams.total, 3, "released once");
assert.ok(streams.add("ip-b", "key-1"), "a slot came back");
assert.equal(streams.add("ip-b", "key-1"), null, "and only one");
for (let i = 0; i < 17; i++) assert.ok(streams.add("ip-a", `key-${i + 2}`));
assert.equal(streams.add("ip-a", "key-99"), null, "21st stream from one IP");
assert.ok(streams.add("ip-c", "key-99"), "other IPs unaffected");

console.log(`relay-check: all passed (memory${url ? " and redis" : ""})`);
process.exit(0); // Redis connections would keep Node running
