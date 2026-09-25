/** Brand and navigation. Renaming the product is a one-line change here. */
export const site = {
  name: "Inferno",
  wordmark: "inferno",
  tagline: "Chat with AI that runs on GPUs people lend.",
  description:
    "Inferno is an AI inference network on Robinhood Chain. Chat with open models served by GPUs people lend, or lend yours and get paid in USDG.",
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
