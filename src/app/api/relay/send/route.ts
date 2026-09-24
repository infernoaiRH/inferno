import { isEnvelope, limit, readJson, relay, relayStore } from "@/lib/relay/server";

export const dynamic = "force-dynamic";

/** Forwards one sealed envelope to whoever is listening on its `to` key. The relay can't open it. */
export async function POST(req: Request) {
  const store = relayStore();
  if (store instanceof Response) return store;
  const busy = limit(relay.send, req);
  if (busy) return busy;
  const env = await readJson(req);
  if (env instanceof Response) return env;
  if (!isEnvelope(env)) return Response.json({ error: "That isn't a sealed envelope." }, { status: 400 });
  const { v, from, to, ts, nonce, ct } = env; // only the envelope, nothing else the body carried
  if (!(await store.send(to, JSON.stringify({ v, from, to, ts, nonce, ct })))) {
    return Response.json({ error: "Nobody is listening on that key right now." }, { status: 404 });
  }
  return new Response(null, { status: 202 });
}
