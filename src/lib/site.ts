/** Brand and navigation. Renaming the product is a one-line change here. */
export const site = {
  name: "Inferno",
  wordmark: "inferno",
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
