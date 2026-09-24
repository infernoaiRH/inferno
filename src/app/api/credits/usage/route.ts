import { isAddress } from "viem";
import { crossSite, db, fail, paymentsEnabled, paymentsOff, sessionAddress } from "@/lib/credits";
import { balance, settleUsage, usageSplit } from "@/lib/credits/ledger";
import { LENDER_SHARE, USD_PER_1K_TOKENS } from "@/lib/relay/protocol";
import { limits } from "@/lib/limits";
import { limit, readJson } from "@/lib/relay/server";

/** Lender models hold about 4,096 tokens, so no honest answer counts more. */
const MAX_TOKENS = 8_192;
const count = (n: unknown): n is number => Number.isSafeInteger(n) && (n as number) >= 0;

/**
 * Network-mode settlement, sent by the asker's browser after an answer:
 * { ref, lender, promptTokens, answerTokens }. Debits the asker and books LENDER_SHARE to the
 * lender, once per ref (stored as `net:<ref>`, apart from server-made refs). 402 when the balance is short.
 * ponytail: asker-reported usage, so an asker can under-report or skip it and pick any lender;
 * move to lender-countersigned receipts. Until then, review earnings before each payout.
 */
export async function POST(req: Request) {
  const busy = limit(limits.usage, req);
  if (busy) return busy;
  if (!(await paymentsEnabled())) return paymentsOff();
  if (crossSite(req)) return fail(403, "Settle usage from this site.");
  const asker = await sessionAddress(req);
  if (!asker) return fail(401, "Sign in with your wallet to pay for network answers.");
  const body = await readJson(req);
  if (body instanceof Response) return body;
  const { ref, lender, promptTokens, answerTokens } = (body ?? {}) as Record<string, unknown>;
  if (typeof ref !== "string" || !/^[\w:.-]{1,128}$/.test(ref) || typeof lender !== "string" || !isAddress(lender, { strict: false }) || !count(promptTokens) || !count(answerTokens))
    return fail(400, "Send { ref, lender, promptTokens, answerTokens }.");
  const tokens = promptTokens + answerTokens;
  if (tokens < 1 || tokens > MAX_TOKENS) return fail(400, `A request counts between 1 and ${MAX_TOKENS} tokens.`);

  const d = await db();
  // Serving yourself costs nothing and earns nothing.
  if (lender.toLowerCase() === asker) return Response.json({ ok: true, costMicroUsd: 0, balanceMicroUsd: await balance(d, asker) });
  const { cost, lender: cut } = usageSplit(tokens, USD_PER_1K_TOKENS, LENDER_SHARE);
  const r = await settleUsage(d, asker, lender, cost, cut, ref);
  if (!r.ok && r.reason === "insufficient") return fail(402, "You're out of credits. Top up on the credits page.");
  return Response.json({ ok: true, duplicate: !r.ok, costMicroUsd: cost, balanceMicroUsd: r.ok ? r.balance : await balance(d, asker) });
}
