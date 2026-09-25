import { site } from "@/lib/site";
import { CHAIN, EXPLORER_URL } from "@/lib/chain";
import { CopyCA } from "@/components/site/CopyCA";
import { XLogo } from "@/components/brand/XLogo";

/** The strip above the nav: $INFERNOAI is live, with its contract address to copy and check. Mainnet only. */
export function LiveBar() {
  if (CHAIN.testnet) return null;
  const { symbol, address } = site.token;
  return (
    <div className="border-b border-line/70 bg-night-2">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-3 gap-y-1 px-5 py-1 text-[13px] sm:px-8">
        <span className="flex items-center gap-2 font-semibold text-mint">
          <span aria-hidden className="h-1.5 w-1.5 animate-breathe rounded-full bg-mint" />
          Live
        </span>
        <span className="text-mist">
          ${symbol}
          <span className="hidden sm:inline text-hush"> on Robinhood Chain</span>
        </span>
        <CopyCA />
        <a
          href={`${EXPLORER_URL}/token/${address}`}
          target="_blank"
          rel="noreferrer"
          className="hidden text-hush underline decoration-line-bright underline-offset-4 hover:text-mist md:inline"
        >
          Check it on the explorer
        </a>
        <a
          href={site.x}
          target="_blank"
          rel="noreferrer"
          className="hidden items-center gap-1.5 text-hush hover:text-mist sm:inline-flex"
        >
          <XLogo className="text-[12px]" />
          {site.xHandle}
        </a>
      </div>
    </div>
  );
}
