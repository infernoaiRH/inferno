import { getAddress, verifyMessage } from "viem";

/**
 * Network inference over the relay.
 *
 * A lender's browser loads a model, makes a node key (X25519) and has its wallet sign
 * `nodeBindingMessage`, so anyone can check that the key really belongs to that address.
 * An asker makes a throwaway key, seals `ToNode` to the node key, and gets `FromNode`
 * messages sealed back. The relay routes envelopes by key and sees no content; the
 * lender's GPU reads the prompt only to answer it, and never learns the asker's wallet.
 */

/** Lenders re-announce this often; the relay forgets a node after NODE_TTL_MS of silence. */
export const HEARTBEAT_MS = 10_000;
export const NODE_TTL_MS = 30_000;

/** A lender's public offer, signed by their wallet. */
export type NodeOffer = {
  address: `0x${string}`;
  /** Node X25519 public key, base64url: the `to` of every envelope sent to this node. */
  key: string;
  /** web-llm model id this node is serving. */
  model: string;
  modelName: string;
  /** GPU as the browser names it, when it shares one. */
  gpu?: string;
  /** Recent decode speed, tokens per second. */
  tps?: number;
  chainId: number;
  /** EIP-191 signature over nodeBindingMessage(address, key, chainId). */
  signature: `0x${string}`;
};

export type ListedNode = NodeOffer & { seenAt: number };

export function nodeBindingMessage(address: string, key: string, chainId: number): string {
  return [
    "Inferno node key v1",
    `Address: ${getAddress(address)}`,
    `Key: ${key}`,
    `Chain: ${chainId}`,
    "This key serves AI answers for this wallet. Signing is free and moves no funds.",
  ].join("\n");
}

/** True when the offer's wallet really signed its node key. Works for regular (EOA) wallets. */
export async function verifyNodeOffer(o: NodeOffer): Promise<boolean> {
  try {
    return await verifyMessage({ address: o.address, message: nodeBindingMessage(o.address, o.key, o.chainId), signature: o.signature });
  } catch {
    return false;
  }
}

export type Turn = { role: "user" | "assistant"; content: string };

/** web-llm's measurements for one answer, as the node reports them. Times in seconds. */
export type NodeStats = { promptTokens: number; answerTokens: number; tps: number; firstTokenS: number; totalS: number };

/** Sealed from asker to node. `id` ties the replies to the request. */
export type ToNode = { t: "infer"; id: string; turns: Turn[] } | { t: "stop"; id: string };

/** Sealed from node back to asker. */
export type FromNode =
  | { t: "accepted"; id: string; model: string; ahead: number }
  | { t: "chunk"; id: string; seq: number; text: string; tps: number }
  | { t: "done"; id: string; stopped: boolean; stats?: NodeStats; gpu?: string }
  | { t: "error"; id: string; message: string };

/** Planned launch price for small (8B-class) network models: $0.01 per 1,000 tokens; lenders keep 70%. */
export const USD_PER_1K_TOKENS = 0.01;
export const LENDER_SHARE = 0.7;
