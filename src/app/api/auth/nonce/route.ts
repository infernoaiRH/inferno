import { randomBytes } from "node:crypto";
import { db, paymentsEnabled, paymentsOff } from "@/lib/credits";
import { issueNonce } from "@/lib/credits/ledger";
import { NONCE_TTL_MS } from "@/lib/credits/session";
import { limits } from "@/lib/limits";
import { limit } from "@/lib/relay/server";

export const dynamic = "force-dynamic";

/** A single-use sign-in nonce, good for 10 minutes. */
export async function GET(req: Request) {
  const busy = limit(limits.auth, req);
  if (busy) return busy;
  if (!(await paymentsEnabled())) return paymentsOff();
  // Not viem's generateSiweNonce: it draws from Math.random, and consecutive nonces overlap.
  const nonce = randomBytes(16).toString("hex");
  await issueNonce(await db(), nonce, NONCE_TTL_MS);
  return Response.json({ nonce }, { headers: { "Cache-Control": "no-store" } });
}
