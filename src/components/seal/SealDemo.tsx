"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { shortAddress } from "@/lib/format";
import { SealError, fromB64u, newIdentity, open, safetyNumber, seal, toB64u, type Envelope, type Identity } from "@/lib/seal";
import { SafetyNumber } from "./SafetyNumber";

const NOTE = "Ada, the spare key is under the blue pot. Water the basil if you get a minute. Back on Sunday.";

// Demo keys for You and Ada: made once per tab, in the browser, never during server rendering.
let demo: { you: Identity; ada: Identity; first: Envelope } | undefined;
function getDemo() {
  if (!demo) {
    const you = newIdentity();
    const ada = newIdentity();
    demo = { you, ada, first: seal(NOTE, you, ada.pub) };
  }
  return demo;
}
const subscribe = () => () => {};

// Same footprint as a sealed short note, shown until the keys exist.
const BLANK_CT = toB64u(new Uint8Array(272));
const BLANK_SAFETY = Array(12).fill(" ".repeat(5)).join(" ");
const utf8Length = (s: string) => new TextEncoder().encode(s).length;
const clock = (ts: number) => new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });

/** Landing demo: a note sealed live between two in-browser keys, opened or tampered with on request. */
export function SealDemo() {
  const ids = useSyncExternalStore(subscribe, getDemo, () => null);
  const [text, setText] = useState(NOTE);
  const [resealed, setResealed] = useState<Envelope | null>(null);
  const [flipped, setFlipped] = useState<number | null>(null);
  const [opened, setOpened] = useState<{ ok: boolean; text: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const env = resealed ?? ids?.first ?? null;

  function reseal(note: string) {
    if (!ids) return;
    setResealed(seal(note, ids.you, ids.ada.pub));
    setFlipped(null);
    setOpened(null);
  }

  function write(note: string) {
    setText(note);
    setOpened(null);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => reseal(note), 250);
  }

  function tamper() {
    if (!env) return;
    if (flipped !== null) return reseal(text);
    const ct = fromB64u(env.ct);
    const i = Math.floor(Math.random() * ct.length);
    ct[i] ^= 0xff;
    setResealed({ ...env, ct: toB64u(ct) });
    setFlipped(i);
    setOpened(null);
  }

  function openAsAda() {
    if (!env || !ids) return;
    try {
      setOpened({ ok: true, text: open(env, ids.ada) });
    } catch (e) {
      setOpened({ ok: false, text: e instanceof SealError ? e.message : "This note won't open." });
    }
  }

  return (
    <section id="seal" aria-labelledby="seal-title" className="mx-auto max-w-7xl px-5 py-32 sm:px-8">
      <div className="grid gap-y-16 lg:grid-cols-12 lg:gap-x-12">
        <div className="lg:sticky lg:top-28 lg:col-span-5 lg:self-start">
          <h2 id="seal-title" className="wide text-[clamp(2.25rem,5.2vw,4.5rem)] leading-[0.95] font-black">
            You can message people too.
          </h2>
          <p className="mt-6 max-w-md text-lg text-hush">
            Notes between wallets are sealed on your device, with your key and Ada&apos;s, before they leave your screen. The
            relay only ever carries the sealed box. It can see which keys are talking and when, but not a word you wrote, or
            even how long it was.
          </p>
          <div className="mt-12 max-w-md border-t border-line pt-6">
            <h3 className="text-xl">Your safety number with Ada</h3>
            <SafetyNumber className="mt-4" value={ids ? safetyNumber(ids.you.pub, ids.ada.pub) : BLANK_SAFETY} />
            <p className="mt-4 text-[15px] text-hush">
              Ada sees the same 60 digits on her screen. Read a few groups to each other once. If they match, nobody swapped
              a key between you.
            </p>
          </div>
          <p className="mt-8 text-sm text-hush">You and Ada are demo keys made in this tab just now. Nothing leaves your browser.</p>
        </div>

        <ol className="space-y-16 border-l border-line pl-6 sm:pl-10 lg:col-span-6 lg:col-start-7">
          <li className="relative">
            <Mark className="bg-flame" />
            <h3 className="text-2xl">
              <label htmlFor="seal-note">You write</label>
            </h3>
            <p className="mt-1 text-[15px] text-hush">Sealed as you type, from your key to Ada&apos;s.</p>
            <textarea
              id="seal-note"
              value={text}
              onChange={(e) => write(e.target.value)}
              rows={4}
              maxLength={400}
              className="mt-5 block w-full resize-none rounded-2xl border border-line bg-night-2 px-5 py-4 font-display text-[1.375rem] leading-snug text-mist transition-colors hover:border-line-bright focus:border-flame/60"
            />
          </li>

          <li className="relative">
            <Mark className="bg-faint" />
            <h3 className="text-2xl">The relay sees</h3>
            <p className="mt-1 text-[15px] text-hush">Two keys, a time and the sealed bytes. No names, no words.</p>
            <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-[15px]">
              <dt className="text-hush">From</dt>
              <dd className="tnum text-mist">
                {env ? shortAddress(env.from) : "…"} <span className="text-hush">your key</span>
              </dd>
              <dt className="text-hush">To</dt>
              <dd className="tnum text-mist">
                {env ? shortAddress(env.to) : "…"} <span className="text-hush">Ada&apos;s key</span>
              </dd>
              <dt className="text-hush">Sent</dt>
              <dd className="tnum text-mist">{env ? clock(env.ts) : "…"}</dd>
              <dt className="text-hush">Nonce</dt>
              <dd className="tnum text-mist">
                {env ? shortAddress(env.nonce) : "…"} <span className="text-hush">random, used once</span>
              </dd>
            </dl>
            <figure className="mt-6">
              <SealedField key={env ? "live" : "blank"} ct={env?.ct ?? BLANK_CT} nonce={env?.nonce ?? ""} flipped={flipped} />
              <figcaption className="mt-4 text-sm text-hush">
                {flipped !== null && <span className="text-ember">Byte {flipped + 1} was flipped on the way. </span>}
                You wrote <span className="tnum text-mist">{utf8Length(text)}</span> bytes. Sealed, it&apos;s{" "}
                <span className="tnum text-mist">{env ? fromB64u(env.ct).length : 272}</span>, one pattern per byte. Every note
                up to 252 bytes seals to the same 272, so the relay can&apos;t tell &ldquo;ok&rdquo; from a paragraph.
              </figcaption>
            </figure>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button onClick={openAsAda} disabled={!env}>
                Open as Ada
              </Button>
              <Button variant="quiet" onClick={tamper} disabled={!env}>
                {flipped === null ? "Tamper with it" : "Seal it again"}
              </Button>
            </div>
          </li>

          <li className="relative">
            <Mark className={opened ? (opened.ok ? "bg-mint" : "bg-ember") : "bg-faint"} />
            <h3 className="text-2xl">Ada opens</h3>
            <div aria-live="polite" className="mt-3">
              {opened === null ? (
                <p className="text-[15px] text-hush">Nothing opened yet.</p>
              ) : opened.ok ? (
                <>
                  <blockquote className="font-display text-[1.375rem] leading-snug break-words whitespace-pre-wrap text-mist italic">
                    {opened.text || "An empty note."}
                  </blockquote>
                  <p className="mt-3 text-[15px] text-mint">Opened with Ada&apos;s key. The seal also proves it came from yours.</p>
                </>
              ) : (
                <p className="text-[15px] text-ember">{opened.text}</p>
              )}
            </div>
          </li>
        </ol>
      </div>
    </section>
  );
}

/** The stage's dot on the note's path. */
function Mark({ className }: { className: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "absolute top-3 left-[calc(-1.5rem_-_5.5px)] h-2.5 w-2.5 rounded-full ring-4 ring-night transition-colors sm:left-[calc(-2.5rem_-_5.5px)]",
        className,
      )}
    />
  );
}

/** The sealed bytes as braille cells, one per byte, 16 to a row. A fresh seal shuffles in from the left. */
function SealedField({ ct, nonce, flipped }: { ct: string; nonce: string; flipped: number | null }) {
  const bytes = useMemo(() => fromB64u(ct), [ct]);
  const [frame, setFrame] = useState<{ ct: string; cells: Uint8Array; edge: number } | null>(null);
  const shownNonce = useRef(nonce);

  useEffect(() => {
    // Tampering keeps the nonce: no shuffle, only the flipped cell changes.
    if (shownNonce.current === nonce) return;
    shownNonce.current = nonce;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / 480);
      const edge = Math.floor(p * bytes.length);
      const cells = bytes.slice();
      for (let i = edge; i < cells.length; i++) cells[i] = Math.floor(Math.random() * 256);
      setFrame(p < 1 ? { ct, cells, edge } : null);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [nonce, ct, bytes]);

  const live = frame?.ct === ct ? frame : null;
  return (
    <>
      <p className="sr-only">The sealed note: {bytes.length} bytes that only Ada&apos;s key can open.</p>
      <div
        aria-hidden
        className="grid grid-cols-16 rounded-2xl border border-line bg-night-2 px-3 py-4 text-center text-[21px] leading-[1.15] select-none sm:px-5"
      >
        {Array.from(bytes, (b, i) => (
          <span
            key={i}
            className={live && i >= live.edge ? "text-faint" : i === flipped ? "rounded-sm bg-ember/20 text-ember" : "text-flame/85"}
          >
            {String.fromCharCode(0x2800 + (live ? live.cells[i] : b))}
          </span>
        ))}
      </div>
    </>
  );
}
