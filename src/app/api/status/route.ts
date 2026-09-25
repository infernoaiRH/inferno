import { getStatus } from "@/lib/status";

export const dynamic = "force-dynamic";

/** Live status as JSON, for anyone (or any AI assistant) checking that Inferno is up. The CDN keeps it a minute. */
export async function GET() {
  return Response.json(await getStatus(), {
    headers: { "cache-control": "public, max-age=30, s-maxage=60, stale-while-revalidate=300" },
  });
}
