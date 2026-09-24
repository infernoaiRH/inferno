import { sessionAddress } from "@/lib/credits";

/** The signed-in wallet, or null. */
export async function GET(req: Request) {
  return Response.json({ address: await sessionAddress(req) }, { headers: { "Cache-Control": "no-store" } });
}
