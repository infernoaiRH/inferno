"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { USDG } from "@/lib/chain";
import { site } from "@/lib/site";
import { shortAddress } from "@/lib/format";
import { cn } from "@/lib/cn";

type Item = { label: string; href: string } | { label: string; copy: string };

const items: Item[] = [
  { label: "Chat on Bittensor", href: "/chat?mode=bittensor" },
  { label: `Copy the $${site.token.symbol} contract address`, copy: site.token.address },
  { label: "Mine on Bittensor", href: "/lend#mine-bittensor" },
  { label: "Chat", href: "/chat" },
  { label: "Mine with your GPU", href: "/lend" },
  { label: "Credits", href: "/credits" },
  { label: "Messages", href: "/messages" },
  { label: "Network", href: "/network" },
  { label: "Pricing", href: "/#pricing" },
  { label: "Who hears what", href: "/#who-hears-what" },
  { label: "Questions", href: "/#faq" },
  // USDG is mainnet-only; on testnet there is nothing to copy.
  ...(USDG ? [{ label: "Copy USDG contract address", copy: USDG.address }] : []),
];

/**
 * Cmd+K / Ctrl+K: jump to a page or section, or copy the USDG address.
 * Adapted from karan-personal/sherpa-copy. The native modal <dialog> makes the page inert,
 * closes on Esc and restores focus; the input is the only tab stop (combobox + listbox).
 */
const PALETTE_EVENT = "inferno:palette";

/** Opens (or closes) the palette from anywhere, e.g. a nav button. */
export const togglePalette = () => window.dispatchEvent(new Event(PALETTE_EVENT));

export function CommandPalette() {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const [note, setNote] = useState(""); // result of the last copy, shown in place of the address

  useEffect(() => {
    const toggle = () => {
      const d = dialog.current;
      if (!d) return;
      if (d.open) {
        d.close();
        return;
      }
      setQuery("");
      setCursor(0);
      setNote("");
      d.showModal();
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || (e.key !== "k" && e.key !== "K")) return;
      e.preventDefault();
      toggle();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener(PALETTE_EVENT, toggle);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(PALETTE_EVENT, toggle);
    };
  }, []);

  const q = query.trim().toLowerCase();
  const results = items.filter((i) => i.label.toLowerCase().includes(q));

  const run = (item: Item) => {
    if ("copy" in item) {
      navigator.clipboard.writeText(item.copy).then(
        () => setNote("Copied"),
        () => setNote("Couldn't copy"),
      );
      return;
    }
    dialog.current?.close(); // close first: restoring focus must not undo the hash scroll
    router.push(item.href);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const n = results.length;
    if (e.key === "ArrowDown" && n) {
      e.preventDefault();
      setCursor((c) => (c + 1) % n);
    } else if (e.key === "ArrowUp" && n) {
      e.preventDefault();
      setCursor((c) => (c - 1 + n) % n);
    } else if (e.key === "Enter" && results[cursor]) {
      e.preventDefault();
      run(results[cursor]);
    } else if (e.key === "Tab") {
      e.preventDefault(); // options are reached with arrow keys, so focus stays in the input
    }
  };

  return (
    <dialog
      ref={dialog}
      aria-label="Command palette"
      onClick={(e) => e.target === e.currentTarget && e.currentTarget.close()}
      className="mx-auto mt-[14vh] w-[min(32rem,calc(100%-2rem))] overflow-hidden rounded-3xl border border-line-bright bg-night-2 text-mist shadow-2xl shadow-moon-deep/20 backdrop:bg-night/70 backdrop:backdrop-blur-sm"
    >
      <div className="flex items-center gap-3 border-b border-line px-5">
        <Search aria-hidden size={18} className="shrink-0 text-faint" />
        <input
          role="combobox"
          aria-expanded
          aria-controls={`${id}-list`}
          aria-activedescendant={results[cursor] ? `${id}-${cursor}` : undefined}
          aria-autocomplete="list"
          aria-label="Search pages and actions"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setCursor(0);
          }}
          onKeyDown={onKeyDown}
          placeholder="Jump to…"
          autoComplete="off"
          spellCheck={false}
          className="h-14 w-full bg-transparent text-base outline-none placeholder:text-faint"
        />
      </div>
      <ul id={`${id}-list`} role="listbox" aria-label="Results" className="max-h-80 overflow-y-auto p-2 empty:hidden">
        {results.map((item, i) => (
          <li
            key={item.label}
            id={`${id}-${i}`}
            role="option"
            aria-selected={i === cursor}
            onClick={() => run(item)}
            onMouseMove={() => setCursor(i)}
            className={cn(
              "flex cursor-pointer items-center justify-between gap-4 rounded-2xl px-4 py-2.5 text-[15px]",
              i === cursor ? "bg-night-3 text-mist" : "text-hush",
            )}
          >
            {item.label}
            {"copy" in item && (
              <span className="tnum text-sm text-faint">{note || shortAddress(item.copy)}</span>
            )}
          </li>
        ))}
      </ul>
      {results.length === 0 && <p className="px-5 py-6 text-[15px] text-faint">Nothing matches.</p>}
      <p role="status" className="sr-only">
        {note && `${note}: USDG contract address`}
      </p>
    </dialog>
  );
}
