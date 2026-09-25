"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Command, Menu, X } from "lucide-react";
import { togglePalette } from "@/components/palette/CommandPalette";
import { site } from "@/lib/site";
import { cn } from "@/lib/cn";
import { Logo } from "@/components/brand/Logo";
import { Tau } from "@/components/brand/Tau";
import { XLogo } from "@/components/brand/XLogo";
import { ConnectButton } from "@/components/wallet/ConnectButton";
import { LivePulse } from "@/components/site/LivePulse";

export function Nav({ variant = "site" }: { variant?: "site" | "app" }) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const header = useRef<HTMLElement>(null);

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  // The phone menu closes on Escape or a tap anywhere outside the header.
  useEffect(() => {
    if (!open) return;
    const close = (e: KeyboardEvent | PointerEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !header.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", close);
    document.addEventListener("pointerdown", close);
    return () => {
      document.removeEventListener("keydown", close);
      document.removeEventListener("pointerdown", close);
    };
  }, [open]);

  const solid = scrolled || open || variant === "app";

  return (
    <header
      ref={header}
      className={cn(
        "sticky top-0 z-40 border-b transition-[background-color,border-color] duration-500",
        solid ? "border-line/70 bg-night/80 backdrop-blur-xl" : "border-transparent bg-transparent",
      )}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center gap-8 px-5 sm:px-8" aria-label="Main">
        <Link href="/" aria-label={`${site.name} home`} className="shrink-0">
          <Logo />
        </Link>
        <ul className="hidden items-center gap-1 lg:flex">
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
          {/* Short at lg so the row fits 1024 px; the full line from xl, where there's room. */}
          <Link
            href="/#bittensor"
            className="hidden h-9 items-center gap-2 rounded-full border border-heat-2/50 px-3.5 text-[14px] whitespace-nowrap text-hush transition-colors hover:border-heat-3 hover:text-mist lg:inline-flex"
          >
            <Tau className="text-heat-4" />
            <span>
              <span className="hidden xl:inline">Powered by </span>Bittensor
            </span>
          </Link>
          {/* App pages stay network-quiet: no chain polling behind a private chat. */}
          {variant === "site" && <LivePulse className="hidden xl:flex" />}
          <a
            href={site.x}
            target="_blank"
            rel="noreferrer"
            aria-label={`Inferno on X, ${site.xHandle}`}
            title={site.xHandle}
            className="flex h-10 w-10 items-center justify-center rounded-full text-hush transition-colors hover:text-mist"
          >
            <XLogo className="text-[17px]" />
          </a>
          {/* From xl only, so the X link fits the 1024 px row; ⌘K works everywhere. */}
          <button
            onClick={togglePalette}
            className="hidden h-10 w-10 items-center justify-center rounded-full text-hush transition-colors hover:text-mist xl:flex"
            aria-label="Open the command menu"
            title="Jump anywhere (⌘K or Ctrl+K)"
          >
            <Command size={17} />
          </button>
          <ConnectButton className="hidden sm:inline-flex" />
          <button
            className="flex h-10 w-10 items-center justify-center rounded-full text-hush hover:text-mist lg:hidden"
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
        <div id="mobile-menu" className="border-t border-line/70 px-5 pb-6 lg:hidden">
          <ul className="flex flex-col py-2">
            {site.nav.map((l) => (
              <li key={l.href}>
                <Link href={l.href} onClick={() => setOpen(false)} className="block py-3 font-display text-2xl">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href="/#bittensor"
            onClick={() => setOpen(false)}
            className="mb-5 inline-flex min-h-11 items-center gap-2 rounded-full border border-heat-2/50 px-4 text-[15px] text-hush"
          >
            <Tau className="text-heat-4" />
            Powered by Bittensor subnet 64
          </Link>
          <div className="flex items-center justify-between gap-3">
            {variant === "site" ? <LivePulse className="flex min-h-10" /> : <span />}
            <ConnectButton />
          </div>
        </div>
      )}
    </header>
  );
}
