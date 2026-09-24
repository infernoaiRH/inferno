import { Redis } from "ioredis";
import type { Entry, Limits, Listed, Listener, Store } from "./hub";

/** Entries an inbox keeps, and how long it outlives its newest one. */
const INBOX_MAX = 256;
const INBOX_TTL_S = 120;
/** A slot outlives any stream (the stream route ends each within 300 s), so a crashed function's slot frees itself. */
const SLOT_MS = 310_000;

/**
 * The relay's state in Redis, so any number of server instances can share it (Vercel with Upstash).
 *
 *   offer:{key}        a lender's signed offer (JSON), expiring `ttlMs` after its last heartbeat or stream touch
 *   nodes              sorted set of announced keys, scored by announce time
 *   online:{key}       set while a stream is open on the key, refreshed by that stream every 10 s
 *   inbox:{key}        stream of envelopes, about the newest 256, gone 120 s after the newest
 *   chal:{id}          "key nonce" of one key-possession challenge, 60 s, read once with GETDEL
 *   streams, streams:ip:{ip}, streams:key:{key}   open streams, scored by when their slot expires
 *
 * Upstash bills every command, so an idle stream costs 3 every 10 s: its XREAD and one touch.
 * ponytail: one XREAD per stream; multiplex a server instance's streams into one XREAD if that bill grows.
 */
export class RedisStore<O extends { key: string }> implements Store<O> {
  private r: Redis;
  private limits: Limits;

  constructor(url: string, limits: Limits) {
    // Connects on first use. RESP2 with no ready check or client info: one AUTH per connection.
    this.r = new Redis(url, { lazyConnect: true, protocol: 2, enableReadyCheck: false, disableClientInfo: true });
    this.limits = limits;
  }

  async announce(offer: O) {
    const now = Date.now();
    const listed: Listed<O> = { ...offer, seenAt: now };
    await Promise.all([this.r.set(`offer:${offer.key}`, JSON.stringify(listed), "PX", this.limits.ttlMs), this.r.zadd("nodes", now, offer.key)]);
  }

  async list() {
    const keys = await this.r.zrange("nodes", 0, "-1");
    if (!keys.length) return [];
    const got = await this.r.mget(keys.flatMap((k) => [`offer:${k}`, `online:${k}`]));
    const gone = keys.filter((_, i) => !got[2 * i]);
    if (gone.length) await this.r.zrem("nodes", ...gone);
    return keys
      .flatMap((_, i) => (got[2 * i] && got[2 * i + 1] ? [JSON.parse(got[2 * i]!) as Listed<O>] : []))
      .sort((a, b) => b.seenAt - a.seenAt);
  }

  async challenge(key: string, nonce: string) {
    const id = crypto.randomUUID();
    await this.r.set(`chal:${id}`, `${key} ${nonce}`, "EX", 60);
    return id;
  }

  async redeem(id: string, key: string, proof: string) {
    return (await this.r.getdel(`chal:${id}`)) === `${key} ${proof}`;
  }

  async send(to: string, data: string) {
    if (!(await this.r.exists(`online:${to}`))) return false;
    await Promise.all([this.r.xadd(`inbox:${to}`, "MAXLEN", "~", INBOX_MAX, "*", "e", data), this.r.expire(`inbox:${to}`, INBOX_TTL_S)]);
    return true;
  }

  async open(ip: string, key: string, after?: string) {
    const now = Date.now();
    const id = crypto.randomUUID();
    const sets = ["streams", `streams:ip:${ip}`, `streams:key:${key}`];
    // Take a slot in each set first, then count, so two streams opening at once can't both slip under a cap.
    const take = (s: string) =>
      Promise.all([this.r.zremrangebyscore(s, "-inf", now), this.r.zadd(s, now + SLOT_MS, id), this.r.pexpire(s, SLOT_MS), this.r.zcard(s)]);
    const [total, byIp, byKey] = (await Promise.all(sets.map(take))).map((x) => x[3]);
    if (total > this.limits.streams || byIp > this.limits.perIp || byKey > this.limits.perKey) {
      await Promise.all(sets.map((s) => this.r.zrem(s, id)));
      return total > this.limits.streams ? "full" : "busy";
    }

    const inbox = `inbox:${key}`;
    const touch = () => Promise.all([this.r.set(`online:${key}`, "1", "PX", this.limits.ttlMs), this.r.pexpire(`offer:${key}`, this.limits.ttlMs)]);
    // The start is read before the key goes online, so nothing sent from then on can land before it.
    const start = after ?? this.r.xrevrange(inbox, "+", "-", "COUNT", 1).then((x) => x[0]?.[0] ?? "0-0");
    const [last] = await Promise.all([start, touch()]);
    // XREAD BLOCK holds its connection, so each stream gets its own.
    const sub = this.r.duplicate();
    let closed = false;
    const l: Listener = {
      last,
      read: async (ms) => {
        if (closed) return [];
        const res = await sub.xread("COUNT", 50, "BLOCK", ms, "STREAMS", inbox, l.last);
        const got: Entry[] = (res?.[0]?.[1] ?? []).map(([id, fields]) => ({ id, data: fields[1] }));
        if (got.length) l.last = got[got.length - 1].id;
        return got;
      },
      touch: async () => {
        if (!closed) await touch();
      },
      close: async (gone) => {
        if (closed) return;
        closed = true;
        sub.disconnect();
        await Promise.all(sets.map((s) => this.r.zrem(s, id)));
        // Offline now, unless the client is already back on another stream (a late-noticed drop).
        if (gone && !(await this.r.zcount(sets[2], Date.now(), "+inf"))) await this.r.del(`online:${key}`);
      },
    };
    return l;
  }

  async streams() {
    return this.r.zcount("streams", Date.now(), "+inf");
  }
}
