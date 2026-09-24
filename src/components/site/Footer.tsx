import Link from "next/link";
import { site } from "@/lib/site";
import { BRIDGE_URL, DOCS_URL, EXPLORER_URL } from "@/lib/chain";
import { Logo } from "@/components/brand/Logo";

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

export function Footer() {
  return (
    <footer className="mt-32 border-t border-line/70">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 py-16 sm:px-8 md:grid-cols-[1.6fr_1fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-[15px] text-hush">
            AI chat on GPUs people lend. Lenders get paid in USDG on Robinhood Chain.
          </p>
        </div>
        {columns.map((c) => (
          <div key={c.title}>
            <h2 className="font-sans text-[15px] font-semibold text-mist" style={{ fontVariationSettings: "normal" }}>
              {c.title}
            </h2>
            <ul className="mt-4 space-y-2.5">
              {c.links.map((l) => (
                <li key={l.href}>
                  {l.external ? (
                    <a href={l.href} target="_blank" rel="noreferrer" className="text-[15px] text-hush transition-colors hover:text-mist">
                      {l.label}
                    </a>
                  ) : (
                    <Link href={l.href} className="text-[15px] text-hush transition-colors hover:text-mist">
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
