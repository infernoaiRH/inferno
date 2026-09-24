import { CHAIN } from "@/lib/chain";
import { relayStore } from "@/lib/relay/server";

export const dynamic = "force-dynamic";

/** For the host's health check: the server is up, with relay counts (null when the relay is off or its store is unreachable). Nothing secret. */
export async function GET() {
  const store = relayStore();
  const relay =
    store instanceof Response
      ? null
      : await Promise.all([store.list(), store.streams()]).then(
          ([nodes, streams]) => ({ nodes: nodes.length, streams }),
          () => null,
        );
  return Response.json({ ok: true, relay, chainId: CHAIN.id }, { headers: { "cache-control": "no-store" } });
}
