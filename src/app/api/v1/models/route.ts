import { BITTENSOR_MARGIN, chutesModels } from "@/lib/bittensor/chutes";

/** OpenAI's model list for the Inferno API: the sealed models on subnet 64, with what Inferno charges per million tokens. */
export async function GET() {
  const models = await chutesModels().catch(() => null);
  if (!models) return Response.json({ error: { message: "Chutes didn't answer. Try again in a moment." } }, { status: 502 });
  const usd = (perMillion: number) => Number((perMillion * (1 + BITTENSOR_MARGIN)).toFixed(4));
  return Response.json(
    {
      object: "list",
      data: models.map((m) => ({
        id: m.id,
        object: "model",
        created: 0,
        owned_by: "chutes",
        context_length: m.context,
        pricing: { input_usd_per_million_tokens: usd(m.input), output_usd_per_million_tokens: usd(m.output) },
      })),
    },
    { headers: { "cache-control": "public, s-maxage=300, stale-while-revalidate=600" } },
  );
}
