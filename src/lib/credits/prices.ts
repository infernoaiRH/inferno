import { createPublicClient, encodeAbiParameters, http, keccak256, parseAbi, parseAbiParameters, zeroAddress, type Address, type PublicClient } from "viem";
import { arbitrum } from "viem/chains";
import { CHAINLINK_ETH_USD, IS_MAINNET, serverClient } from "@/lib/chain";
import { site } from "@/lib/site";
import { afterHaircut, coinPriceMicro, feedMicro } from "./ledger";

/** $INFERNOAI (18 decimals, checked on-chain). Credits take it on mainnet at its live price; see ledger.ts coinDepositPrice. */
export const COIN_TOKEN = IS_MAINNET ? { address: site.token.address, symbol: site.token.symbol, decimals: 18 } : null;
/** TAO bridged to Robinhood Chain over Chainlink CCIP by ForeverMoney (18 decimals, checked on-chain). Credits take it on mainnet at Chainlink's TAO/USD price. */
export const TAO_TOKEN = IS_MAINNET ? { address: "0xf3081494B87e8D5fb7960f066E931D1D0e6E3d67" as Address, symbol: "TAO", decimals: 18 } : null;

const feedAbi = parseAbi(["function latestRoundData() view returns (uint80, int256, uint256, uint256, uint80)", "function decimals() view returns (uint8)"]);
/** The feeds used here update at least daily; an older answer means the feed stopped. */
const FEED_MAX_AGE_S = 25n * 3600n;

/** A Chainlink feed's latest answer and its decimals. Throws when the answer isn't positive or is more than 25 hours old. */
async function readFeed(client: PublicClient, address: Address): Promise<[bigint, number]> {
  const [[, answer, , updatedAt], decimals] = await Promise.all([
    client.readContract({ address, abi: feedAbi, functionName: "latestRoundData" }),
    client.readContract({ address, abi: feedAbi, functionName: "decimals" }),
  ]);
  if (answer <= 0n || BigInt(Math.floor(Date.now() / 1000)) - updatedAt > FEED_MAX_AGE_S) throw new Error(`Chainlink feed ${address} is stale.`);
  return [answer, decimals];
}

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
const poolManagerAbi = parseAbi(["function extsload(bytes32 startSlot, uint256 nSlots) view returns (bytes32[])"]);

/** The coin's price right now, in micro-USD per whole coin. Throws when the pool or the ETH/USD feed can't be trusted. */
export async function readCoinPrice(): Promise<number> {
  if (!COIN_TOKEN || !CHAINLINK_ETH_USD) throw new Error("The coin is priced on mainnet only.");
  const [words, [ethUsd, decimals]] = await Promise.all([
    serverClient.readContract({ address: POOL_MANAGER, abi: poolManagerAbi, functionName: "extsload", args: [POOL_STATE, 4n] }),
    readFeed(serverClient, CHAINLINK_ETH_USD),
  ]);
  const sqrtPriceX96 = BigInt(words[0]) & ((1n << 160n) - 1n);
  const liquidity = BigInt(words[3]) & ((1n << 128n) - 1n);
  if (!sqrtPriceX96 || (liquidity << 96n) / sqrtPriceX96 < MIN_ETH_DEPTH) throw new Error("The coin's pool has less than 2 ETH in range.");
  return coinPriceMicro(sqrtPriceX96, ethUsd, decimals);
}

/** Chainlink TAO/USD on Arbitrum One, since Robinhood Chain has no TAO feed. Rated low risk; updates on a 2% move or every 24 hours. */
const TAO_USD = "0x6aCcBB82aF71B8a576B4C05D4aF92A83A035B991";
/** ARBITRUM_RPC_URL (server-only) if set, else Arbitrum's public RPC. */
const arbitrumClient = createPublicClient({ chain: arbitrum, transport: http(process.env.ARBITRUM_RPC_URL) });
let tao: { at: number; price: Promise<number> } | undefined;

/**
 * What a TAO deposit credits per TAO now, in micro-USD: Chainlink's TAO/USD less 10%, which also covers
 * the feed's 2% update band and the bridge. 0, and TAO deposits wait, while the feed is stale or out of
 * reach. Read at most once a minute per instance.
 */
export function taoDepositPrice(now = Date.now()): Promise<number> {
  if (!tao || now - tao.at > 60_000)
    tao = {
      at: now,
      price: readFeed(arbitrumClient as PublicClient, TAO_USD).then(
        ([answer, decimals]) => afterHaircut(feedMicro(answer, decimals)),
        (e: unknown) => {
          console.error("[credits] No TAO price:", (e as { shortMessage?: string }).shortMessage ?? String(e));
          return 0;
        },
      ),
    };
  return tao.price;
}
