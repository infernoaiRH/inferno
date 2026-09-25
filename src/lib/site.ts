/** Brand and navigation. Renaming the product is a one-line change here. */
export const site = {
  name: "Inferno",
  wordmark: "inferno",
  x: "https://x.com/infernoairh",
  xHandle: "@infernoairh",
  /** $INFERNOAI on Robinhood Chain mainnet (checked on 2026-09-26: ERC-20, 18 decimals, 1,000,000,000 supply). */
  token: { symbol: "INFERNOAI", address: "0x81d31D40Aca12F671d3A4Db44516d84121463CF3" },
  tagline: "Private compute, powered by Bittensor.",
  description:
    "Inferno is a private compute network powered by Bittensor. Run open models in sealed hardware on Bittensor subnet 64, on GPUs people lend or on your own, mine with your GPU, and send sealed messages between wallets. Lenders get paid in USDG on Robinhood Chain.",
  // On Vercel, the production domain (vercel.app or a custom one) unless NEXT_PUBLIC_SITE_URL says otherwise.
  url:
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000"),
  disclaimer:
    "Inferno is an independent project built on Robinhood Chain. It is not affiliated with, endorsed by, or sponsored by Robinhood Markets, Inc.",
  nav: [
    { href: "/chat", label: "Chat" },
    { href: "/lend", label: "Mine" },
    { href: "/network", label: "Network" },
    { href: "/messages", label: "Messages" },
    { href: "/credits", label: "Credits" },
  ],
} as const;
