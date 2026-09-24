import { publicConfig } from "@/lib/credits/config";
import { limits } from "@/lib/limits";
import { limit } from "@/lib/relay/server";

export const dynamic = "force-dynamic";

/** Whether payments are on, the treasury, and the tokens accepted with their prices. */
export async function GET(req: Request) {
  const busy = limit(limits.credits, req);
  if (busy) return busy;
  return Response.json(await publicConfig(), { headers: { "Cache-Control": "no-store" } });
}
