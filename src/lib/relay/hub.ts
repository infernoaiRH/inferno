/**
 * The relay's whole brain: which keys are online, what waits in their inboxes, which lender nodes are
 * listed, and the limits that keep one client from hogging it. It only ever handles sealed envelopes,
 * so it routes by public key and never sees a word of a chat.
 * No imports: scripts/relay-check.ts runs this file directly under Node.
 */

/** A node offer as the relay lists it. `key` is the node's X25519 public key (base64url). */
export type Listed<O extends { key: string }> = O & { seenAt: number };

/** How long a key stays online (and its offer listed) without a sign of life, and the open-stream caps. */
export type Limits = { ttlMs: number; streams: number; perIp: number; perKey: number };

/** One envelope in a key's inbox. Ids are Redis stream ids ("ms-seq") and only ever grow. */
export type Entry = { id: string; data: string };

/** One open stream's view of its key's inbox. */
export type Listener = {
  /** The id of the last entry read; before any, where the stream starts. */
  last: string;
  /** Up to 50 entries after `last`, waiting up to `ms` for the first. Nothing once closed. */
  read(ms: number): Promise<Entry[]>;
  /** Keeps the key online, and its offer listed, for another `ttlMs`. */
  touch(): Promise<void>;
  /** Frees the stream's slot. `gone`: the client left, so the key goes offline now rather than after `ttlMs`. */
  close(gone: boolean): Promise<void>;
};

/**
 * Everything the relay remembers between requests: in this process (MemoryStore), or in Redis
 * (./redis.ts) so any number of server instances can share it.
 */
export type Store<O extends { key: string }> = {
  /** A lender says "I'm here". Re-announcing refreshes the timestamp. */
  announce(offer: O): Promise<void>;
  /** Announced nodes whose key is online, newest announcement first. */
  list(): Promise<Listed<O>[]>;
  /** Remembers `nonce` for `key` for 60 s and returns the challenge id. */
  challenge(key: string, nonce: string): Promise<string>;
  /** True for a live challenge answered with its own key and nonce. Any answer, right or wrong, uses it up. */
  redeem(id: string, key: string, proof: string): Promise<boolean>;
  /** Adds `data` to the inbox of `to`. False when `to` isn't online. */
  send(to: string, data: string): Promise<boolean>;
  /**
   * Opens a stream on `key`'s inbox, reading after `after` (else after its newest entry), and puts
   * the key online. "full": the relay's cap on open streams; "busy": this IP's or this key's.
   */
  open(ip: string, key: string, after?: string): Promise<Listener | "full" | "busy">;
  /** Streams open right now. */
  streams(): Promise<number>;
};

/** Entries an inbox keeps, and how long it outlives its newest one (as Redis does in ./redis.ts). */
const INBOX_MAX = 256;
const INBOX_TTL_MS = 120_000;

/** True when stream id `a` comes after `b`. */
function later(a: string, b: string): boolean {
  const [am, as] = a.split("-").map(Number);
  const [bm, bs] = b.split("-").map(Number);
  return am > bm || (am === bm && as > bs);
}

/** The relay in this process's memory: exactly one long-running server (local dev, the Docker image). */
export class MemoryStore<O extends { key: string }> implements Store<O> {
  private offers = new Map<string, Listed<O>>();
  /** Key → when it stops counting as online. */
  private online = new Map<string, number>();
  private inboxes = new Map<string, { entries: Entry[]; at: number; waiting: Set<() => void> }>();
  private challenges = new Challenges(60_000);
  private caps: Streams;
  private limits: Limits;
  private lastMs = 0;
  private seq = 0;
  private swept = 0;

  constructor(limits: Limits) {
    this.limits = limits;
    this.caps = new Streams(limits.perIp, limits.perKey);
  }

  async announce(offer: O) {
    this.offers.set(offer.key, { ...offer, seenAt: Date.now() });
  }

  /**
   * An online key keeps its offer listed, because browsers slow timers in background tabs and
   * heartbeats can arrive late; the TTL only clears offers whose key went offline.
   */
  async list() {
    const now = Date.now();
    const live: Listed<O>[] = [];
    for (const [key, o] of this.offers) {
      if (this.isOnline(key, now)) live.push(o);
      else if (now - o.seenAt > this.limits.ttlMs) this.offers.delete(key);
    }
    return live.sort((a, b) => b.seenAt - a.seenAt);
  }

  async challenge(key: string, nonce: string) {
    return this.challenges.add(key, nonce, Date.now());
  }

  async redeem(id: string, key: string, proof: string) {
    return this.challenges.redeem(id, key, proof, Date.now());
  }

  async send(to: string, data: string) {
    const now = Date.now();
    if (!this.isOnline(to, now)) return false;
    if (now > this.lastMs) [this.lastMs, this.seq] = [now, 0];
    else this.seq++;
    const inbox = this.inbox(to);
    inbox.entries.push({ id: `${this.lastMs}-${this.seq}`, data });
    if (inbox.entries.length > INBOX_MAX) inbox.entries.shift();
    inbox.at = now;
    inbox.waiting.forEach((wake) => wake());
    return true;
  }

  async open(ip: string, key: string, after?: string) {
    if (this.caps.total >= this.limits.streams) return "full" as const;
    const release = this.caps.add(ip, key);
    if (!release) return "busy" as const;
    const now = Date.now();
    this.sweep(now);
    this.online.set(key, now + this.limits.ttlMs);
    let closed = false;
    let wake = () => {};
    const l: Listener = {
      last: after ?? this.inbox(key).entries.at(-1)?.id ?? "0-0",
      read: async (ms) => {
        const inbox = this.inbox(key);
        const fresh = () => inbox.entries.filter((e) => later(e.id, l.last));
        if (!closed && !fresh().length) {
          await new Promise<void>((resolve) => {
            wake = () => {
              clearTimeout(timer);
              inbox.waiting.delete(wake);
              resolve();
            };
            const timer = setTimeout(wake, ms);
            inbox.waiting.add(wake);
          });
        }
        const got = closed ? [] : fresh().slice(0, 50);
        if (got.length) l.last = got[got.length - 1].id;
        return got;
      },
      touch: async () => {
        if (!closed) this.online.set(key, Date.now() + this.limits.ttlMs);
      },
      close: async (gone) => {
        if (closed) return;
        closed = true;
        release();
        // Offline now, unless the client is already back on another stream (a late-noticed drop).
        if (gone && !this.caps.has(key)) this.online.delete(key);
        wake();
      },
    };
    return l;
  }

  async streams() {
    return this.caps.total;
  }

  private isOnline(key: string, now: number) {
    return (this.online.get(key) ?? 0) > now;
  }

  private inbox(key: string) {
    let inbox = this.inboxes.get(key);
    if (!inbox) this.inboxes.set(key, (inbox = { entries: [], at: Date.now(), waiting: new Set() }));
    return inbox;
  }

  /** Once a minute, forgets inboxes idle for INBOX_TTL_MS and keys that went offline. */
  private sweep(now: number) {
    if (now - this.swept < 60_000) return;
    this.swept = now;
    for (const [k, b] of this.inboxes) if (!b.waiting.size && now - b.at > INBOX_TTL_MS) this.inboxes.delete(k);
    for (const [k, until] of this.online) if (until <= now) this.online.delete(k);
  }
}

/**
 * Proof of key possession. The relay seals a random nonce to a key; only the key's holder can open
 * it and bring it back. A challenge answers once, within `ttlMs`, for the key it was made for.
 */
export class Challenges {
  private live = new Map<string, { key: string; nonce: string; at: number }>();
  private ttlMs: number;

  constructor(ttlMs: number) {
    this.ttlMs = ttlMs;
  }

  /** Remembers `nonce` for `key` and returns the challenge id. */
  add(key: string, nonce: string, now: number): string {
    // Oldest first, so dropping expired ones from the front keeps at most `ttlMs` worth.
    for (const [id, c] of this.live) {
      if (now - c.at <= this.ttlMs) break;
      this.live.delete(id);
    }
    const id = crypto.randomUUID();
    this.live.set(id, { key, nonce, at: now });
    return id;
  }

  /** True for a live challenge answered with its own key and nonce. Any answer, right or wrong, uses it up. */
  redeem(id: string, key: string, proof: string, now: number): boolean {
    const c = this.live.get(id);
    this.live.delete(id);
    return !!c && c.key === key && c.nonce === proof && now - c.at <= this.ttlMs;
  }
}

/** Token buckets per client: `rate` tokens a second, holding at most `burst`. */
export class Bucket {
  private tokens = new Map<string, { n: number; at: number }>();
  private rate: number;
  private burst: number;
  private swept = 0;

  constructor(rate: number, burst: number) {
    this.rate = rate;
    this.burst = burst;
  }

  /** Spends one of `ip`'s tokens: 0 when allowed, otherwise the whole seconds until the next one. */
  take(ip: string, now: number): number {
    if (now - this.swept > 60_000) {
      // A full bucket is the same as a new one, so idle clients are forgotten once a minute.
      for (const [k, b] of this.tokens) if (this.level(b, now) >= this.burst) this.tokens.delete(k);
      this.swept = now;
    }
    const b = this.tokens.get(ip);
    const n = b ? this.level(b, now) : this.burst;
    if (n < 1) return Math.ceil((1 - n) / this.rate);
    this.tokens.set(ip, { n: n - 1, at: now });
    return 0;
  }

  private level(b: { n: number; at: number }, now: number): number {
    return Math.min(this.burst, b.n + ((now - b.at) / 1000) * this.rate);
  }
}

/** Open streams, capped per client IP and per key. */
export class Streams {
  total = 0;
  private open = new Map<string, number>();
  private perIp: number;
  private perKey: number;

  constructor(perIp: number, perKey: number) {
    this.perIp = perIp;
    this.perKey = perKey;
  }

  /** Counts a new stream, or returns null past either cap. The returned release is safe to call twice. */
  add(ip: string, key: string): (() => void) | null {
    const a = `ip ${ip}`;
    const b = `key ${key}`;
    if ((this.open.get(a) ?? 0) >= this.perIp || (this.open.get(b) ?? 0) >= this.perKey) return null;
    this.bump(a, 1);
    this.bump(b, 1);
    this.total++;
    let counted = true;
    return () => {
      if (!counted) return;
      counted = false;
      this.bump(a, -1);
      this.bump(b, -1);
      this.total--;
    };
  }

  /** True while any stream is open on `key`. */
  has(key: string): boolean {
    return this.open.has(`key ${key}`);
  }

  private bump(k: string, d: number) {
    const n = (this.open.get(k) ?? 0) + d;
    if (n > 0) this.open.set(k, n);
    else this.open.delete(k);
  }
}
