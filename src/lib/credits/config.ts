import { erc20Abi, getAddress, isAddress, zeroAddress, type Address } from "viem";
import { CHAIN, IS_MAINNET, USDG, serverClient } from "@/lib/chain";
import { formatUsd } from "@/lib/format";
import { COIN_TOKEN } from "./coin";
import { coinDepositPrice, initLedger, openDb, type Db, type Token } from "./ledger";

/** Server env for credits, read once. Nothing here is NEXT_PUBLIC_, and errors name variables, never values. */
export type CreditsConfig = {
  treasury: Address;
  secret: string;
  /** Lowercase. They download earnings and record payouts, and their transfers fund the shared treasury instead of buying credits. */
  admins: Set<string>;
  capMicro: number;
  /** MAX_CREDIT_USD_PER_DAY: the most one wallet's deposits credit in 24 hours; the rest waits for review. */
  dayCapMicro: number;
  startBlock: bigint | null;
  /** NEXT_PUBLIC_SITE_URL: sign-in messages and POSTs must come from here. Required in production. */
  site: URL | null;
  tokens: Token[];
  coin: { address: Address; priceMicro: number } | null;
};

/** TAO bridged to Robinhood Chain (ForeverMoney wTAO over CCIP). docs/research/2026-09-24-bittensor-and-tathata.md §4 */
const TAO: Token = { address: "0xf3081494B87e8D5fb7960f066E931D1D0e6E3d67", symbol: "TAO", decimals: 18, priceMicro: 0 };

/** "12.5" → 12_500_000 micro-USD. Null unless a positive price up to $1B. */
function usdToMicro(s: string | undefined): number | null {
  const n = Number(s);
  const micro = Math.round(n * 1_000_000);
  return s?.trim() && Number.isFinite(n) && n <= 1e9 && micro >= 1 ? micro : null;
}

const toAddress = (s: string | undefined) => {
  const a = s?.trim();
  return a && isAddress(a, { strict: false }) && a.toLowerCase() !== zeroAddress ? getAddress(a) : null;
};

/** `problems` keep payments off; `notes` are logged at startup and change nothing else. */
function read(env: NodeJS.ProcessEnv): { config: CreditsConfig | null; problems: string[]; notes: string[] } {
  if (env.PAYMENTS_ENABLED !== "1") return { config: null, problems: [], notes: [] };
  const problems: string[] = [];
  const need = (ok: boolean, problem: string) => {
    if (!ok) problems.push(problem);
    return ok;
  };

  const treasury = toAddress(env.TREASURY_ADDRESS);
  need(!!treasury, "TREASURY_ADDRESS must be a valid, non-zero address (a Safe multisig is recommended).");
  const secret = env.SESSION_SECRET ?? "";
  need(Buffer.byteLength(secret) >= 32, "SESSION_SECRET must be at least 32 bytes (openssl rand -hex 32).");
  need(env.VERCEL !== "1" || !!(env.DATABASE_URL || env.POSTGRES_URL), "On Vercel, DATABASE_URL must point at Postgres (Neon, from the Vercel Marketplace): functions have no disk to keep a ledger on.");
  let site: URL | null = null;
  try {
    // On Vercel, the production domain unless NEXT_PUBLIC_SITE_URL says otherwise.
    const url = process.env.NEXT_PUBLIC_SITE_URL || (env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : "");
    site = url ? new URL(url) : null;
  } catch {
    // not a URL: reported just below
  }
  need(!!site || env.NODE_ENV !== "production", "NEXT_PUBLIC_SITE_URL must be the site's https URL: sign-in is bound to its host.");
  const capMicro = usdToMicro(env.MAX_CREDIT_USD_PER_DEPOSIT ?? "500");
  need(capMicro !== null, "MAX_CREDIT_USD_PER_DEPOSIT must be a positive dollar amount.");
  const dayCapMicro = usdToMicro(env.MAX_CREDIT_USD_PER_DAY ?? "200");
  need(dayCapMicro !== null, "MAX_CREDIT_USD_PER_DAY must be a positive dollar amount.");
  const start = env.DEPOSIT_START_BLOCK?.trim();
  need(!start || /^\d+$/.test(start), "DEPOSIT_START_BLOCK must be a block number.");
  const admins = (env.ADMIN_ADDRESSES ?? "").split(",").filter((a) => a.trim());
  need(admins.every((a) => toAddress(a)), "ADMIN_ADDRESSES must be comma-separated wallet addresses.");

  // ponytail: manual USD prices for TAO and another coin (such as one on testnet), read at startup;
  // $INFERNOAI is priced live from its pool instead (./coin.ts). Opt-in only: at a price above market,
  // a wallet buys the token cheap, deposits it, spends the credits on "network answers" from a lender
  // wallet it also runs, and is paid out in USDG.
  const manual = env.ALLOW_MANUAL_PRICES === "1";
  const notes =
    !manual && (env.TAO_USD_PRICE || env.COIN_ADDRESS || env.COIN_USD_PRICE)
      ? ["Manual prices are off: TAO_USD_PRICE, COIN_ADDRESS and COIN_USD_PRICE are ignored without ALLOW_MANUAL_PRICES=1 (a manual price above market can be cashed out through lender payouts; see .env.example)."]
      : [];
  const tokens: Token[] = USDG ? [{ ...USDG, priceMicro: 1_000_000 }] : [];
  if (COIN_TOKEN) tokens.push({ ...COIN_TOKEN, priceMicro: 0 }); // priced live by acceptedTokens()
  if (manual && env.TAO_USD_PRICE) {
    const priceMicro = usdToMicro(env.TAO_USD_PRICE);
    if (need(priceMicro !== null && IS_MAINNET, "TAO_USD_PRICE must be a positive dollar amount, and TAO is on mainnet only."))
      tokens.push({ ...TAO, priceMicro: priceMicro! });
  }
  let coin: CreditsConfig["coin"] = null;
  if (manual && (env.COIN_ADDRESS || env.COIN_USD_PRICE)) {
    const address = toAddress(env.COIN_ADDRESS);
    const priceMicro = usdToMicro(env.COIN_USD_PRICE);
    if (need(!!address && priceMicro !== null && !tokens.some((t) => t.address.toLowerCase() === address.toLowerCase()), "COIN_ADDRESS and COIN_USD_PRICE must both be set, to a new token and a positive dollar price."))
      coin = { address: address!, priceMicro: priceMicro! };
  }
  need(tokens.length > 0 || !!coin, "There's no token to accept: USDG is mainnet-only, so on testnet set COIN_ADDRESS, COIN_USD_PRICE and ALLOW_MANUAL_PRICES=1.");

  if (problems.length) return { config: null, problems, notes };
  return {
    config: {
      treasury: treasury!,
      secret,
      admins: new Set(admins.map((a) => a.trim().toLowerCase())),
      capMicro: capMicro!,
      dayCapMicro: dayCapMicro!,
      startBlock: start ? BigInt(start) : null,
      site,
      tokens,
      coin,
    },
    problems,
    notes,
  };
}

let cached: ReturnType<typeof read> | undefined;

/** `config` is null when payments are off or misconfigured; `problems` then says why. */
export function creditsConfig() {
  return (cached ??= read(process.env));
}

/**
 * The ledger, opened and checked once per instance and shared across Next.js bundles. Null when
 * payments are off, or when there's no ledger and INFERNO_DB_INIT=1 isn't set (logged once).
 */
export function ledgerDb(): Promise<Db | null> {
  if (!creditsConfig().config) return Promise.resolve(null);
  const g = globalThis as { infernoDb?: Promise<Db | null> };
  return (g.infernoDb ??= (async () => {
    const db = await openDb(process.env);
    const missing = await initLedger(db, process.env);
    if (missing) console.error(`[credits] PAYMENTS ARE OFF. ${missing}`);
    return missing ? null : db;
  })().catch((e: unknown) => {
    g.infernoDb = undefined; // couldn't reach the database: the next request tries again
    throw e;
  }));
}

let coinMeta: Promise<{ symbol: string; decimals: number }> | undefined;

/** $INFERNOAI's deposit price from the cron's samples, or 0 (its deposits wait) while there's no safe one. */
const livePrice = () => ledgerDb().then((db) => (db ? coinDepositPrice(db) : 0), () => 0);

/**
 * The tokens credits accept, with prices: $INFERNOAI at its live price (0 while it has none), and a
 * manual coin with its symbol and decimals read from the chain, once.
 */
export async function acceptedTokens(): Promise<Token[]> {
  const c = creditsConfig().config;
  if (!c) return [];
  const tokens = await Promise.all(c.tokens.map(async (t) => (t.address === COIN_TOKEN?.address ? { ...t, priceMicro: await livePrice() } : t)));
  if (!c.coin) return tokens;
  const coin = c.coin;
  coinMeta ??= Promise.all([
    serverClient.readContract({ address: coin.address, abi: erc20Abi, functionName: "symbol" }),
    serverClient.readContract({ address: coin.address, abi: erc20Abi, functionName: "decimals" }),
  ]).then(([symbol, decimals]) => ({ symbol: symbol.slice(0, 16), decimals }));
  try {
    return [...tokens, { ...coin, ...(await coinMeta) }];
  } catch (e) {
    coinMeta = undefined; // try again next time
    console.error("[credits] Couldn't read the coin's symbol and decimals:", (e as { shortMessage?: string }).shortMessage ?? String(e));
    return tokens;
  }
}

/** What /credits and GET /api/credits/config show. Public on purpose. */
export async function publicConfig() {
  // Off while the ledger is missing or unreachable, so nobody is shown a treasury to pay into.
  const c = (await ledgerDb().catch(() => null)) ? creditsConfig().config : null;
  const dollars = (micro: number) => formatUsd(micro / 1e6, micro % 1_000_000 ? 2 : 0);
  return {
    enabled: c !== null,
    treasury: c?.treasury ?? null,
    chainId: CHAIN.id,
    // usdPrice is what one whole token credits now; null while $INFERNOAI has no safe live price (its deposits wait).
    tokens: (c ? await acceptedTokens() : []).map((t) => ({
      symbol: t.symbol,
      address: t.address,
      decimals: t.decimals,
      usdPrice: t.priceMicro ? t.priceMicro / 1e6 : null,
      live: t.address === COIN_TOKEN?.address,
    })),
    maxCreditUsd: c ? c.capMicro / 1e6 : null,
    minTopUpNote: c
      ? `No minimum. Each transfer credits at most ${dollars(c.capMicro)}, and each wallet at most ${dollars(c.dayCapMicro)} a day; anything above that waits for a manual review.`
      : null,
  };
}
