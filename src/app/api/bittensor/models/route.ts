import { chutesModels } from "@/lib/bittensor/chutes";
import { paymentsEnabled } from "@/lib/credits";

export const dynamic = "force-dynamic";

/**
 * Subnet 64's sealed models, fetched by this server so visitors' browsers never contact Chutes to
 * render the site, and whether Inferno credits pay for Bittensor answers here (the same check as
 * /api/bittensor/chat). `models` is null while Chutes can't be reached. The CDN keeps it 5 minutes.
 */
export async function GET() {
  const [models, credits] = await Promise.all([
    chutesModels().catch(() => null),
    paymentsEnabled().then((on) => on && Boolean(process.env.CHUTES_API_KEY), () => false),
  ]);
  return Response.json(
    { models, credits },
    { headers: { "cache-control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600" } },
  );
}
