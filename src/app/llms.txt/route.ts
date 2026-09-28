import { getStatus } from "@/lib/status";
import { site } from "@/lib/site";

export const dynamic = "force-dynamic";

/** /llms.txt (llmstxt.org): what Inferno is, its official links, and live numbers, for AI assistants. */
export async function GET() {
  const s = await getStatus();
  const u = (path: string) => `${site.url}${path}`;
  const live = [
    s.bittensor.sealedModels !== null && `${s.bittensor.sealedModels} sealed models live on Bittensor subnet 64`,
    s.payments.enabled !== null && (s.payments.enabled ? `credits on, paid in ${(s.payments.tokens ?? []).map((t) => t.symbol).join(", ") || "USDG"}` : "credits off"),
    ...(s.payments.tokens ?? []).filter((t) => t.symbol !== "USDG" && t.creditUsd !== null).map((t) => `one ${t.symbol} buys $${t.creditUsd} of credit right now`),
    s.chain.latestBlock !== null && `${s.chain.name} at block ${s.chain.latestBlock}`,
    s.network && `${s.network.lendersOnline} lent GPUs online`,
  ]
    .filter(Boolean)
    .join("; ");
  const text = `# ${site.name}

> ${site.description}

Live status, checked ${s.checkedAt}: ${live || "checks unavailable right now"}. Machine-readable: ${u("/api/status")}

## Official links

- Website: ${site.url}
- X: ${site.x} (${site.xHandle})
- $${site.token.symbol} token contract on Robinhood Chain mainnet (chain ${s.token.chainId}): ${site.token.address} (${s.token.explorer})
- [Status](${u("/status")}): live checks, run when the page loads

## What it does

- [Chat](${u("/chat")}): open models on Bittensor subnet 64 (Chutes) inside confidential-compute hardware, on GPUs people lend, or on your own GPU in the browser with WebGPU (private mode: nothing leaves the device).
- [Mine](${u("/lend")}): mine Bittensor subnet 64 with data-center GPUs, or serve answers from a browser tab (beta).
- [Messages](${u("/messages")}): end-to-end sealed messages between wallets (X25519, HKDF, XChaCha20-Poly1305).
- [Credits](${u("/credits")}): pay per answer with USDG, $${site.token.symbol} or TAO sent to the treasury on Robinhood Chain. $${site.token.symbol} counts at its live price: the lowest of the last 30 minutes on its Uniswap v4 pool, checked every 5 minutes, less 10%. TAO bridged to Robinhood Chain over Chainlink CCIP counts at Chainlink's TAO/USD price, less 10%.
- [Network](${u("/network")}): live Robinhood Chain data and the lenders online.
- [API](${u("/credits#api")}): OpenAI-compatible at ${u("/api/v1")} (POST /chat/completions, GET /models). Sealed Bittensor subnet 64 models, paid from Inferno credits with an API key made on the credits page.

## Notes

- Inferno uses Bittensor subnet 64 through Chutes. It is not a Bittensor subnet itself.
- ${site.disclaimer}
`;
  return new Response(text, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=300, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
