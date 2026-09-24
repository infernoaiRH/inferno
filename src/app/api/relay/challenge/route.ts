import { challenge, isKey, limit, refuse, relay, relayStore } from "@/lib/relay/server";

export const dynamic = "force-dynamic";

/**
 * Step one of opening a stream: `{ id, envelope }`, a random nonce sealed to `?key=`. Only the key's
 * holder can open it; they bring it to /api/relay/stream as `proof` within 60 s.
 */
export async function GET(req: Request) {
  const store = relayStore();
  if (store instanceof Response) return store;
  const busy = limit(relay.challenge, req);
  if (busy) return busy;
  const key = new URL(req.url).searchParams.get("key");
  const c = isKey(key) ? await challenge(store, key) : null;
  if (!c) return refuse(400, "Expected ?key= with a 32-byte base64url public key.");
  return Response.json(c, { headers: { "cache-control": "no-store" } });
}
