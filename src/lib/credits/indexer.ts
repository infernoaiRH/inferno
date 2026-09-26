import { CHAIN, serverClient } from "@/lib/chain";
import { COIN_TOKEN, readCoinPrice } from "./coin";
import { acceptedTokens, creditsConfig, ledgerDb } from "./config";
import { catchUp, recordCoinPrice, sweepHolds } from "./ledger";

const why = (e: unknown) => (e as { shortMessage?: string }).shortMessage ?? (e instanceof Error ? e.message : String(e));

/**
 * Logs the payment settings once per instance (from instrumentation.ts) and opens the ledger, so a
 * missing one is logged now. Never throws: bad settings are logged loudly and payments stay off.
 * Nothing runs in the background: deposits are credited by upkeep(), from reads and the cron route.
 */
export function startCredits(): void {
  const { config, problems, notes } = creditsConfig();
  if (problems.length) {
    console.error(`[credits] PAYMENTS ARE OFF. PAYMENTS_ENABLED=1 but the settings are invalid:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
    return;
  }
  if (!config) {
    console.log("[credits] Payments are off (PAYMENTS_ENABLED isn't 1).");
    return;
  }
  for (const note of notes) console.warn(`[credits] ${note}`);
  ledgerDb().then(
    (db) => db && console.log(`[credits] Payments are on. Treasury ${config.treasury} on ${CHAIN.name}; deposits are credited on account reads and by /api/cron/deposits.`),
    (e) => console.error("[credits] Couldn't open the ledger; the first request tries again:", why(e)),
  );
}

/**
 * Settles Bittensor holds whose answer died, then runs the deposit indexer once (at most ~8 s, and
 * skipped when it ran in the last 10 s). For GET /api/credits/me and the cron route. Payments must be
 * on. Never throws: a failure is logged and the next read or cron run tries again.
 */
export async function upkeep(): Promise<{ swept: number; credited: number | null }> {
  const done = { swept: 0, credited: null as number | null };
  try {
    const db = (await ledgerDb())!;
    const c = creditsConfig().config!;
    done.swept = await sweepHolds(db);
    const g = globalThis as { infernoRightChain?: boolean };
    if (!g.infernoRightChain) {
      // A testnet RPC would credit testnet tokens at mainnet prices (docs/research/opencomm-evaluation.md M3).
      const id = await serverClient.getChainId();
      if (id !== CHAIN.id) throw new Error(`The RPC serves chain ${id}, not ${CHAIN.id}. Not indexing until RPC_URL (or NEXT_PUBLIC_RPC_URL) is fixed.`);
      g.infernoRightChain = true;
    }
    const { treasury, capMicro, dayCapMicro, startBlock, admins } = c;
    done.credited = await catchUp(db, serverClient, { treasury, tokens: await acceptedTokens(), capMicro, dayCapMicro, startBlock, admins });
    if (done.credited) console.log(`[credits] Credited ${done.credited} new deposit(s).`);
  } catch (e) {
    console.error("[credits] Upkeep failed; the next read or cron run tries again:", why(e));
  }
  return done;
}

/**
 * Records a sample of $INFERNOAI's price for coin deposits. Only the cron calls it, every 5 minutes,
 * so samples are evenly spread over the window deposits are priced from. Payments must be on. Never
 * throws: returns the sample in micro-USD, or null when there was no price to trust (logged).
 */
export async function sampleCoin(): Promise<number | null> {
  if (!COIN_TOKEN) return null;
  try {
    const micro = await readCoinPrice();
    await recordCoinPrice((await ledgerDb())!, micro);
    return micro;
  } catch (e) {
    console.error("[credits] No coin price sample this time:", why(e));
    return null;
  }
}
