import { checkOffer, limit, readJson, relay, relayStore } from "@/lib/relay/server";

export const dynamic = "force-dynamic";

/** Lender nodes online right now: announced, with an open stream. */
export async function GET(req: Request) {
  const store = relayStore();
  if (store instanceof Response) return store;
  const busy = limit(relay.list, req);
  if (busy) return busy;
  return Response.json({ nodes: await store.list() }, { headers: { "cache-control": "no-store" } });
}

/** A lender announces (or refreshes) a wallet-signed node offer. */
export async function POST(req: Request) {
  const store = relayStore();
  if (store instanceof Response) return store;
  const busy = limit(relay.announce, req);
  if (busy) return busy;
  const body = await readJson(req);
  if (body instanceof Response) return body;
  const offer = await checkOffer(body);
  if (!offer) return Response.json({ error: "That offer isn't signed by its wallet for this chain." }, { status: 400 });
  await store.announce(offer);
  return new Response(null, { status: 204 });
}
