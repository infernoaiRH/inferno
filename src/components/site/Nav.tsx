"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Command, Menu, X } from "lucide-react";
import { togglePalette } from "@/components/palette/CommandPalette";
import { site } from "@/lib/site";
import { cn } from "@/lib/cn";
import { Logo } from "@/components/brand/Logo";
import { ConnectButton } from "@/components/wallet/ConnectButton";
import { LivePulse } from "@/components/site/LivePulse";

export function Nav({ variant = "site" }: { variant?: "site" | "app" }) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  const solid = scrolled || open || variant === "app";

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b transition-[background-color,border-color] duration-500",
        solid ? "border-line/70 bg-night/80 backdrop-blur-xl" : "border-transparent bg-transparent",
      )}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center gap-8 px-5 sm:px-8" aria-label="Main">
        <Link href="/" aria-label={`${site.name} home`} className="shrink-0">
          <Logo />
        </Link>
        <ul className="hidden items-center gap-1 md:flex">
          {site.nav.map((l) => {
            const active = pathname === l.href;
            return (
              <li key={l.href}>
                <Link
                  href={l.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-[15px] whitespace-nowrap transition-colors",
                    active ? "text-mist" : "text-hush hover:text-mist",
                  )}
                >
                  {l.label}
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="ml-auto flex items-center gap-3">
          {/* App pages stay network-quiet: no chain polling behind a private chat. */}
          {variant === "site" && <LivePulse className="hidden xl:flex" />}
          <button
            onClick={togglePalette}
            className="hidden h-10 w-10 items-center justify-center rounded-full text-hush transition-colors hover:text-mist md:flex"
            aria-label="Open the command menu"
            title="Jump anywhere (⌘K or Ctrl+K)"
          >
            <Command size={17} />
          </button>
          <ConnectButton className="hidden sm:inline-flex" />
          <button
            className="flex h-10 w-10 items-center justify-center rounded-full text-hush hover:text-mist md:hidden"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </nav>
      {open && (
        <div id="mobile-menu" className="border-t border-line/70 px-5 pb-6 md:hidden">
          <ul className="flex flex-col py-2">
            {site.nav.map((l) => (
              <li key={l.href}>
                <Link href={l.href} onClick={() => setOpen(false)} className="block py-3 font-display text-2xl">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between gap-3">
            {variant === "site" ? <LivePulse className="flex" /> : <span />}
            <ConnectButton />
          </div>
        </div>
      )}
    </header>
  );
}
