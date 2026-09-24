/**
 * Sealed messages: authenticated X25519 + XChaCha20-Poly1305 envelopes (NaCl box style),
 * wallet-bound messaging keys, and Signal-style safety numbers.
 * No "@/" imports: scripts/seal-check.ts runs this file directly under Node.
 */
import { xchacha20poly1305 } from "@noble/ciphers/chacha.js";
import { x25519 } from "@noble/curves/ed25519.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, concatBytes, randomBytes, utf8ToBytes } from "@noble/hashes/utils.js";
import { getAddress, toHex, verifyMessage } from "viem";

/** A messaging identity. `pub` (base64url) is the only name the relay ever sees. */
export type Identity = { pub: string; secret: Uint8Array };

/** What the relay stores and forwards. `from`, `to`, `nonce` and `ct` are base64url. */
export type Envelope = { v: 1; from: string; to: string; ts: number; nonce: string; ct: string };

/** A wallet's EIP-191 signature vouching for a messaging key. */
export type Binding = { address: `0x${string}`; key: string; chainId: number; signature: `0x${string}` };

export type SealErrorReason = "tampered" | "not-for-you" | "malformed";

export class SealError extends Error {
  readonly reason: SealErrorReason;
  constructor(reason: SealErrorReason, message: string) {
    super(message);
    this.name = "SealError";
    this.reason = reason;
  }
}

/** Padding step: the relay learns a note's size only to the nearest 256 bytes. */
const BLOCK = 256;
const TAG = 16; // Poly1305
const malformed = () => new SealError("malformed", "This isn't an Inferno envelope.");

export function toB64u(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromB64u(s: string): Uint8Array {
  return Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
}

/** A fresh X25519 messaging keypair. Keep `secret` in memory only. */
export function newIdentity(): Identity {
  const { secretKey, publicKey } = x25519.keygen();
  return { pub: toB64u(publicKey), secret: secretKey };
}

// Salt = from‖to makes the key directional: a note can't be reflected back as if the other side wrote it.
function boxKey(secret: Uint8Array, peer: Uint8Array, from: Uint8Array, to: Uint8Array) {
  return hkdf(sha256, x25519.getSharedSecret(secret, peer), concatBytes(from, to), utf8ToBytes("inferno/seal/v1"), 32);
}

// Everything the relay can see goes into the tag: a changed sender, recipient or time won't open.
function aad(from: Uint8Array, to: Uint8Array, ts: number) {
  const t = new Uint8Array(8);
  new DataView(t.buffer).setBigUint64(0, BigInt(ts));
  return concatBytes(utf8ToBytes("inferno/v1"), from, to, t);
}

/** Seal `text` from `me` to the holder of the `to` key. Only those two keys can open it. */
export function seal(text: string, me: Identity, to: string, ts = Date.now()): Envelope {
  const f = fromB64u(me.pub);
  const t = fromB64u(to);
  const msg = utf8ToBytes(text);
  const padded = new Uint8Array(Math.ceil((4 + msg.length) / BLOCK) * BLOCK);
  new DataView(padded.buffer).setUint32(0, msg.length);
  padded.set(msg, 4);
  const nonce = randomBytes(24);
  const ct = xchacha20poly1305(boxKey(me.secret, t, f, t), nonce, aad(f, t, ts)).encrypt(padded);
  return { v: 1, from: me.pub, to, ts, nonce: toB64u(nonce), ct: toB64u(ct) };
}

/** Open an envelope as its recipient (or its sender). Throws SealError if anything changed in transit. */
export function open(env: Envelope, me: Identity): string {
  if (me.pub !== env.to && me.pub !== env.from) throw new SealError("not-for-you", "This note was sealed for someone else.");
  let parts: Uint8Array[];
  try {
    parts = [env.from, env.to, env.nonce, env.ct].map(fromB64u);
  } catch {
    throw malformed();
  }
  const [f, t, nonce, ct] = parts;
  const shapeOk =
    env.v === 1 && Number.isSafeInteger(env.ts) && env.ts >= 0 && f.length === 32 && t.length === 32 &&
    nonce.length === 24 && ct.length >= BLOCK + TAG && (ct.length - TAG) % BLOCK === 0;
  if (!shapeOk) throw malformed();
  let padded: Uint8Array;
  try {
    padded = xchacha20poly1305(boxKey(me.secret, me.pub === env.from ? t : f, f, t), nonce, aad(f, t, env.ts)).decrypt(ct);
  } catch {
    throw new SealError("tampered", "This note was changed after it was sealed, so it won't open.");
  }
  const n = new DataView(padded.buffer, padded.byteOffset).getUint32(0);
  if (n > padded.length - 4) throw malformed();
  return new TextDecoder().decode(padded.subarray(4, 4 + n));
}

/** Signal-style safety number: 60 digits in 12 groups of 5, identical on both screens. */
export function safetyNumber(a: string, b: string): string {
  const [x, y] = [fromB64u(a), fromB64u(b)];
  const [lo, hi] = bytesToHex(x) < bytesToHex(y) ? [x, y] : [y, x];
  const h = sha256(concatBytes(utf8ToBytes("inferno/safety/v1"), lo, hi));
  const n = BigInt(`0x${bytesToHex(h)}`) % 10n ** 60n;
  return n.toString().padStart(60, "0").replace(/(\d{5})(?!$)/g, "$1 ");
}

/** The text a wallet signs (EIP-191 personal_sign) to vouch for a messaging key. */
export function bindingMessage(address: string, key: string, chainId: number): string {
  return [
    "Inferno messaging key v1",
    "Signing links this messaging key to your wallet. It costs nothing and can't move funds.",
    `Address: ${getAddress(address)}`,
    `Key: ${key}`,
    `Chain: ${chainId}`,
  ].join("\n");
}

/** True only if `signature` is `address` vouching for `key`. EOA wallets only (viem verifyMessage). */
export async function verifyBinding(b: Binding): Promise<boolean> {
  try {
    return await verifyMessage({ address: b.address, message: bindingMessage(b.address, b.key, b.chainId), signature: b.signature });
  } catch {
    return false;
  }
}

/**
 * Ask the wallet to sign the binding (call on a button press only). Wallet errors, such as the
 * user declining, throw; a signature that doesn't verify for `address` returns null.
 */
export async function signBinding(
  provider: { request(args: { method: string; params?: unknown[] }): Promise<unknown> },
  address: `0x${string}`,
  key: string,
  chainId: number,
): Promise<Binding | null> {
  const message = bindingMessage(address, key, chainId);
  const signature = (await provider.request({ method: "personal_sign", params: [toHex(message), address] })) as `0x${string}`;
  const binding: Binding = { address, key, chainId, signature };
  return (await verifyBinding(binding)) ? binding : null;
}
