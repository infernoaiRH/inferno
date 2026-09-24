/** Self-check for src/lib/seal. Run: node scripts/seal-check.ts */
import assert from "node:assert/strict";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
// @ts-expect-error -- Node's type stripping needs the .ts extension; the shared tsconfig doesn't allow it
import { SealError, fromB64u, newIdentity, open, safetyNumber, seal, signBinding, toB64u, verifyBinding } from "../src/lib/seal/index.ts";

const you = newIdentity();
const ada = newIdentity();
const eve = newIdentity();
const failsWith = (reason: string) => (e: unknown) => e instanceof SealError && e.reason === reason;

// Round trip, for the recipient and for the sender's own copy.
const env = seal("The spare key is under the blue pot.", you, ada.pub);
assert.equal(open(env, ada), "The spare key is under the blue pot.");
assert.equal(open(env, you), "The spare key is under the blue pot.");

// One flipped byte, a changed time, a swapped sender or a reflected note won't open.
const ct = fromB64u(env.ct);
ct[40] ^= 1;
assert.throws(() => open({ ...env, ct: toB64u(ct) }, ada), failsWith("tampered"));
assert.throws(() => open({ ...env, ts: env.ts + 1 }, ada), failsWith("tampered"));
assert.throws(() => open({ ...env, from: eve.pub }, ada), failsWith("tampered"));
assert.throws(() => open({ ...env, from: env.to, to: env.from }, ada), failsWith("tampered"));

// Wrong recipient.
assert.throws(() => open(env, eve), failsWith("not-for-you"));
assert.throws(() => open({ ...env, to: eve.pub }, eve), failsWith("tampered"));

// Padding hides length.
const short = seal("ok", you, ada.pub);
const longer = seal("Running late. Save me a seat near the back, by the aisle.", you, ada.pub);
assert.equal(short.ct.length, longer.ct.length);
assert.equal(fromB64u(short.ct).length, 272);
assert.equal(fromB64u(seal("x".repeat(253), you, ada.pub).ct).length, 528);
assert.equal(open(seal("", you, ada.pub), ada), "");
assert.equal(open(seal("Ünïcödé 🌙", you, ada.pub), ada), "Ünïcödé 🌙");

// Safety number: 12 groups of 5, the same on both sides, different for a different key.
const sn = safetyNumber(you.pub, ada.pub);
assert.match(sn, /^(\d{5} ){11}\d{5}$/);
assert.equal(sn, safetyNumber(ada.pub, you.pub));
assert.notEqual(sn, safetyNumber(you.pub, eve.pub));

// Wallet binding through the same personal_sign path the UI uses.
const account = privateKeyToAccount(generatePrivateKey());
const wallet = {
  request: async ({ method, params }: { method: string; params?: unknown[] }) => {
    assert.equal(method, "personal_sign");
    const [data, address] = params as [`0x${string}`, string];
    assert.equal(address, account.address);
    return account.signMessage({ message: { raw: data } });
  },
};
const binding = await signBinding(wallet, account.address, you.pub, 4663);
assert.ok(binding);
assert.equal(await verifyBinding(binding), true);
const liar = { request: async () => privateKeyToAccount(generatePrivateKey()).signMessage({ message: "not the binding" }) };
assert.equal(await signBinding(liar, account.address, you.pub, 4663), null);
assert.equal(await verifyBinding({ ...binding, key: eve.pub }), false);
assert.equal(await verifyBinding({ ...binding, chainId: 46630 }), false);
assert.equal(await verifyBinding({ ...binding, address: privateKeyToAccount(generatePrivateKey()).address }), false);

console.log("seal-check: all passed");
