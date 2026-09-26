import { robinhood } from "viem/chains";
import { chutesModels } from "@/lib/bittensor/chutes";
import { paymentsEnabled } from "@/lib/credits";
import { publicConfig } from "@/lib/credits/config";
import { relayStore } from "@/lib/relay/server";
import { CHAIN, EXPLORER_URL, serverClient } from "@/lib/chain";
import { site } from "@/lib/site";

/**
 * What's running right now, checked on the server for /status, /api/status and /llms.txt, so
 * people and AI assistants can see Inferno is live. Each check fails soft to null. Nothing secret.
 */
export async function getStatus() {
  const store = relayStore();
  const [models, payments, config, block, relay] = await Promise.all([
    chutesModels().catch(() => null),
    paymentsEnabled().catch(() => null),
    publicConfig().catch(() => null),
    serverClient.getBlockNumber().catch(() => null),
    store instanceof Response
      ? null
      : Promise.all([store.list(), store.streams()]).then(
          ([nodes, streams]) => ({ lendersOnline: nodes.length, answersInFlight: streams }),
          () => null,
        ),
  ]);
  return {
    ok: true,
    checkedAt: new Date().toISOString(),
    site: site.url,
    x: site.x,
    chain: { id: CHAIN.id, name: CHAIN.name, latestBlock: block === null ? null : Number(block), explorer: EXPLORER_URL },
    bittensor: {
      subnet: 64,
      provider: "Chutes",
      sealedModels: models?.length ?? null,
      models: models?.map((m) => m.name) ?? null,
      creditsOn: payments === true && Boolean(process.env.CHUTES_API_KEY),
    },
    // What one whole token buys in credits now; creditUsd is null while a live price isn't ready.
    payments: { enabled: payments, tokens: config?.enabled ? config.tokens.map((t) => ({ symbol: t.symbol, creditUsd: t.usdPrice })) : null },
    network: relay,
    // The token lives on mainnet whichever chain this build reads.
    token: {
      symbol: site.token.symbol,
      address: site.token.address,
      chainId: robinhood.id,
      explorer: `${robinhood.blockExplorers.default.url}/token/${site.token.address}`,
    },
  };
}

export type Status = Awaited<ReturnType<typeof getStatus>>;
