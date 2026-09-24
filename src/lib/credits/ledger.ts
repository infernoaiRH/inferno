/**
 * The credits ledger on Postgres: the server at DATABASE_URL (Neon on Vercel), else PGlite (Postgres
 * in WebAssembly) in a local directory, for development and the single-instance Docker image.
 *
 * Pure on purpose: no Next.js or `@/` imports, so `node scripts/credits-check.ts` runs it as is.
 * Money is integer micro-USD (1 = $0.000001) in BIGINT columns, read back as JS numbers. CHECKs refuse
 * negative balances, and every balance change runs in one transaction holding the wallet's lock, so
 * parallel requests on any number of instances can't overdraw. Addresses and hashes are stored lowercase.
 */
import { mkdirSync } from "node:fs";
import postgres from "postgres";
import { isAddressEqual, parseAbiItem, zeroAddress, type Address, type PublicClient } from "viem";

type Env = Record<string, string | undefined>;

/** `query` returns rows. `tx` runs `fn` in one transaction (inside one, it joins it); a throw rolls all of it back. */
export type Db = {
  query: <T = Record<string, unknown>>(text: string, params?: unknown[]) => Promise<T[]>;
  tx: <T>(fn: (t: Db) => Promise<T>) => Promise<T>;
};

const PGLITE_DIR = ".data/ledger";

/** Postgres at DATABASE_URL (or POSTGRES_URL), else PGlite in the INFERNO_DB_PATH directory ("memory://" keeps it in memory). */
export async function openDb(env: Env): Promise<Db> {
  const url = env.DATABASE_URL || env.POSTGRES_URL;
  if (url) {
    // Neon's pooled URL goes through PgBouncer, which can't keep prepared statements. Idle connections
    // close, so an instance thawed after a while doesn't write to a dead socket. BIGINT and NUMERIC
    // (what SUM returns) come back as numbers: every amount here is a safe integer.
    const sql = postgres(url, { prepare: false, max: 5, idle_timeout: 20, onnotice: () => {}, types: { bigint: { to: 20, from: [20, 1700], serialize: String, parse: Number } } });
    const on = (s: Pick<typeof sql, "unsafe">) => <T,>(text: string, params: unknown[] = []) => s.unsafe<T[]>(text, params as postgres.ParameterOrJSON<number>[]);
    const joined = (t: Pick<typeof sql, "unsafe">): Db => {
      const d: Db = { query: on(t), tx: (fn) => fn(d) };
      return d;
    };
    return { query: on(sql), tx: <T,>(fn: (t: Db) => Promise<T>) => sql.begin((t) => fn(joined(t))) as Promise<T> };
  }
  const dir = env.INFERNO_DB_PATH || PGLITE_DIR;
  if (!dir.includes("://")) mkdirSync(dir, { recursive: true });
  const { PGlite } = await import("@electric-sql/pglite"); // only here, so a DATABASE_URL server never loads it
  const pg = await PGlite.create(dir, { parsers: { 20: Number, 1700: Number } });
  const on = (c: { query: <T>(text: string, params?: unknown[]) => Promise<{ rows: T[] }> }) => async <T,>(text: string, params?: unknown[]) =>
    (await c.query<T>(text, params)).rows;
  return {
    query: on(pg),
    tx: (fn) =>
      pg.transaction((t) => {
        const d: Db = { query: on(t), tx: (f) => f(d) };
        return fn(d);
      }),
  };
}

// deposits.amount is raw token units as text (a uint256 outgrows BIGINT). deposits.value is the full
// micro-USD value; credited is what the account got (at most the per-deposit and daily caps), and
// review = 1 marks a deposit whose excess over a cap waits for a manual review. funding marks a transfer
// from an admin wallet: the treasury is shared with another product, so that's funding, not a top-up.
// refunds give back the unused part of a charge (a Bittensor answer's hold), at most once per charge.
// holds are Bittensor answers being written, one per wallet; `used` is saved as one runs, for the sweep.
// meta holds indexed_at: when the deposit indexer last ran.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS accounts (
  address TEXT PRIMARY KEY,
  balance BIGINT NOT NULL CHECK (balance >= 0)
);
CREATE TABLE IF NOT EXISTS deposits (
  tx_hash TEXT NOT NULL,
  log_index INTEGER NOT NULL,
  block BIGINT NOT NULL,
  address TEXT NOT NULL,
  token TEXT NOT NULL,
  symbol TEXT NOT NULL,
  decimals INTEGER NOT NULL,
  amount TEXT NOT NULL,
  price BIGINT NOT NULL,
  value BIGINT NOT NULL,
  credited BIGINT NOT NULL CHECK (credited >= 0),
  review INTEGER NOT NULL,
  funding BOOLEAN NOT NULL,
  created_at BIGINT NOT NULL,
  UNIQUE (tx_hash, log_index)
);
CREATE INDEX IF NOT EXISTS deposits_by_address ON deposits (address);
CREATE TABLE IF NOT EXISTS charges (
  id BIGINT GENERATED ALWAYS AS IDENTITY,
  address TEXT NOT NULL,
  ref TEXT NOT NULL,
  kind TEXT NOT NULL,
  micro_usd BIGINT NOT NULL CHECK (micro_usd > 0),
  created_at BIGINT NOT NULL,
  UNIQUE (address, ref)
);
CREATE TABLE IF NOT EXISTS refunds (
  address TEXT NOT NULL,
  ref TEXT NOT NULL,
  micro_usd BIGINT NOT NULL CHECK (micro_usd > 0),
  created_at BIGINT NOT NULL,
  UNIQUE (address, ref)
);
CREATE TABLE IF NOT EXISTS holds (
  address TEXT PRIMARY KEY,
  ref TEXT NOT NULL,
  micro_usd BIGINT NOT NULL CHECK (micro_usd >= 0),
  used BIGINT NOT NULL CHECK (used >= 0),
  created_at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS lender_earnings (
  asker TEXT NOT NULL,
  ref TEXT NOT NULL,
  lender TEXT NOT NULL,
  micro_usd BIGINT NOT NULL CHECK (micro_usd >= 0),
  created_at BIGINT NOT NULL,
  UNIQUE (asker, ref)
);
CREATE INDEX IF NOT EXISTS lender_earnings_by_lender ON lender_earnings (lender);
CREATE TABLE IF NOT EXISTS payouts (
  tx_hash TEXT NOT NULL,
  address TEXT NOT NULL,
  micro_usd BIGINT NOT NULL CHECK (micro_usd > 0),
  paid_by TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  UNIQUE (tx_hash, address)
);
CREATE TABLE IF NOT EXISTS indexer_state (
  token TEXT PRIMARY KEY,
  last_block BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS nonces (
  nonce TEXT PRIMARY KEY,
  expires_at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value BIGINT NOT NULL
)`;

/**
 * Creates the ledger's tables in an empty database, and returns null; or returns why payments must
 * stay off. In production an empty database means the wrong DATABASE_URL, an unmounted volume or a
 * second copy, and a new ledger would credit every past deposit again, so it's made only with
 * INFERNO_DB_INIT=1.
 */
export async function initLedger(db: Db, env: Env): Promise<string | null> {
  const [{ ready }] = await db.query<{ ready: boolean }>("SELECT to_regclass('accounts') IS NOT NULL AS ready");
  if (ready) return null;
  if (env.NODE_ENV === "production" && env.INFERNO_DB_INIT !== "1") {
    const where = env.DATABASE_URL || env.POSTGRES_URL ? "the DATABASE_URL database" : env.INFERNO_DB_PATH || PGLITE_DIR;
    return `No ledger in ${where}. Check it's the right database (on Docker, that the /data volume is mounted), or set INFERNO_DB_INIT=1 once to create it.`;
  }
  await db.tx(async (t) => {
    await t.query("SELECT pg_advisory_xact_lock(4663, 0)"); // instances starting together create it once
    for (const statement of SCHEMA.split(";")) await t.query(statement);
  });
  return null;
}

/** Holds this wallet's lock until the transaction ends, so its balance changes run one at a time, whichever instance runs them. */
const lock = (t: Db, address: string) => t.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [address]);

const low = (s: string) => s.toLowerCase();
const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);

function assertMicro(n: number, what: string) {
  if (!Number.isSafeInteger(n) || n <= 0) throw new RangeError(`${what} must be a positive whole number of micro-USD`);
}

export async function balance(db: Db, address: string): Promise<number> {
  const [row] = await db.query<{ balance: number }>("SELECT balance FROM accounts WHERE address = $1", [low(address)]);
  return row?.balance ?? 0;
}

// ---- Deposits ---------------------------------------------------------------------------------

export type Token = { address: Address; symbol: string; decimals: number; priceMicro: number };
export type Transfer = { txHash: string; logIndex: number; block: number; from: string; amount: bigint };

/** Micro-USD value of `amount` base units at `priceMicro` per whole token, rounded down. */
export const valueMicro = (amount: bigint, decimals: number, priceMicro: number): bigint =>
  (amount * BigInt(priceMicro)) / 10n ** BigInt(decimals);

/**
 * A deposit credits at most `capMicro`, and one wallet's deposits at most `dayCapMicro` in any 24 hours.
 * Transfers from `admins` (lowercase) fund the shared treasury and credit nobody.
 * ponytail: the day counts from when deposits are credited, not mined, so a catch-up after downtime
 * sends more to review; read block timestamps if that gets in the way.
 */
export type Caps = { capMicro: number; dayCapMicro: number; admins?: ReadonlySet<string> };
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Credits final transfers into the treasury and moves the token's cursor to `toBlock`, in one
 * transaction. Idempotent per (tx_hash, log_index). Credits stop at the caps; the full value is
 * recorded and a deposit that wasn't credited in full is flagged for review. Returns how many
 * transfers were new.
 */
export function creditTransfers(db: Db, token: Token, transfers: Transfer[], caps: Caps, toBlock: number, now = Date.now()): Promise<number> {
  return db.tx(async (t) => {
    let fresh = 0;
    for (const x of transfers) {
      const from = low(x.from);
      await lock(t, from);
      const funding = caps.admins?.has(from) ?? false;
      const value = valueMicro(x.amount, token.decimals, token.priceMicro);
      const [today] = await t.query<{ n: number }>("SELECT COALESCE(SUM(credited), 0) AS n FROM deposits WHERE address = $1 AND created_at > $2", [from, now - DAY_MS]);
      const room = funding ? 0 : Math.min(caps.capMicro, caps.dayCapMicro - today.n);
      const credited = value < BigInt(room) ? Number(value) : Math.max(room, 0);
      const inserted = await t.query(
        `INSERT INTO deposits (tx_hash, log_index, block, address, token, symbol, decimals, amount, price, value, credited, review, funding, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) ON CONFLICT DO NOTHING RETURNING 1`,
        [
          low(x.txHash),
          x.logIndex,
          x.block,
          from,
          low(token.address),
          token.symbol,
          token.decimals,
          x.amount.toString(),
          token.priceMicro,
          Number(value > MAX_SAFE ? MAX_SAFE : value),
          credited,
          !funding && BigInt(credited) < value ? 1 : 0,
          funding,
          now,
        ],
      );
      if (!inserted.length) continue; // seen before
      fresh++;
      if (credited > 0)
        await t.query("INSERT INTO accounts (address, balance) VALUES ($1, $2) ON CONFLICT (address) DO UPDATE SET balance = accounts.balance + excluded.balance", [from, credited]);
    }
    await t.query(
      "INSERT INTO indexer_state (token, last_block) VALUES ($1, $2) ON CONFLICT (token) DO UPDATE SET last_block = GREATEST(indexer_state.last_block, excluded.last_block)",
      [low(token.address), toBlock],
    );
    return fresh;
  });
}

export async function lastBlock(db: Db, token: string): Promise<number | null> {
  const [row] = await db.query<{ last_block: number }>("SELECT last_block FROM indexer_state WHERE token = $1", [low(token)]);
  return row ? row.last_block : null;
}

const TRANSFER = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)");
const CHUNK = 2_000n;
const MIN_CHUNK = 50n;

export type IndexOptions = Caps & { treasury: Address; tokens: Token[]; startBlock: bigint | null };

/**
 * One indexing pass. For each token, reads Transfer(from, to = treasury) logs from its cursor up to
 * the finalized block, in chunks of at most 2,000 blocks (halved, down to 50, while the RPC refuses
 * a range), and credits each sender at the token's price. Mints (from the zero address) credit
 * nobody. A token with no cursor starts at `startBlock`, or at the current finalized block. Each
 * chunk commits with its cursor, so a pass that fails, or stops at `deadline` (ms), resumes where it
 * stopped. Returns new deposits.
 */
export async function indexTransfers(db: Db, client: PublicClient, o: IndexOptions, deadline = Infinity): Promise<number> {
  const finalized = (await client.getBlock({ blockTag: "finalized" })).number;
  let fresh = 0;
  for (const token of o.tokens) {
    const last = await lastBlock(db, token.address);
    let size = CHUNK;
    for (let from = last === null ? (o.startBlock ?? finalized) : BigInt(last) + 1n; from <= finalized && Date.now() < deadline; ) {
      const to = from + size - 1n < finalized ? from + size - 1n : finalized;
      const logs = await client
        .getLogs({ address: token.address, event: TRANSFER, args: { to: o.treasury }, fromBlock: from, toBlock: to, strict: true })
        .catch((e: unknown) => {
          if (size === MIN_CHUNK) throw e;
          return null;
        });
      if (!logs) {
        size = size / 2n > MIN_CHUNK ? size / 2n : MIN_CHUNK; // too many logs or blocks for this RPC
        continue;
      }
      const transfers = logs
        .filter((l) => l.args.value > 0n && isAddressEqual(l.address, token.address) && isAddressEqual(l.args.to, o.treasury) && !isAddressEqual(l.args.from, zeroAddress))
        .map((l) => ({ txHash: l.transactionHash, logIndex: l.logIndex, block: Number(l.blockNumber), from: l.args.from, amount: l.args.value }));
      fresh += await creditTransfers(db, token, transfers, o, Number(to));
      from = to + 1n;
    }
  }
  return fresh;
}

const EVERY_MS = 10_000;
const BUDGET_MS = 8_000;

/**
 * The indexer for serverless (no loops): one pass of at most ~8 s, at most once per 10 s across all
 * instances, resuming where the last one stopped. The first caller in each 10 s claims the run on
 * meta's `indexed_at` row and the others skip (null). ponytail: a claimed time slot, not an advisory
 * lock held for the run: session locks don't survive Neon's PgBouncer, and a transaction held across
 * RPC calls would block PGlite's only connection. A pass that outlasts 10 s can overlap the next;
 * crediting is idempotent, so that only repeats RPC calls.
 */
export async function catchUp(db: Db, client: PublicClient, o: IndexOptions, now = Date.now()): Promise<number | null> {
  const claimed = await db.query(
    "INSERT INTO meta (key, value) VALUES ('indexed_at', $1) ON CONFLICT (key) DO UPDATE SET value = excluded.value WHERE meta.value <= $2 RETURNING 1",
    [now, now - EVERY_MS],
  );
  return claimed.length ? indexTransfers(db, client, o, now + BUDGET_MS) : null;
}

// ---- Charges, holds and network usage ---------------------------------------------------------

export type Charged = { ok: true; balance: number } | { ok: false; reason: "insufficient" | "duplicate" };

/** Takes `microUsd` from `a` (lowercase) once per (a, ref) and never below zero. Call inside a transaction. */
async function debit(t: Db, a: string, microUsd: number, kind: string, ref: string): Promise<Charged> {
  await lock(t, a);
  if ((await t.query("SELECT 1 FROM charges WHERE address = $1 AND ref = $2", [a, ref])).length) return { ok: false, reason: "duplicate" };
  const [taken] = await t.query<{ balance: number }>("UPDATE accounts SET balance = balance - $1 WHERE address = $2 AND balance >= $1 RETURNING balance", [microUsd, a]);
  if (!taken) return { ok: false, reason: "insufficient" };
  await t.query("INSERT INTO charges (address, ref, kind, micro_usd, created_at) VALUES ($1, $2, $3, $4, $5)", [a, ref, kind, microUsd, Date.now()]);
  return { ok: true, balance: taken.balance };
}

/** Takes `microUsd` from `address` once per (address, ref), and never below zero. */
export async function charge(db: Db, address: string, microUsd: number, kind: string, ref: string): Promise<Charged> {
  assertMicro(microUsd, "A charge");
  return db.tx((t) => debit(t, low(address), microUsd, kind, ref));
}

/** Cost of `tokens` at `usdPer1k` dollars per 1,000 tokens, and the lender's cut, in micro-USD. Integer math: 0.7 * 70 is 48.99… in floats. */
export function usageSplit(tokens: number, usdPer1k: number, lenderShare: number): { cost: number; lender: number } {
  const cost = Math.ceil((tokens * Math.round(usdPer1k * 1_000_000)) / 1000);
  return { cost, lender: Math.floor((cost * Math.round(lenderShare * 10_000)) / 10_000) };
}

/**
 * Network-mode settlement: debits the asker `cost` and books `lenderMicro` to the lender, once per
 * (asker, ref). The browser picks `ref`, so it is stored as `net:<ref>` and can never claim a ref
 * the server made for another charge (a Bittensor answer's `bt:<uuid>`).
 */
export async function settleUsage(db: Db, asker: string, lender: string, cost: number, lenderMicro: number, ref: string): Promise<Charged> {
  assertMicro(cost, "A usage cost");
  if (!Number.isSafeInteger(lenderMicro) || lenderMicro < 0 || lenderMicro > cost) throw new RangeError("The lender's cut must be between 0 and the cost");
  const netRef = `net:${ref}`;
  return db.tx(async (t) => {
    const r = await debit(t, low(asker), cost, "network", netRef);
    if (r.ok)
      await t.query("INSERT INTO lender_earnings (asker, ref, lender, micro_usd, created_at) VALUES ($1, $2, $3, $4, $5)", [low(asker), netRef, low(lender), lenderMicro, Date.now()]);
    return r;
  });
}

/** Gives `microUsd` of the charge (a, ref) back, once per charge: false when it already had. Call inside a transaction holding a's lock. */
async function giveBack(t: Db, a: string, microUsd: number, ref: string): Promise<boolean> {
  const fresh = await t.query("INSERT INTO refunds (address, ref, micro_usd, created_at) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING RETURNING 1", [a, ref, microUsd, Date.now()]);
  if (!fresh.length) return false;
  await t.query("UPDATE accounts SET balance = balance + $1 WHERE address = $2", [microUsd, a]);
  return true;
}

/**
 * Gives back `microUsd` of the charge (address, ref) of this kind, such as the unused part of a
 * hold. Once per charge, and never more than it: true when it gave back now, false when it had
 * already. Throws when there's no such charge or the amount is more than it.
 */
export async function refund(db: Db, address: string, microUsd: number, kind: string, ref: string): Promise<boolean> {
  assertMicro(microUsd, "A refund");
  const a = low(address);
  return db.tx(async (t) => {
    await lock(t, a);
    const [c] = await t.query<{ micro_usd: number }>("SELECT micro_usd FROM charges WHERE address = $1 AND ref = $2 AND kind = $3", [a, ref, kind]);
    if (!c || microUsd > c.micro_usd) throw new RangeError("A refund needs a charge of at least as much, from the same wallet, kind and ref");
    return giveBack(t, a, microUsd, ref);
  });
}

/**
 * A Bittensor answer's hold: charges its worst case (0 for a free model charges nothing) under `ref`
 * and keeps the wallet busy until `release`, so each wallet has one answer being written at a time.
 */
export async function hold(db: Db, address: string, microUsd: number, ref: string, now = Date.now()): Promise<Charged | { ok: false; reason: "busy" }> {
  if (microUsd !== 0) assertMicro(microUsd, "A hold");
  const a = low(address);
  return db.tx(async (t) => {
    await lock(t, a);
    if ((await t.query("SELECT 1 FROM holds WHERE address = $1", [a])).length) return { ok: false, reason: "busy" };
    const r: Charged = microUsd ? await debit(t, a, microUsd, "bittensor", ref) : { ok: true, balance: await balance(t, a) };
    if (r.ok) await t.query("INSERT INTO holds (address, ref, micro_usd, used, created_at) VALUES ($1, $2, $3, 0, $4)", [a, ref, microUsd, now]);
    return r;
  });
}

/** Saves what the answer under hold `ref` has used so far (capped at the hold), for the sweep to settle by if its invocation dies. */
export async function holdUsed(db: Db, address: string, ref: string, used: number): Promise<void> {
  await db.query("UPDATE holds SET used = LEAST($3, micro_usd) WHERE address = $1 AND ref = $2", [low(address), ref, used]);
}

/**
 * Settles hold `ref`: keeps `used` of it (never more; by default what was last saved), refunds the
 * rest and frees the wallet. Once: false when it was already settled, by the answer or the sweep.
 */
export async function release(db: Db, address: string, ref: string, used?: number): Promise<boolean> {
  const a = low(address);
  return db.tx(async (t) => {
    await lock(t, a);
    const [h] = await t.query<{ micro_usd: number; used: number }>("DELETE FROM holds WHERE address = $1 AND ref = $2 RETURNING micro_usd, used", [a, ref]);
    if (!h) return false;
    const back = h.micro_usd - Math.min(Math.max(used ?? h.used, 0), h.micro_usd);
    if (back > 0) await giveBack(t, a, back, ref);
    return true;
  });
}

/** A hold this old outlived its invocation: the route stops answering after 4 minutes, and Vercel ends it at 5. */
export const STALE_HOLD_MS = 6 * 60_000;

/**
 * Settles the holds whose answer died unsettled (a crash, or the platform's time limit) the way the
 * answer would have: keeps what each had used when last saved, refunds the rest. Returns how many.
 */
export async function sweepHolds(db: Db, now = Date.now()): Promise<number> {
  const stale = await db.query<{ address: string; ref: string }>("SELECT address, ref FROM holds WHERE created_at <= $1", [now - STALE_HOLD_MS]);
  let settled = 0;
  for (const h of stale) if (await release(db, h.address, h.ref)) settled++;
  return settled;
}

// ---- Lender earnings and payouts --------------------------------------------------------------

/** `askers` counts distinct paying wallets: one asker behind a lender's whole balance deserves a look before paying. */
export type Earning = { address: string; earned: number; paid: number; requests: number; askers: number };

/** Earnings and payouts per lender (or for one lender), most owed first. */
export async function earnings(db: Db, lender?: string): Promise<Earning[]> {
  const rows = await db.query<Earning>(
    `SELECT e.lender AS address, SUM(e.micro_usd) AS earned, COUNT(*) AS requests, COUNT(DISTINCT e.asker) AS askers,
       (SELECT COALESCE(SUM(p.micro_usd), 0) FROM payouts p WHERE p.address = e.lender) AS paid
     FROM lender_earnings e ${lender ? "WHERE e.lender = $1" : ""} GROUP BY e.lender`,
    lender ? [low(lender)] : [],
  );
  return rows.sort((a, b) => b.earned - b.paid - (a.earned - a.paid));
}

/** Records a payout sent by hand from the treasury. Refuses a repeated (tx, lender) or more than the lender is owed. */
export async function markPaid(db: Db, address: string, microUsd: number, txHash: string, by: string): Promise<"ok" | "duplicate" | "over"> {
  assertMicro(microUsd, "A payout");
  return db.tx(async (t) => {
    await lock(t, low(address));
    if ((await t.query("SELECT 1 FROM payouts WHERE tx_hash = $1 AND address = $2", [low(txHash), low(address)])).length) return "duplicate";
    const [e] = await earnings(t, address);
    if (!e || microUsd > e.earned - e.paid) return "over";
    await t.query("INSERT INTO payouts (tx_hash, address, micro_usd, paid_by, created_at) VALUES ($1, $2, $3, $4, $5)", [low(txHash), low(address), microUsd, low(by), Date.now()]);
    return "ok";
  });
}

// ---- History and sign-in nonces ---------------------------------------------------------------

export type DepositRow = { txHash: string; logIndex: number; symbol: string; decimals: number; amount: string; credited: number; review: number; funding: boolean; at: number };
export type ChargeRow = { kind: string; microUsd: number; at: number };

export async function history(db: Db, address: string): Promise<{ deposits: DepositRow[]; charges: ChargeRow[] }> {
  const a = low(address);
  return {
    deposits: await db.query<DepositRow>(
      `SELECT tx_hash AS "txHash", log_index AS "logIndex", symbol, decimals, amount, credited, review, funding, created_at AS at
       FROM deposits WHERE address = $1 ORDER BY block DESC, log_index DESC LIMIT 20`,
      [a],
    ),
    // What each charge kept after its refund; one refunded in full isn't listed.
    charges: await db.query<ChargeRow>(
      `SELECT c.kind, c.micro_usd - COALESCE(r.micro_usd, 0) AS "microUsd", c.created_at AS at
       FROM charges c LEFT JOIN refunds r ON r.address = c.address AND r.ref = c.ref
       WHERE c.address = $1 AND c.micro_usd > COALESCE(r.micro_usd, 0) ORDER BY c.id DESC LIMIT 20`,
      [a],
    ),
  };
}

export async function issueNonce(db: Db, nonce: string, ttlMs: number, now = Date.now()): Promise<void> {
  await db.query("DELETE FROM nonces WHERE expires_at <= $1", [now]);
  await db.query("INSERT INTO nonces (nonce, expires_at) VALUES ($1, $2)", [nonce, now + ttlMs]);
}

/** True exactly once for an issued nonce that hasn't expired. */
export async function burnNonce(db: Db, nonce: string, now = Date.now()): Promise<boolean> {
  return (await db.query("DELETE FROM nonces WHERE nonce = $1 AND expires_at > $2 RETURNING 1", [nonce, now])).length === 1;
}
