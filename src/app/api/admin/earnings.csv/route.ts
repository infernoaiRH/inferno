import { getAddress } from "viem";
import { adminAddress, db, fail, paymentsEnabled, paymentsOff } from "@/lib/credits";
import { earnings } from "@/lib/credits/ledger";

/** USDG has 6 decimals, so micro-USD are exactly USDG base units. */
const usdg = (micro: number) => `${Math.floor(micro / 1e6)}.${String(micro % 1e6).padStart(6, "0")}`;

/**
 * Unpaid lender earnings, for paying out by hand from the treasury Safe. Afterwards, record each
 * payout with POST /api/admin/mark-paid. Check `askers` first: one wallet paying a lender everything
 * is how credits bought with a mispriced token would be cashed out.
 */
export async function GET(req: Request) {
  if (!(await paymentsEnabled())) return paymentsOff();
  if (!(await adminAddress(req))) return fail(403, "Only admin wallets can see earnings.");
  const rows = (await earnings(await db()))
    .filter((e) => e.earned > e.paid)
    .map((e) => [getAddress(e.address), usdg(e.earned - e.paid), e.earned - e.paid, e.earned, e.paid, e.requests, e.askers].join(","));
  const csv = ["address,unpaid_usdg,unpaid_micro_usd,earned_micro_usd,paid_micro_usd,requests,askers", ...rows].join("\n") + "\n";
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="inferno-unpaid-earnings.csv"',
      "Cache-Control": "no-store",
    },
  });
}
