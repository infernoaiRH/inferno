import { createHash, timingSafeEqual } from "node:crypto";

const sha256 = (s: string) => createHash("sha256").update(s).digest();

/**
 * Vercel Cron (vercel.json): settles Bittensor holds whose answer died and credits final deposits
 * (one bounded indexer run). Vercel sends `Authorization: Bearer $CRON_SECRET` when CRON_SECRET is
 * set; anything else is refused. Any scheduler can call it the same way, such as cron on a Docker host.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "Set CRON_SECRET to run this." }, { status: 503 });
  if (!timingSafeEqual(sha256(req.headers.get("authorization") ?? ""), sha256(`Bearer ${secret}`)))
    return Response.json({ error: "Wrong or missing cron secret." }, { status: 401 });
  // Loaded only once the caller checks out (which also lets scripts/credits-check.ts call this under plain Node).
  const { paymentsEnabled, paymentsOff } = await import("@/lib/credits");
  if (!(await paymentsEnabled())) return paymentsOff();
  const { upkeep } = await import("@/lib/credits/indexer");
  return Response.json(await upkeep(), { headers: { "Cache-Control": "no-store" } });
}
