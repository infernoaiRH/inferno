/**
 * Self-check for src/lib/credits (ledger, holds, indexer, session cookie, SIWE checks) and the cron
 * route's secret check. Run: node scripts/credits-check.ts
 *
 * The ledger runs on in-memory PGlite. To run it on a real Postgres server instead (each ledger here
 * gets a new database there, dropped at the end):
 *   docker run --rm -d --name credits-pg -p 5433:5432 -e POSTGRES_PASSWORD=x postgres:17-alpine
 *   DATABASE_URL=postgres://postgres:x@127.0.0.1:5433/postgres node scripts/credits-check.ts
 *
 * Optional fork test (a real USDG transfer, then indexer passes before and after finality):
 *   anvil --fork-url https://rpc.mainnet.chain.robinhood.com --port 8555 --hardfork shanghai
 *   CREDITS_FORK_RPC=http://127.0.0.1:8555 node scripts/credits-check.ts
 * (shanghai because Arbitrum block headers carry no blob gas, which anvil's Cancun mode needs.)
 */
import assert from "node:assert/strict";
import { createPublicClient, createTestClient, createWalletClient, custom, erc20Abi, http, parseAbiItem, zeroAddress, type Address, type PublicClient } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { createSiweMessage, parseSiweMessage, verifySiweMessage } from "viem/siwe";
// @ts-expect-error -- Node's type stripping needs the .ts extension; the shared tsconfig doesn't allow it
import { GET as cron } from "../src/app/api/cron/deposits/route.ts";
// @ts-expect-error -- as above
import * as L from "../src/lib/credits/ledger.ts";
// @ts-expect-error -- as above
import { NONCE_TTL_MS, SESSION_TTL_S, readCookie, signSession, siweProblem, verifySession } from "../src/lib/credits/session.ts";
// @ts-expect-error -- as above
import { LENDER_SHARE, USD_PER_1K_TOKENS } from "../src/lib/relay/protocol.ts";

const pgUrl = process.env.DATABASE_URL;
const server = pgUrl ? await L.openDb({ DATABASE_URL: pgUrl }) : null;
const made: string[] = [];
/** An empty database: in-memory PGlite, or a new database on DATABASE_URL's server. */
async function fresh(): Promise<L.Db> {
  if (!server) return L.openDb({ INFERNO_DB_PATH: "memory://" });
  const name = `credits_check_${process.pid}_${made.length}`;
  await server.query(`CREATE DATABASE ${name}`);
  made.push(name);
  const url = new URL(pgUrl!);
  url.pathname = `/${name}`;
  return L.openDb({ DATABASE_URL: url.href });
}
/** A new ledger, made the way development makes one. */
async function ledger(): Promise<L.Db> {
  const d = await fresh();
  assert.equal(await L.initLedger(d, {}), null);
  return d;
}

const db = await ledger();

const USDG = { address: "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168" as Address, symbol: "USDG", decimals: 6, priceMicro: 1_000_000 };
const TAO = { address: "0xf3081494B87e8D5fb7960f066E931D1D0e6E3d67" as Address, symbol: "TAO", decimals: 18, priceMicro: 420_500_000 };
const CAP = 500_000_000; // $500
const caps = { capMicro: CAP, dayCapMicro: 10 * CAP }; // the daily cap has its own test below
const alice = "0x00000000000000000000000000000000000A11CE";
const bob = "0x0000000000000000000000000000000000000B0B";
const lender = "0x0000000000000000000000000000000000001e4d";
const tx = (n: number) => `0x${n.toString(16).padStart(64, "0")}`;

// Deposits: idempotent per (tx_hash, log_index), credited at the token's price, cursor moves.
const t1 = { txHash: tx(1), logIndex: 0, block: 10, from: alice, amount: 12_345_678n }; // 12.345678 USDG
assert.equal(await L.creditTransfers(db, USDG, [t1], caps, 100), 1);
assert.equal(await L.creditTransfers(db, USDG, [t1, { ...t1, txHash: t1.txHash.toUpperCase().replace("0X", "0x") }], caps, 200), 0, "same log again");
assert.equal(await L.balance(db, alice.toLowerCase()), 12_345_678);
assert.equal(await L.lastBlock(db, USDG.address), 200);
assert.equal(await L.creditTransfers(db, USDG, [], caps, 150), 0);
assert.equal(await L.lastBlock(db, USDG.address), 200, "the cursor never moves back");
assert.equal(await L.creditTransfers(db, USDG, [{ ...t1, logIndex: 1, amount: 1n }], caps, 201), 1, "another log in the same tx is new");
assert.equal(await L.balance(db, alice), 12_345_679);

// Cap: the excess over $500 is recorded, not credited, and flagged for review. TAO uses its price.
const big = { txHash: tx(2), logIndex: 3, block: 11, from: bob, amount: 2_000_000_000n }; // 2,000 USDG
await L.creditTransfers(db, USDG, [big], caps, 202);
assert.equal(await L.balance(db, bob), CAP);
const tao = { txHash: tx(3), logIndex: 0, block: 12, from: bob, amount: 10n ** 17n }; // 0.1 TAO at $420.50
await L.creditTransfers(db, TAO, [tao, { ...tao, logIndex: 1, amount: 1n }], caps, 12);
assert.equal(await L.balance(db, bob), CAP + 42_050_000);
const bobDeposits = (await L.history(db, bob)).deposits;
assert.deepEqual(
  bobDeposits.map((d: { symbol: string; amount: string; credited: number; review: number }) => [d.symbol, d.amount, d.credited, d.review]),
  [["TAO", "1", 0, 0], ["TAO", "100000000000000000", 42_050_000, 0], ["USDG", "2000000000", CAP, 1]],
);
const [bigRow] = await db.query("SELECT value, credited, review FROM deposits WHERE tx_hash = $1", [tx(2)]);
assert.deepEqual({ ...bigRow }, { value: 2_000_000_000, credited: CAP, review: 1 });
assert.equal(L.valueMicro(10n ** 40n, 18, 1_000_000), 10n ** 28n, "huge values stay exact as bigint");
await L.creditTransfers(db, USDG, [{ txHash: tx(9), logIndex: 0, block: 13, from: bob, amount: 10n ** 40n }], caps, 203);
assert.equal(await L.balance(db, bob), 2 * CAP + 42_050_000, "a huge deposit still credits only the cap");

// Charges: never negative, one per (address, ref), whole positive micro-USD only.
assert.deepEqual(await L.charge(db, alice, 12_345_680, "bittensor", "r1"), { ok: false, reason: "insufficient" });
assert.deepEqual(await L.charge(db, "0x000000000000000000000000000000000000dEaD", 1, "bittensor", "r1"), { ok: false, reason: "insufficient" });
assert.deepEqual(await L.charge(db, alice, 345_679, "bittensor", "r1"), { ok: true, balance: 12_000_000 });
assert.deepEqual(await L.charge(db, alice, 345_679, "bittensor", "r1"), { ok: false, reason: "duplicate" });
assert.equal(await L.balance(db, alice), 12_000_000, "a duplicate ref charges nothing");
assert.deepEqual(await L.charge(db, bob, 1, "bittensor", "r1"), { ok: true, balance: 2 * CAP + 42_050_000 - 1 }, "refs are per wallet");
for (const bad of [0, -5, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) await assert.rejects(L.charge(db, alice, bad, "bittensor", `bad${bad}`), RangeError);
assert.equal(await L.balance(db, alice), 12_000_000);
await assert.rejects(db.query("UPDATE accounts SET balance = -1 WHERE address = $1", [alice.toLowerCase()]), /check constraint/);
await assert.rejects(db.query("UPDATE accounts SET balance = $1 WHERE address = $2", [1.5, alice.toLowerCase()]), /invalid input syntax for type bigint/);

// Network usage: tokens / 1000 x USD_PER_1K_TOKENS, lender keeps LENDER_SHARE (70/30), once per ref.
assert.deepEqual(L.usageSplit(1000, USD_PER_1K_TOKENS, LENDER_SHARE), { cost: 10_000, lender: 7_000 });
assert.deepEqual(L.usageSplit(7, USD_PER_1K_TOKENS, LENDER_SHARE), { cost: 70, lender: 49 }, "no float drift (0.7 * 70)");
assert.deepEqual(L.usageSplit(32_768, USD_PER_1K_TOKENS, LENDER_SHARE), { cost: 327_680, lender: 229_376 });
const { cost, lender: cut } = L.usageSplit(1000, USD_PER_1K_TOKENS, LENDER_SHARE);
assert.deepEqual(await L.settleUsage(db, alice, lender, cost, cut, "u1"), { ok: true, balance: 11_990_000 });
assert.deepEqual(await L.settleUsage(db, alice, lender, cost, cut, "u1"), { ok: false, reason: "duplicate" });
assert.deepEqual(await L.settleUsage(db, bob, lender, cost, cut, "u1"), { ok: true, balance: 2 * CAP + 42_050_000 - 1 - cost });
const poor = "0x0000000000000000000000000000000000000001";
assert.deepEqual(await L.settleUsage(db, poor, lender, cost, cut, "u2"), { ok: false, reason: "insufficient" });
await assert.rejects(L.settleUsage(db, alice, lender, cost, cost + 1, "u3"), RangeError);
assert.deepEqual((await L.earnings(db)).map((e: object) => ({ ...e })), [{ address: lender.toLowerCase(), earned: 2 * cut, paid: 0, requests: 2, askers: 2 }]);
assert.equal((await L.history(db, alice)).charges[0].kind, "network");
assert.equal((await L.balance(db, alice)) + cost, 12_000_000, "the asker paid the full cost");

// Payouts: never more than owed, one per (tx, lender).
assert.equal(await L.markPaid(db, lender, 2 * cut + 1, tx(7), alice), "over");
assert.equal(await L.markPaid(db, bob, 1, tx(7), alice), "over", "not a lender");
assert.equal(await L.markPaid(db, lender, cut, tx(7), alice), "ok");
assert.equal(await L.markPaid(db, lender, 1, tx(7), alice), "duplicate");
assert.deepEqual({ ...(await L.earnings(db, lender))[0] }, { address: lender.toLowerCase(), earned: 2 * cut, paid: cut, requests: 2, askers: 2 });

// Refs by source (C1): the browser picks network refs, so they're stored as net:<ref> and can't
// claim a ref the server made for a Bittensor answer.
const erin = "0x00000000000000000000000000000000000e41a5";
await L.creditTransfers(db, USDG, [{ txHash: tx(20), logIndex: 0, block: 20, from: erin, amount: 1_000_000n }], caps, 204); // $1
assert.deepEqual(await L.settleUsage(db, erin, bob, 10, 7, "bt:1"), { ok: true, balance: 999_990 });
assert.ok((await db.query("SELECT 1 FROM charges WHERE address = $1 AND ref = 'net:bt:1'", [erin])).length);
assert.deepEqual(await L.charge(db, erin, 1_000, "bittensor", "bt:1"), { ok: true, balance: 998_990 }, "a usage ref can't block a Bittensor charge");

// Bittensor holds (H2): the worst case is charged first, the unused part refunded once, never more than the hold.
assert.deepEqual(await L.charge(db, erin, 900_000, "bittensor", "bt:2"), { ok: true, balance: 98_990 });
await assert.rejects(L.refund(db, erin, 900_001, "bittensor", "bt:2"), RangeError, "never more than the hold");
await assert.rejects(L.refund(db, erin, 1, "network", "bt:2"), RangeError, "same kind only");
await assert.rejects(L.refund(db, bob, 1, "bittensor", "bt:2"), RangeError, "same wallet only");
await assert.rejects(L.refund(db, erin, 1, "bittensor", "bt:none"), RangeError, "only against a charge");
for (const bad of [0, -1, 1.5, Number.NaN]) await assert.rejects(L.refund(db, erin, bad, "bittensor", "bt:2"), RangeError);
assert.equal(await L.refund(db, erin, 600_000, "bittensor", "bt:2"), true);
assert.equal(await L.refund(db, erin, 600_000, "bittensor", "bt:2"), false, "once");
assert.equal(await L.refund(db, erin, 1, "bittensor", "bt:2"), false, "once, whatever the amount");
assert.equal(await L.balance(db, erin), 698_990, "kept 300,000 of the 900,000 hold");
assert.equal((await L.charge(db, erin, 50_000, "bittensor", "bt:3")).ok, true);
assert.equal(await L.refund(db, erin, 50_000, "bittensor", "bt:3"), true, "Chutes failed: all of it back");
assert.equal(await L.balance(db, erin), 698_990);
assert.deepEqual(
  (await L.history(db, erin)).charges.map((c: { kind: string; microUsd: number }) => [c.kind, c.microUsd]),
  [["bittensor", 300_000], ["bittensor", 1_000], ["network", 10]],
  "history shows what each charge kept, and skips one refunded in full",
);

// Daily cap (H5): one wallet's deposits credit at most dayCapMicro in any 24 hours; the rest waits for review.
const day = { capMicro: CAP, dayCapMicro: 200_000_000 }; // $500 a deposit, $200 a day
const carol = "0x000000000000000000000000000000000000ca01";
const t0 = Date.UTC(2026, 8, 25);
const dep = (n: number, usd: bigint) => ({ txHash: tx(n), logIndex: 0, block: n, from: carol, amount: usd * 1_000_000n });
await L.creditTransfers(db, USDG, [dep(30, 150n)], day, 205, t0);
await L.creditTransfers(db, USDG, [dep(31, 100n), dep(32, 10n)], day, 206, t0 + 3_600_000);
assert.equal(await L.balance(db, carol), 200_000_000);
await L.creditTransfers(db, USDG, [dep(33, 10n)], day, 207, t0 + 24 * 3_600_000 + 1);
assert.equal(await L.balance(db, carol), 210_000_000, "a day on, the first deposit no longer counts");
assert.deepEqual(
  (await L.history(db, carol)).deposits.map((d: { amount: string; credited: number; review: number }) => [d.amount, d.credited, d.review]),
  [["10000000", 10_000_000, 0], ["10000000", 0, 1], ["100000000", 50_000_000, 1], ["150000000", 150_000_000, 0]],
);

// Across instances: two charges on one wallet at the same moment can't overdraw it (the wallet's lock takes them one at a time).
const frank = "0x000000000000000000000000000000000000f4a4";
await L.creditTransfers(db, USDG, [{ txHash: tx(40), logIndex: 0, block: 40, from: frank, amount: 1_000_000n }], caps, 208); // $1
const racing = await Promise.all([L.charge(db, frank, 700_000, "bittensor", "p1"), L.charge(db, frank, 700_000, "bittensor", "p2")]);
assert.deepEqual(racing.map((r: { ok: boolean }) => r.ok).sort(), [false, true]);
assert.equal(await L.balance(db, frank), 300_000);

// Bittensor answers: one at a time per wallet (an open hold), settled by the answer itself or, when
// its invocation died, by the sweep at what it last saved: kept what it used, the rest refunded.
const gina = "0x0000000000000000000000000000000000006a1a";
await L.creditTransfers(db, USDG, [{ txHash: tx(41), logIndex: 0, block: 41, from: gina, amount: 1_000_000n }], caps, 209); // $1
const longAgo = Date.now() - L.STALE_HOLD_MS;
const both = await Promise.all([L.hold(db, gina, 400_000, "bt:h1", longAgo), L.hold(db, gina, 400_000, "bt:h2", longAgo)]);
assert.deepEqual(both.map((r: { ok: boolean; reason?: string }) => r.reason ?? "ok").sort(), ["busy", "ok"], "one answer at a time, across instances");
assert.equal(await L.balance(db, gina), 600_000);
const open = both[0].ok ? "bt:h1" : "bt:h2";
await L.holdUsed(db, gina, open, 150_000);
assert.equal(await L.sweepHolds(db, longAgo + L.STALE_HOLD_MS - 1), 0, "an answer that may still be running is left alone");
assert.equal(await L.sweepHolds(db), 1);
assert.equal(await L.balance(db, gina), 850_000, "the sweep kept the 150,000 used and refunded the rest");
assert.equal(await L.release(db, gina, open, 0), false, "settled once: the answer ending late changes nothing");
assert.equal(await L.balance(db, gina), 850_000);
assert.equal((await L.hold(db, gina, 100_000, "bt:h3")).ok, true, "the wallet is free again");
assert.deepEqual(await L.hold(db, gina, 1, "bt:h4"), { ok: false, reason: "busy" });
assert.equal(await L.sweepHolds(db), 0, "a new hold isn't stale");
assert.equal(await L.release(db, gina, "bt:h3", 250_000), true);
assert.equal(await L.balance(db, gina), 750_000, "never more than the hold");
assert.deepEqual(await L.hold(db, gina, 0, "bt:h5"), { ok: true, balance: 750_000 }, "a free model holds nothing but still takes the turn");
assert.deepEqual(await L.hold(db, gina, 1, "bt:h6"), { ok: false, reason: "busy" });
assert.equal(await L.release(db, gina, "bt:h5", 10), true);
assert.deepEqual(await L.hold(db, gina, 900_000, "bt:h7"), { ok: false, reason: "insufficient" });
assert.deepEqual(await L.hold(db, gina, 1, "bt:h8"), { ok: true, balance: 749_999 }, "a refused hold doesn't take the turn");

// Shared treasury: an admin wallet's transfer funds it. It's recorded as treasury funding and credits nobody.
const owner = "0x000000000000000000000000000000000000ad01";
const funded = { ...caps, admins: new Set([owner]) };
const ownerTransfer = { txHash: tx(42), logIndex: 0, block: 42, from: owner.toUpperCase().replace("0X", "0x"), amount: 5_000_000_000n };
assert.equal(await L.creditTransfers(db, USDG, [ownerTransfer], funded, 210), 1, "recorded");
assert.equal(await L.balance(db, owner), 0, "not credited");
assert.deepEqual(
  (await L.history(db, owner)).deposits.map((d: { amount: string; credited: number; review: number; funding: boolean }) => [d.amount, d.credited, d.review, d.funding]),
  [["5000000000", 0, 0, true]],
);
assert.equal(await L.creditTransfers(db, USDG, [{ txHash: tx(43), logIndex: 0, block: 43, from: frank, amount: 1_000_000n }], funded, 211), 1);
assert.equal(await L.balance(db, frank), 1_300_000, "everyone else still tops up");
assert.equal((await L.history(db, frank)).deposits[0].funding, false);

// A new ledger in production (M3): an empty database means the wrong DATABASE_URL, a missing volume
// or a second copy, and a new ledger would credit every past deposit again, so it's made only on request.
const tables = async (d: L.Db) => (await d.query<{ n: number }>("SELECT COUNT(*) AS n FROM pg_tables WHERE schemaname = 'public'"))[0].n;
const empty = await fresh();
assert.match((await L.initLedger(empty, { NODE_ENV: "production" })) ?? "", /^No ledger in .*INFERNO_DB_INIT=1 once/);
assert.equal(await tables(empty), 0, "and makes none");
assert.equal(await L.initLedger(empty, { NODE_ENV: "production", INFERNO_DB_INIT: "1" }), null);
assert.ok((await tables(empty)) >= 10);
assert.equal(await L.initLedger(empty, { NODE_ENV: "production" }), null, "an existing ledger opens");
assert.equal(await L.initLedger(await fresh(), { NODE_ENV: "development" }), null, "development makes one freely");

// Indexer (H1, low): mints credit nobody, and a range the RPC refuses is halved and retried, down to 50 blocks.
const treasury7: Address = "0x7777777777777777777777777777777777777777";
const dave = "0x000000000000000000000000000000000000da7e";
const logs = [
  { block: 1_100n, from: alice, value: 1_000_000n },
  { block: 1_200n, from: zeroAddress, value: 5_000_000n },
  { block: 2_900n, from: dave, value: 2_000_000n },
].map((l, i) => ({ address: USDG.address, blockNumber: l.block, transactionHash: tx(100 + i), logIndex: 0, args: { from: l.from, to: treasury7, value: l.value } }));
const asked: bigint[] = [];
const rpc = (finalized: bigint, maxRange: bigint) => ({
  getBlock: async () => ({ number: finalized }),
  getLogs: async ({ fromBlock, toBlock }: { fromBlock: bigint; toBlock: bigint }) => {
    asked.push(toBlock - fromBlock + 1n);
    if (toBlock - fromBlock + 1n > maxRange) throw new Error("range too big");
    return logs.filter((l) => l.blockNumber >= fromBlock && l.blockNumber <= toBlock);
  },
}) as unknown as PublicClient; // just the two calls indexTransfers makes
const idb = await ledger();
const io = { treasury: treasury7, tokens: [USDG], ...caps, startBlock: 1_000n };
assert.equal(await L.indexTransfers(idb, rpc(3_000n, 500n), io), 2);
assert.deepEqual(asked.slice(0, 4), [2_000n, 1_000n, 500n, 500n]);
assert.equal(await L.balance(idb, zeroAddress), 0, "a mint credits nobody");
assert.equal((await L.balance(idb, alice)) + (await L.balance(idb, dave)), 3_000_000);
assert.equal(await L.lastBlock(idb, USDG.address), 3_000);
asked.length = 0;
await assert.rejects(L.indexTransfers(idb, rpc(9_000n, 10n), io), /range too big/);
assert.deepEqual(asked, [2_000n, 1_000n, 500n, 250n, 125n, 62n, 50n], "gives up at 50 blocks");
assert.equal(await L.lastBlock(idb, USDG.address), 3_000, "the cursor waits for the next pass");
// Serverless: one bounded pass at a time, at most every 10 s whichever instance asks, resuming where the last stopped.
assert.equal(await L.indexTransfers(idb, rpc(9_000n, 5_000n), io, Date.now() - 1), 0, "out of time before the first chunk");
assert.equal(await L.lastBlock(idb, USDG.address), 3_000);
assert.equal(await L.catchUp(idb, rpc(5_000n, 5_000n), io), 0, "claims the run");
assert.equal(await L.lastBlock(idb, USDG.address), 5_000);
assert.equal(await L.catchUp(idb, rpc(9_000n, 5_000n), io), null, "at most once per 10 s");
assert.equal(await L.lastBlock(idb, USDG.address), 5_000);
assert.equal(await L.catchUp(idb, rpc(9_000n, 5_000n), io, Date.now() + 10_000), 0, "then the next run resumes");
assert.equal(await L.lastBlock(idb, USDG.address), 9_000);

// The Inferno coin's price. Pool maths on mainnet numbers read on 2026-09-27: about 10.1M coins per ETH, ETH at $2,691.30.
assert.equal(L.coinPriceMicro(251_755_437_815_578_711_090_682_395_855_769n, 269_130_180_413n, 8), 266);
// TAO: Chainlink's TAO/USD answer (8 decimals; $324.32514 on Arbitrum on 2026-09-27), less 10%.
assert.equal(L.feedMicro(32_432_514_000n, 8), 324_325_140);
assert.equal(L.afterHaircut(L.feedMicro(32_432_514_000n, 8)), 291_892_626);
// Deposits credit at the lowest sample of the last 30 minutes, less 10%, and only while the samples cover that window.
const pdb = await ledger();
const MIN = 60_000;
const p0 = 1_000_000 * MIN;
assert.equal(await L.coinDepositPrice(pdb, p0), 0, "no samples, no price");
await L.recordCoinPrice(pdb, 300, p0);
assert.equal(await L.coinDepositPrice(pdb, p0), 0, "one fresh sample doesn't cover the window");
for (const [m, micro] of [[5, 280], [10, 1_000], [15, 290], [20, 310]]) await L.recordCoinPrice(pdb, micro, p0 + m * MIN);
assert.equal(await L.coinDepositPrice(pdb, p0 + 20 * MIN), 252, "the lowest, 280, less 10%: the pump to 1,000 doesn't count");
assert.equal(await L.coinDepositPrice(pdb, p0 + 30 * MIN), 252, "the first sample has left the window; it's still covered");
assert.equal(await L.coinDepositPrice(pdb, p0 + 31 * MIN), 0, "the newest is 11 minutes old: the sampler stopped, so deposits wait");
await L.recordCoinPrice(pdb, 400, p0 + 32 * MIN);
assert.equal(await L.coinDepositPrice(pdb, p0 + 36 * MIN), 261, "280 is out of the window now: 290 less 10%");
await L.recordCoinPrice(pdb, 500, p0 + 24 * 60 * MIN + 1);
assert.equal((await pdb.query<{ n: number }>("SELECT COUNT(*) AS n FROM coin_prices"))[0].n, 6, "a day-old sample is dropped");
// Without a price the coin is skipped: its deposits wait, from where it first appeared, and are credited once it has one.
const COIN = { address: "0x81d31D40Aca12F671d3A4Db44516d84121463CF3" as Address, symbol: "INFERNOAI", decimals: 18, priceMicro: 0 };
const coinLog = { address: COIN.address, blockNumber: 1_500n, transactionHash: tx(200), logIndex: 0, args: { from: dave, to: treasury7, value: 10n ** 21n } };
const coinRpc = (finalized: bigint) => ({
  getBlock: async () => ({ number: finalized }),
  getLogs: async ({ fromBlock, toBlock }: { fromBlock: bigint; toBlock: bigint }) => [coinLog].filter((l) => l.blockNumber >= fromBlock && l.blockNumber <= toBlock),
}) as unknown as PublicClient;
const cdb = await ledger();
const co = { treasury: treasury7, tokens: [COIN], ...caps, startBlock: 1_000n };
assert.equal(await L.indexTransfers(cdb, coinRpc(2_000n), co), 0, "no price: nothing credited");
assert.equal(await L.lastBlock(cdb, COIN.address), 999, "but it waits from the start block");
assert.equal(await L.indexTransfers(cdb, coinRpc(3_000n), co), 0);
assert.equal(await L.lastBlock(cdb, COIN.address), 999, "and keeps waiting");
assert.equal(await L.indexTransfers(cdb, coinRpc(3_000n), { ...co, tokens: [{ ...COIN, priceMicro: 252 }] }), 1);
assert.equal(await L.balance(cdb, dave), 252_000, "1,000 coins at 252 micro-USD each");
// A token added to a ledger that already has cursors counts from then on, not from the start block.
assert.equal(await L.indexTransfers(idb, coinRpc(9_500n), { ...io, tokens: [USDG, { ...COIN, priceMicro: 252 }] }), 0);
assert.equal(await L.lastBlock(idb, COIN.address), 9_500, "the coin's transfer at block 1,500, before it was accepted, isn't a top-up");
const waiting = { txHash: tx(201), logIndex: 0, block: 1, from: dave, amount: 1n };
await assert.rejects(L.creditTransfers(cdb, COIN, [waiting], caps, 1), /no price/, "a deposit is never recorded at no price");
// A ledger made before the price table gets it when it opens, without INFERNO_DB_INIT.
const older = await ledger();
await older.query("DROP TABLE coin_prices");
assert.equal(await L.initLedger(older, { NODE_ENV: "production" }), null);
assert.equal(await L.coinDepositPrice(older), 0, "the price table is back");

// Nonces: single use, 10 minutes.
await L.issueNonce(db, "n1", NONCE_TTL_MS, 1_000);
assert.equal(await L.burnNonce(db, "n1", 2_000), true);
assert.equal(await L.burnNonce(db, "n1", 2_000), false, "single use");
await L.issueNonce(db, "n2", NONCE_TTL_MS, 1_000);
assert.equal(await L.burnNonce(db, "n2", 1_000 + NONCE_TTL_MS), false, "expired");
assert.equal(await L.burnNonce(db, "never-issued"), false);

// Session cookie: `address.expiry.hmac`; any tampering, the wrong secret or expiry is refused.
const secret = "x".repeat(32);
const now = Date.UTC(2026, 8, 24);
const cookie = signSession(alice, secret, now);
assert.equal(verifySession(cookie, secret, now), alice.toLowerCase());
const [addr, exp, sig] = cookie.split(".");
assert.equal(Number(exp), now / 1000 + SESSION_TTL_S);
assert.equal(verifySession(`${bob.toLowerCase()}.${exp}.${sig}`, secret, now), null, "swapped address");
assert.equal(verifySession(`${addr}.${Number(exp) + 1}.${sig}`, secret, now), null, "extended expiry");
assert.equal(verifySession(`${addr}.${exp}.${sig.slice(0, -1)}${sig.endsWith("A") ? "B" : "A"}`, secret, now), null, "flipped mac");
assert.equal(verifySession(cookie, "y".repeat(32), now), null, "other secret");
assert.equal(verifySession(cookie, secret, now + SESSION_TTL_S * 1000), null, "expired");
for (const junk of [undefined, null, "", "a.b.c", `${cookie}.x`, cookie.toUpperCase()]) assert.equal(verifySession(junk, secret, now), null);
const req = new Request("http://x", { headers: { cookie: `a=1; inferno_session=${cookie}; b=2` } });
assert.equal(readCookie(req, "inferno_session"), cookie);
assert.equal(readCookie(req, "missing"), undefined);

// SIWE: domain, uri, chain and freshness are checked before the signature.
const site = { domain: "inferno.example", origin: "https://inferno.example", chainId: 4663 };
const account = privateKeyToAccount(generatePrivateKey());
const siwe = (o: Partial<Parameters<typeof createSiweMessage>[0]> = {}) =>
  createSiweMessage({ domain: site.domain, address: account.address, statement: "Sign in to Inferno.", uri: site.origin, version: "1", chainId: 4663, nonce: "abcdef0123456789", issuedAt: new Date(now), ...o });
const problem = (msg: string, at = now) => siweProblem(parseSiweMessage(msg), site, at);
assert.equal(problem(siwe()), null);
assert.equal(problem(siwe({ uri: `${site.origin}/credits` })), null);
assert.match(problem(siwe({ domain: "evil.example" })) ?? "", /different site/);
assert.match(problem(siwe({ uri: "https://inferno.example.evil.example" })) ?? "", /different site/);
assert.match(problem(siwe({ chainId: 1 })) ?? "", /different chain/);
assert.match(problem(siwe(), now + NONCE_TTL_MS + 1) ?? "", /expired/, "stale issuedAt");
assert.match(problem(siwe({ issuedAt: new Date(now + NONCE_TTL_MS + 1) })) ?? "", /expired/, "issuedAt from the future");
assert.match(problem(siwe({ expirationTime: new Date(now - 1) })) ?? "", /expired/);
assert.match(problem(siwe({ notBefore: new Date(now + 60_000) })) ?? "", /expired/);
assert.match(problem("not a siwe message") ?? "", /different site/);
// The zero address never signs in (H1): on-chain checks accept any 65-byte signature for it.
assert.match(problem(siwe({ address: zeroAddress })) ?? "", /zero address/);
assert.equal(verifySession(signSession(zeroAddress, secret, now), secret, now), null, "nor keeps a session");
// The route verifies with the chain's RPC (smart wallets via ERC-1271/6492); offline, viem falls back to ecrecover.
const offline = createPublicClient({ transport: custom({ request: async () => { throw new Error("offline"); } }) });
const message = siwe();
const signature = await account.signMessage({ message });
assert.equal(await verifySiweMessage(offline, { message, signature, domain: site.domain, time: new Date(now) }), true);
const forged = message.replace(account.address, privateKeyToAccount(generatePrivateKey()).address);
assert.equal(await verifySiweMessage(offline, { message: forged, signature, domain: site.domain, time: new Date(now) }).catch(() => false), false);

// The cron route: Vercel Cron sends `Authorization: Bearer $CRON_SECRET`, and nothing else gets in.
const cronCall = async (authorization?: string) =>
  (await cron(new Request("https://inferno.example/api/cron/deposits", { headers: authorization ? { authorization } : {} }))).status;
delete process.env.CRON_SECRET;
assert.equal(await cronCall(`Bearer ${"s".repeat(32)}`), 503, "off until CRON_SECRET is set");
process.env.CRON_SECRET = "s".repeat(32);
assert.equal(await cronCall(), 401, "no secret");
assert.equal(await cronCall(`Bearer ${"t".repeat(32)}`), 401, "wrong secret");
assert.equal(await cronCall(`Bearer ${"s".repeat(31)}`), 401, "a prefix of it");
assert.equal(await cronCall("s".repeat(32)), 401, "not as a bearer token");

console.log(`credits-check: ledger, holds, caps, indexer, coin price, cron, cookie and SIWE checks passed (${server ? "Postgres at DATABASE_URL" : "PGlite"})`);

// Fork test: a real USDG transfer on a mainnet fork, one indexer pass, the sender is credited.
const fork = process.env.CREDITS_FORK_RPC;
if (fork) {
  const client = createPublicClient({ transport: http(fork) });
  const test = createTestClient({ mode: "anvil", transport: http(fork) });
  const wallet = createWalletClient({ transport: http(fork) });
  const treasury = privateKeyToAccount(generatePrivateKey()).address;
  const TRANSFER = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)");
  const head = await client.getBlockNumber();
  let holder: Address | undefined;
  // Walk back through recent USDG transfers for a plain wallet (no code) holding at least 5 USDG.
  for (let to = head; !holder && to > head - 60_000n; to -= 2_000n) {
    const recent = await client.getLogs({ address: USDG.address, event: TRANSFER, fromBlock: to - 1_999n, toBlock: to, strict: true });
    for (const l of recent.reverse()) {
      const code = await client.getCode({ address: l.args.to });
      const bal = await client.readContract({ address: USDG.address, abi: erc20Abi, functionName: "balanceOf", args: [l.args.to] });
      if (!code && bal >= 5_000_000n) {
        holder = l.args.to;
        break;
      }
    }
  }
  assert.ok(holder, "found a USDG holder in recent blocks");
  await test.impersonateAccount({ address: holder });
  await test.setBalance({ address: holder, value: 10n ** 18n });
  const start = (await client.getBlockNumber()) + 1n;
  const hash = await wallet.writeContract({ account: holder, chain: null, address: USDG.address, abi: erc20Abi, functionName: "transfer", args: [treasury, 1_234_567n] });
  assert.equal((await client.waitForTransactionReceipt({ hash })).status, "success");
  const fdb = await ledger();
  const opts = { treasury, tokens: [USDG], capMicro: CAP, dayCapMicro: 10 * CAP, startBlock: start };
  assert.equal(await L.indexTransfers(fdb, client, opts), 0, "not final yet");
  await test.mine({ blocks: 200 });
  assert.equal(await L.indexTransfers(fdb, client, opts), 1);
  assert.equal(await L.indexTransfers(fdb, client, opts), 0, "a second pass credits nothing new");
  assert.equal(await L.balance(fdb, holder), 1_234_567);
  assert.equal((await L.history(fdb, holder)).deposits[0].txHash, hash);
  console.log(`credits-check: fork test passed (holder ${holder}, tx ${hash})`);
}

if (server) {
  for (const name of made) await server.query(`DROP DATABASE ${name} WITH (FORCE)`);
  process.exit(0); // the Postgres clients keep idle connections open for 20 s
}
