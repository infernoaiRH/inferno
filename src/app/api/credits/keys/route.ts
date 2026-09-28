import { crossSite, db, fail, newKey, paymentsEnabled, paymentsOff, sessionAddress } from "@/lib/credits";
import { MAX_KEYS, addKey, listKeys, revokeKey } from "@/lib/credits/ledger";
import { limits } from "@/lib/limits";
import { limit } from "@/lib/relay/server";

const noStore = { headers: { "Cache-Control": "no-store" } };

/** The signed-in wallet, or the response refusing the request. Changes must come from this site. */
async function wallet(req: Request, change: boolean): Promise<string | Response> {
  const busy = limit(limits.credits, req);
  if (busy) return busy;
  if (!(await paymentsEnabled())) return paymentsOff();
  if (change && crossSite(req)) return fail(403, "Manage API keys from this site.");
  return (await sessionAddress(req)) ?? fail(401, "Sign in with your wallet first.");
}

/** The signed-in wallet's live API keys: their last 4 characters and dates, never the keys. */
export async function GET(req: Request) {
  const a = await wallet(req, false);
  if (a instanceof Response) return a;
  return Response.json({ keys: await listKeys(await db(), a) }, noStore);
}

/** A new API key for the signed-in wallet. The key is in this response only: just its hash is kept. */
export async function POST(req: Request) {
  const a = await wallet(req, true);
  if (a instanceof Response) return a;
  // JSON only, like the other POSTs here: a cross-site form can't send it without a CORS preflight.
  if (!req.headers.get("content-type")?.startsWith("application/json")) return fail(415, "Send the request as JSON.");
  const { key, hash, hint } = newKey();
  const row = await addKey(await db(), a, hash, hint);
  return row ? Response.json({ key, ...row }, noStore) : fail(409, `A wallet can have ${MAX_KEYS} keys at once. Revoke one first.`);
}

/** Revokes one of the signed-in wallet's keys: DELETE /api/credits/keys?id=… */
export async function DELETE(req: Request) {
  const a = await wallet(req, true);
  if (a instanceof Response) return a;
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!Number.isSafeInteger(id) || id < 1) return fail(400, "Say which key: ?id=…");
  return (await revokeKey(await db(), a, id)) ? Response.json({ ok: true }, noStore) : fail(404, "There's no such key on this wallet.");
}
