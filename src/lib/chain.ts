import { createPublicClient, http, type Address } from "viem";
import { robinhood, robinhoodTestnet } from "viem/chains";

/**
 * Robinhood Chain (Arbitrum Orbit rollup on Ethereum). Mainnet 4663, testnet 46630.
 * Facts and addresses were verified on 2026-09-23; see docs/research/opencomm-evaluation.md §9.
 */
export const CHAIN = process.env.NEXT_PUBLIC_CHAIN === "testnet" ? robinhoodTestnet : robinhood;
export const IS_MAINNET = CHAIN.id === robinhood.id;
export const CHAIN_HEX = `0x${CHAIN.id.toString(16)}`;

/** The public RPC is rate-limited; set NEXT_PUBLIC_RPC_URL (e.g. Alchemy) for production traffic. */
export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL ?? CHAIN.rpcUrls.default.http[0];

export const publicClient = createPublicClient({
  chain: CHAIN,
  transport: http(RPC_URL, { batch: { wait: 16 } }),
});

/**
 * Server-side reads (deposit indexer, sign-in checks). RPC_URL is server-only, so its key never
 * reaches browsers and visitors can't burn its quota. ROBINHOOD_RPC_URL is accepted too, so one
 * Vercel shared variable can serve several projects. Falls back to the public client.
 */
const SERVER_RPC_URL = typeof window === "undefined" ? (process.env.RPC_URL ?? process.env.ROBINHOOD_RPC_URL) : undefined;
export const serverClient = SERVER_RPC_URL
  ? createPublicClient({ chain: CHAIN, transport: http(SERVER_RPC_URL, { batch: { wait: 16 } }) })
  : publicClient;

export const EXPLORER_URL = CHAIN.blockExplorers?.default.url ?? "https://robinhoodchain.blockscout.com";
export const explorerTx = (hash: string) => `${EXPLORER_URL}/tx/${hash}`;
export const explorerAddress = (address: string) => `${EXPLORER_URL}/address/${address}`;
export const explorerBlock = (n: bigint | number) => `${EXPLORER_URL}/block/${n.toString()}`;

export const BRIDGE_URL = "https://portal.arbitrum.io/bridge?destinationChain=robinhood-chain";
export const DOCS_URL = "https://docs.robinhood.com/chain";

/** Mainnet-only token and feed addresses. On testnet these are null. */
export const USDG: { address: Address; decimals: number; symbol: string } | null = IS_MAINNET
  ? { address: "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168", decimals: 6, symbol: "USDG" }
  : null;
export const WETH_ADDRESS: Address | null = IS_MAINNET ? "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73" : null;
export const CHAINLINK_ETH_USD: Address | null = IS_MAINNET ? "0x78F3556b67E17Df817D51Ef5a990cDaF09E8d3A9" : null;
