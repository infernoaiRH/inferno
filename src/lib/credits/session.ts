/**
 * Session cookies and Sign-In with Ethereum checks. Pure (node:crypto and viem only), so
 * `node scripts/credits-check.ts` runs it as is.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { zeroAddress } from "viem";
import { validateSiweMessage, type SiweMessage } from "viem/siwe";

/** __Host- in production: the browser keeps it only if Secure, host-only and on path /, so no subdomain can plant one. */
export const SESSION_COOKIE = process.env.NODE_ENV === "production" ? "__Host-inferno_session" : "inferno_session";
export const SESSION_TTL_S = 7 * 24 * 60 * 60;
export const NONCE_TTL_MS = 10 * 60 * 1000;

const mac = (secret: string, body: string) => createHmac("sha256", secret).update(body).digest("base64url");

/** Cookie value `address.expiry.hmac`: expiry in unix seconds, HMAC-SHA256 of `address.expiry` keyed with SESSION_SECRET. */
export function signSession(address: string, secret: string, now = Date.now()): string {
  const body = `${address.toLowerCase()}.${Math.floor(now / 1000) + SESSION_TTL_S}`;
  return `${body}.${mac(secret, body)}`;
}

/**
 * The address in a genuine, unexpired session cookie, else null.
 * ponytail: stateless cookie, so sign-out can't revoke a copied one before it expires; rotating
 * SESSION_SECRET signs everyone out. Add a sessions table if per-session revocation matters.
 */
export function verifySession(value: string | null | undefined, secret: string, now = Date.now()): `0x${string}` | null {
  const m = /^(0x[0-9a-f]{40})\.(\d{10})\.([\w-]{43})$/.exec(value ?? "");
  if (!m || m[1] === zeroAddress || Number(m[2]) * 1000 <= now) return null;
  const want = Buffer.from(mac(secret, `${m[1]}.${m[2]}`));
  const got = Buffer.from(m[3]);
  return want.length === got.length && timingSafeEqual(want, got) ? (m[1] as `0x${string}`) : null;
}

/** One cookie from a request's Cookie header. */
export function readCookie(req: Request, name: string): string | undefined {
  for (const part of req.headers.get("cookie")?.split(";") ?? []) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return undefined;
}

export type Site = { domain: string; origin: string; chainId: number };

/**
 * What's wrong with a parsed SIWE message for this site, or null when nothing is. The caller burns
 * the nonce and checks the signature. The nonce lives 10 minutes, and issuedAt must fall within
 * 10 minutes of now (either way, for clock skew).
 */
export function siweProblem(m: Partial<SiweMessage>, site: Site, now = Date.now()): string | null {
  if (m.domain !== site.domain || !(m.uri === site.origin || m.uri?.startsWith(`${site.origin}/`)))
    return "This sign-in request is for a different site.";
  if (m.version !== "1" || m.chainId !== site.chainId) return "This sign-in request is for a different chain.";
  if (!m.address || !m.nonce) return "This sign-in request is incomplete.";
  // On-chain signature checks pass for the zero address with any 65-byte signature (ecrecover of junk is 0).
  if (m.address.toLowerCase() === zeroAddress) return "The zero address can't sign in.";
  if (!(Math.abs(now - (m.issuedAt?.getTime() ?? NaN)) <= NONCE_TTL_MS) || !validateSiweMessage({ message: m, time: new Date(now) }))
    return "This sign-in request has expired. Check your device's clock and try again.";
  return null;
}
