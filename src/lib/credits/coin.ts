import { encodeAbiParameters, keccak256, parseAbi, parseAbiParameters, zeroAddress } from "viem";
import { CHAINLINK_ETH_USD, IS_MAINNET, serverClient } from "@/lib/chain";
import { site } from "@/lib/site";
import { coinPriceMicro } from "./ledger";

/** $INFERNOAI (18 decimals, checked on-chain). Credits take it on mainnet at its live price; see ledger.ts coinDepositPrice. */
export const COIN_TOKEN = IS_MAINNET ? { address: site.token.address, symbol: site.token.symbol, decimals: 18 } : null;

const POOL_MANAGER = "0x8366a39CC670B4001A1121B8F6A443A643e40951"; // Uniswap v4 on Robinhood Chain
/**
 * The pool Pons launched the coin in: ETH/INFERNOAI, fee set by its hook, tick spacing 200. Only this
 * one is read, since anyone can open another pool for the coin at any price. Its state is PoolManager's
 * pools[id] (storage slot 6): slot0 first, with sqrtPriceX96 in the low 160 bits, and liquidity 3 slots on.
 */
const POOL_ID = keccak256(
  encodeAbiParameters(parseAbiParameters("address, address, uint24, int24, address"), [zeroAddress, site.token.address, 0, 200, "0xE5e702641Ea86F4ae6cC3cDaeD2B886f976Be044"]),
);
const POOL_STATE = keccak256(encodeAbiParameters(parseAbiParameters("bytes32, uint256"), [POOL_ID, 6n]));
/** With less than this much ETH in range at the current price, a small trade moves it too far to trust. */
const MIN_ETH_DEPTH = 2n * 10n ** 18n;
/** Chainlink's ETH/USD feed here updates at least daily; an older answer means it stopped. */
const FEED_MAX_AGE_S = 25n * 3600n;

const poolManagerAbi = parseAbi(["function extsload(bytes32 startSlot, uint256 nSlots) view returns (bytes32[])"]);
const feedAbi = parseAbi(["function latestRoundData() view returns (uint80, int256, uint256, uint256, uint80)", "function decimals() view returns (uint8)"]);

/** The coin's price right now, in micro-USD per whole coin. Throws when the pool or the feed can't be trusted. */
export async function readCoinPrice(): Promise<number> {
  if (!COIN_TOKEN || !CHAINLINK_ETH_USD) throw new Error("The coin is priced on mainnet only.");
  const [words, [, ethUsd, , updatedAt], decimals] = await Promise.all([
    serverClient.readContract({ address: POOL_MANAGER, abi: poolManagerAbi, functionName: "extsload", args: [POOL_STATE, 4n] }),
    serverClient.readContract({ address: CHAINLINK_ETH_USD, abi: feedAbi, functionName: "latestRoundData" }),
    serverClient.readContract({ address: CHAINLINK_ETH_USD, abi: feedAbi, functionName: "decimals" }),
  ]);
  const sqrtPriceX96 = BigInt(words[0]) & ((1n << 160n) - 1n);
  const liquidity = BigInt(words[3]) & ((1n << 128n) - 1n);
  if (!sqrtPriceX96 || (liquidity << 96n) / sqrtPriceX96 < MIN_ETH_DEPTH) throw new Error("The coin's pool has less than 2 ETH in range.");
  if (ethUsd <= 0n || BigInt(Math.floor(Date.now() / 1000)) - updatedAt > FEED_MAX_AGE_S) throw new Error("Chainlink's ETH/USD answer is stale.");
  return coinPriceMicro(sqrtPriceX96, ethUsd, decimals);
}
