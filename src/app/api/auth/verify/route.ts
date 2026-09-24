import { cookies } from "next/headers";
import { parseSiweMessage, verifySiweMessage } from "viem/siwe";
import { serverClient } from "@/lib/chain";
import { crossSite, db, fail, paymentsEnabled, paymentsOff, site } from "@/lib/credits";
import { creditsConfig } from "@/lib/credits/config";
import { burnNonce } from "@/lib/credits/ledger";
import { SESSION_COOKIE, SESSION_TTL_S, signSession, siweProblem } from "@/lib/credits/session";
import { limits } from "@/lib/limits";
import { limit, readJson } from "@/lib/relay/server";

/**
 * Sign-In with Ethereum: checks the message's domain, uri, chain and freshness, burns its nonce,
 * then verifies the signature against the chain (smart-contract wallets too, via ERC-1271/6492).
 * Sets a 7-day HttpOnly session cookie.
 */
export async function POST(req: Request) {
  const busy = limit(limits.auth, req);
  if (busy) return busy;
  const config = creditsConfig().config;
  if (!config || !(await paymentsEnabled())) return paymentsOff();
  if (crossSite(req)) return fail(403, "Sign in from this site.");
  const body = await readJson(req);
  if (body instanceof Response) return body;
  const { message, signature } = (body ?? {}) as { message?: unknown; signature?: unknown };
  if (typeof message !== "string" || message.length > 2_000 || typeof signature !== "string" || !/^0x[0-9a-fA-F]{130,20000}$/.test(signature))
    return fail(400, "Send the signed sign-in message and its signature.");

  const expect = site(req);
  const parsed = parseSiweMessage(message);
  const problem = siweProblem(parsed, expect);
  if (problem) return fail(401, problem);
  if (!(await burnNonce(await db(), parsed.nonce!))) return fail(401, "This sign-in request was already used or has expired. Try again.");
  const ok = await verifySiweMessage(serverClient, { message, signature: signature as `0x${string}`, domain: expect.domain, nonce: parsed.nonce }).catch(
    (e: unknown) => {
      console.error("[credits] Signature check failed:", (e as { shortMessage?: string }).shortMessage ?? String(e));
      return false;
    },
  );
  if (!ok) return fail(401, "That signature doesn't match the wallet. Try again.");

  const address = parsed.address!.toLowerCase();
  (await cookies()).set(SESSION_COOKIE, signSession(address, config.secret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_S,
  });
  return Response.json({ address }, { headers: { "Cache-Control": "no-store" } });
}
