/**
 * Inferno credits: a server-side ledger in micro-USD (1 = $0.000001; integers only).
 *
 * Money comes in by plain on-chain transfer: a wallet sends USDG, TAO or the Inferno coin to the
 * treasury on Robinhood Chain, and the indexer credits the sender once the transfer is final.
 * Wallets spend by signing in with Sign-In with Ethereum (session cookie). The ledger is Postgres
 * (./ledger.ts), so every call that reads or moves money is async.
 *
 * CONTRACT FOR OTHER MODULES: keep these exported names and signatures.
 */
import { createHash, randomBytes } from "node:crypto";
import { isAddress } from "viem";
import { CHAIN } from "@/lib/chain";
import { creditsConfig, ledgerDb } from "./config";
import * as ledger from "./ledger";
import { SESSION_COOKIE, readCookie, verifySession, type Site } from "./session";

export type Address = `0x${string}`;
export type ChargeKind = "bittensor" | "network";
export type ChargeResult = { ok: true; balance: number } | { ok: false; reason: "insufficient" | "duplicate" | "disabled" };

/** True when payments are switched on, their settings check out and the ledger is there. Throws while the database can't be reached. */
export async function paymentsEnabled(): Promise<boolean> {
  return (await ledgerDb()) !== null;
}

/** The signed-in wallet for this request (from the session cookie), lowercase, or null. */
export async function sessionAddress(req: Request): Promise<Address | null> {
  const c = creditsConfig().config;
  return c ? verifySession(readCookie(req, SESSION_COOKIE), c.secret) : null;
}

const API_KEY = /^inf_[\w-]{43}$/;
const keyHash = (key: string) => createHash("sha256").update(key).digest("hex");

/** A new API key (inf_ and 32 random bytes): shown once, since only its hash and last 4 characters are kept. */
export function newKey(): { key: string; hash: string; hint: string } {
  const key = `inf_${randomBytes(32).toString("base64url")}`;
  return { key, hash: keyHash(key), hint: key.slice(-4) };
}

/** The wallet behind this request's `Authorization: Bearer inf_…` API key, lowercase, or null. */
export async function keyAddress(req: Request): Promise<Address | null> {
  const key = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const d = API_KEY.test(key) ? await ledgerDb() : null;
  return d ? ((await ledger.keyWallet(d, keyHash(key))) as Address | null) : null;
}

/** Current balance in micro-USD. */
export async function balanceOf(address: Address): Promise<number> {
  const d = await ledgerDb();
  return d ? ledger.balance(d, address) : 0;
}

/**
 * Takes `microUsd` from `address` atomically. `ref` is unique per charge, so retrying the same ref
 * never charges twice. Refs are scoped per wallet; make them on the server, prefixed with their
 * source (`bt:${crypto.randomUUID()}`), never from anything the browser sees or sends, and serve
 * only on `ok: true`, because `duplicate` means "already paid for".
 * Fractions of a micro-USD round up; a non-positive amount or a bad address/ref throws.
 */
export async function charge(address: Address, microUsd: number, kind: ChargeKind, ref: string): Promise<ChargeResult> {
  const d = await ledgerDb();
  if (!d) return { ok: false, reason: "disabled" };
  if (!isAddress(address, { strict: false }) || typeof ref !== "string" || ref.length === 0 || ref.length > 200)
    throw new TypeError("charge() needs a wallet address and a ref of 1 to 200 characters");
  return ledger.charge(d, address, Math.ceil(microUsd), kind, ref);
}

/**
 * Gives back `microUsd` (whole micro-USD) of the earlier charge with this wallet, kind and ref,
 * such as the unused part of a hold. Once per charge and never more than it: true when it gave
 * back now, false when it already had. No such charge, or too much, throws.
 */
export async function refund(address: Address, microUsd: number, kind: ChargeKind, ref: string): Promise<boolean> {
  const d = await ledgerDb();
  return d !== null && ledger.refund(d, address, microUsd, kind, ref);
}

// ---- Server helpers for the credits routes ----------------------------------------------------

/** The ledger database: one connection pool (or PGlite) per instance, shared across Next.js bundles. Payments must be on. */
export async function db(): Promise<ledger.Db> {
  const d = await ledgerDb();
  if (!d) throw new Error("Payments are off");
  return d;
}

/** A JSON error the credits UI shows as is. */
export const fail = (status: number, error: string) => Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
export const paymentsOff = () => fail(503, "Payments aren't switched on for this server yet.");

/** Where sign-in messages and POSTs must come from: NEXT_PUBLIC_SITE_URL (required in production), else this request's own origin. */
export function site(req: Request): Site {
  const url = creditsConfig().config?.site ?? new URL(req.url);
  return { domain: url.host, origin: url.origin, chainId: CHAIN.id };
}

/** A browser POST from another origin. SameSite=Lax already keeps the cookie off other sites' requests; this also covers sibling subdomains. */
export function crossSite(req: Request): boolean {
  const origin = req.headers.get("origin");
  return origin !== null && origin !== site(req).origin;
}

/** The signed-in wallet when it is listed in ADMIN_ADDRESSES, else null. */
export async function adminAddress(req: Request): Promise<Address | null> {
  const a = await sessionAddress(req);
  return a && creditsConfig().config?.admins.has(a) ? a : null;
}
