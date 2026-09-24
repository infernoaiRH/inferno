import { db, fail, paymentsEnabled, paymentsOff, sessionAddress } from "@/lib/credits";
import { upkeep } from "@/lib/credits/indexer";
import { balance, earnings, history } from "@/lib/credits/ledger";
import { limits } from "@/lib/limits";
import { limit } from "@/lib/relay/server";

/**
 * The signed-in wallet's balance, recent deposits and charges, and what it has earned lending.
 * Credits final deposits first (a bounded indexer run, at most once per 10 s across instances), so a
 * top-up shows up when its sender looks for it.
 */
export async function GET(req: Request) {
  const busy = limit(limits.credits, req);
  if (busy) return busy;
  if (!(await paymentsEnabled())) return paymentsOff();
  const address = await sessionAddress(req);
  if (!address) return fail(401, "Sign in with your wallet to see your credits.");
  await upkeep();
  const d = await db();
  const [[earned], balanceMicroUsd, past] = await Promise.all([earnings(d, address), balance(d, address), history(d, address)]);
  return Response.json(
    { address, balanceMicroUsd, ...past, earnedMicroUsd: earned?.earned ?? 0, paidMicroUsd: earned?.paid ?? 0 },
    { headers: { "Cache-Control": "no-store" } },
  );
}
