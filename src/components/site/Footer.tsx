import Link from "next/link";
import { site } from "@/lib/site";
import { BRIDGE_URL, DOCS_URL, EXPLORER_URL } from "@/lib/chain";
import { Logo } from "@/components/brand/Logo";
import { Tau } from "@/components/brand/Tau";

const columns: { title: string; links: { href: string; label: string; external?: boolean }[] }[] = [
  {
    title: "Product",
    links: [
      { href: "/chat", label: "Chat" },
      { href: "/lend", label: "Mine with your GPU" },
      { href: "/network", label: "Live network" },
      { href: "/messages", label: "Sealed messages" },
      { href: "/#pricing", label: "Pricing" },
    ],
  },
  {
    title: "Bittensor",
    links: [
      { href: "/chat?mode=bittensor", label: "Chat on Bittensor" },
      { href: "/lend#mine-bittensor", label: "Mine on Bittensor" },
      { href: "https://bittensor.com", label: "What Bittensor is", external: true },
      { href: "https://taostats.io/subnets/64", label: "Subnet 64 on taostats", external: true },
      { href: "https://chutes.ai", label: "Chutes", external: true },
    ],
  },
  {
    title: "Robinhood Chain",
    links: [
      { href: DOCS_URL, label: "Developer docs", external: true },
      { href: EXPLORER_URL, label: "Block explorer", external: true },
      { href: BRIDGE_URL, label: "Bridge ETH", external: true },
    ],
  },
  {
    title: "Trust",
    links: [
      { href: "/#who-hears-what", label: "Who hears what" },
      { href: "/#faq", label: "Questions" },
    ],
  },
];

// 40 px tall on phones so every link is an easy tap; natural height where there's a pointer.
const linkClass = "inline-flex min-h-10 items-center text-[15px] text-hush transition-colors hover:text-mist lg:min-h-0";

export function Footer() {
  return (
    <footer className="mt-32 border-t border-line/70">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-x-6 gap-y-12 px-5 py-16 sm:px-8 lg:grid-cols-[1.6fr_1fr_1fr_1fr_1fr]">
        <div className="col-span-2 lg:col-span-1">
          <Logo />
          <p className="mt-4 max-w-xs text-[15px] text-hush">
            Private compute on Bittensor and GPUs people lend. Get paid in USDG on Robinhood Chain.
          </p>
          <Link
            href="/#bittensor"
            className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-full border border-heat-2/50 px-3.5 py-1.5 text-[14px] text-hush transition-colors hover:border-heat-3 hover:text-mist"
          >
            <Tau className="text-heat-4" />
            Powered by Bittensor
          </Link>
        </div>
        {columns.map((c) => (
          <div key={c.title}>
            <h2 className="font-sans text-[15px] font-semibold text-mist" style={{ fontVariationSettings: "normal" }}>
              {c.title}
            </h2>
            <ul className="mt-3 lg:mt-4 lg:space-y-2.5">
              {c.links.map((l) => (
                <li key={l.href}>
                  {l.external ? (
                    <a href={l.href} target="_blank" rel="noreferrer" className={linkClass}>
                      {l.label}
                    </a>
                  ) : (
                    <Link href={l.href} className={linkClass}>
                      {l.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-line/50">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-6 text-[13px] text-faint sm:px-8 md:flex-row md:justify-between">
          <p className="max-w-3xl">{site.disclaimer}</p>
          <p>© 2026 {site.name}</p>
        </div>
      </div>
    </footer>
  );
}
