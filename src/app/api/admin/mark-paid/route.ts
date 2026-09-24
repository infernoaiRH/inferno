import { isAddress } from "viem";
import { adminAddress, crossSite, db, fail, paymentsEnabled, paymentsOff } from "@/lib/credits";
import { markPaid } from "@/lib/credits/ledger";

/**
 * Records a payout sent by hand: { address, microUsd, txHash }. Refuses more than the lender is
 * owed and a (txHash, address) pair recorded before. The tx itself isn't checked on-chain.
 */
export async function POST(req: Request) {
  if (!(await paymentsEnabled())) return paymentsOff();
  if (crossSite(req)) return fail(403, "Record payouts from this site.");
  const admin = await adminAddress(req);
  if (!admin) return fail(403, "Only admin wallets can record payouts.");
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const { address, microUsd, txHash } = body ?? {};
  if (
    typeof address !== "string" ||
    !isAddress(address, { strict: false }) ||
    !Number.isSafeInteger(microUsd) ||
    (microUsd as number) <= 0 ||
    typeof txHash !== "string" ||
    !/^0x[0-9a-fA-F]{64}$/.test(txHash)
  )
    return fail(400, "Send { address, microUsd, txHash }: a lender, a whole number of micro-USD and the payout's transaction hash.");
  const r = await markPaid(await db(), address, microUsd as number, txHash, admin);
  if (r === "duplicate") return fail(409, "That payout is already recorded.");
  if (r === "over") return fail(409, "That's more than this lender is owed.");
  return Response.json({ ok: true });
}
