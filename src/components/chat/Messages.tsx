"use client";

import { memo, useEffect, useRef, type ReactNode } from "react";
import { ChevronDown, ReceiptText } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatInt, formatUsd, shortAddress } from "@/lib/format";
import { USD_PER_1K_TOKENS } from "@/lib/relay/protocol";
import { TRUST, dollars } from "./BittensorPanel";
import { Trace, type Chunk } from "./Heat";
import { Markdown } from "./Markdown";
import type { Mode, Msg, Receipt } from "./store";

/** The answer being written: its streamed chunks, not saved yet. `ahead` is its place in a lender's queue. */
export type Draft = Msg & { chunks: Chunk[]; ahead?: number };

const STARTERS = [
  "Explain what a GPU does, in two sentences.",
  "Write a four-line poem about a graphics card running hot.",
  "Give me three quick dinner ideas with eggs and rice.",
];

/** Scrolls with the answer until the reader scrolls up; a new message of theirs brings it back. */
export function Messages({ messages, draft, children }: { messages: Msg[]; draft: Draft | null; children?: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const count = useRef(0);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    if (messages.length > count.current && messages.at(-1)?.role === "user") stick.current = true;
    count.current = messages.length;
    // An empty chat shows the model list; keep it at the top instead of jumping to its end.
    if (stick.current && (messages.length > 0 || draft)) el.scrollTop = el.scrollHeight;
  }, [messages, draft]);

  return (
    <div
      ref={box}
      onScroll={(e) => {
        const el = e.currentTarget;
        stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
      }}
      className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-9 px-4 py-6 sm:px-6 sm:py-10">
        {messages.map((m, i) => (
          <Message key={i} m={m} />
        ))}
        {draft && <Answer m={draft} chunks={draft.chunks} />}
        {children}
      </div>
    </div>
  );
}

const Message = memo(function Message({ m }: { m: Msg }) {
  if (m.role === "assistant") return <Answer m={m} />;
  return (
    <div className="max-w-[85%] self-end rounded-3xl bg-night-3 px-4 py-2.5 whitespace-pre-wrap break-words text-mist sm:max-w-[75%]">
      <span className="sr-only">You wrote: </span>
      {m.content}
    </div>
  );
});

/** Assistant text sits on the page as open prose: hot while it streams, Markdown once saved. */
function Answer({ m, chunks }: { m: Msg; chunks?: Chunk[] }) {
  return (
    <div>
      <p className="mb-2 text-sm text-faint">{m.model}</p>
      {!chunks ? (
        m.content && <Markdown text={m.content} />
      ) : chunks.length ? (
        <Trace chunks={chunks} />
      ) : (
        <span aria-hidden className="block h-4 w-2 animate-breathe rounded-sm bg-heat-5" />
      )}
      {m.stopped && <p className="mt-3 text-sm text-faint">Stopped before the end.</p>}
      {m.error && <p className="mt-3 text-sm text-ember">{m.error}</p>}
      <Meter hosts={m.hosts} live={!!chunks} mode={m.mode} pay={m.pay} />
      {m.receipt && <ReceiptCard model={m.model} r={m.receipt} node={m.node} pay={m.pay} />}
    </div>
  );
}

/**
 * The privacy meter. It reads the browser's resource timing for this page and the model worker,
 * so it can show that no request went out while the model answered, not what one would carry.
 * In network mode `hosts` leave out the relay, which this tab only sends sealed envelopes; in
 * Bittensor mode they leave out llm.chutes.ai and this site, the only places the prompt goes.
 */
function Meter({ hosts, live, mode, pay }: { hosts?: string[]; live: boolean; mode?: Msg["mode"]; pay?: Msg["pay"] }) {
  let dot = "bg-heat-4 animate-breathe";
  let text = "Watching for network requests while the model answers.";
  if (!live) {
    if (!hosts) return null;
    dot = hosts.length ? "bg-ember" : "bg-mint";
    text = hosts.length
      ? `Requests left this tab while the model answered: ${hosts.join(", ")}.`
      : mode === "bittensor"
        ? `Your prompt went only ${pay === "credits" ? "through Inferno's server " : ""}to llm.chutes.ai (Bittensor subnet 64).`
        : mode === "network"
          ? "Only sealed envelopes left this tab, to the Inferno relay."
          : "Nothing left this tab while the model answered.";
  }
  return (
    <p className={cn("mt-4 flex items-baseline gap-2 text-sm", live ? "text-heat-4" : "text-hush")}>
      <span aria-hidden className={cn("size-1.5 shrink-0 -translate-y-px rounded-full", dot)} />
      {text}
    </p>
  );
}

const tokens = (n: number) => `${formatInt(n)} ${n === 1 ? "token" : "tokens"}`;
const secs = (s: number) => (s < 1 ? `${Math.round(s * 1000)} ms` : `${s.toFixed(1)} s`);

/**
 * What the GPU did for one answer, as web-llm, the lender or Chutes measured it. Collapsed to one
 * line until opened. `node` is the lender's address when a lender's GPU wrote it; `pay` is set when
 * Bittensor subnet 64 wrote it.
 */
function ReceiptCard({ model, r, node, pay }: { model?: string; r: Receipt; node?: string; pay?: Msg["pay"] }) {
  // A stop before the second token leaves no speed to measure (saved as null by JSON).
  const speed = Number.isFinite(r.tps) ? `${r.tps.toFixed(1)} tokens/s` : null;
  const who = node && `${shortAddress(node)}'s GPU`;
  const usd = ((r.promptTokens + r.answerTokens) / 1000) * USD_PER_1K_TOKENS;
  // Stopped before Chutes sent its token counts, so they and the cost are estimates.
  const about = r.estimated ? "about " : "";
  const bill =
    pay === "credits"
      ? `Charged ${about}${dollars(r.usd ?? 0)} in Inferno credits`
      : `Billed to your Chutes account: ~${dollars(r.usd ?? 0)}`;
  const rows = pay
    ? [
        ["Served on", "Bittensor subnet 64 (Chutes), confidential compute"],
        ["Model", model],
        ...(r.requestId ? [["Request id", r.requestId]] : []),
        ["Prompt", `${about}${tokens(r.promptTokens)}`],
        ["Answer", `${about}${tokens(r.answerTokens)}`],
        ["Speed", speed ?? "Too short to measure"],
        ["Time to first token", secs(r.firstTokenS)],
        ["Total time", secs(r.totalS)],
        [
          "Cost",
          pay === "credits"
            ? `${bill}: Chutes' price plus our planned margin.`
            : `${bill}, at Chutes' listed price. A Chutes plan may cover it.`,
        ],
      ]
    : [
        ["Model", model],
        ...(who
          ? [
              ["Served by", `${who} (key verified)`],
              ["GPU", r.gpu || "Not named by the lender's browser"],
            ]
          : [["Where it ran", r.gpu ? `Your GPU: ${r.gpu}` : "Your GPU"]]),
        // web-llm counts only the part of the prompt it hadn't already read earlier in this chat.
        ["Prompt", `${formatInt(r.promptTokens)} new tokens`],
        ["Answer", tokens(r.answerTokens)],
        ["Speed", speed ?? "Too short to measure"],
        ["Time to first token", secs(r.firstTokenS)],
        ["Total time", secs(r.totalS)],
        ...(who
          ? [
              ["Cost", r.usd !== undefined ? `Charged ${dollars(r.usd)} in Inferno credits. The lender earns 70% of it.` : `Would cost ${formatUsd(usd, usd < 0.01 ? 4 : 2)} at launch pricing. Free during the beta.`],
              ["Privacy", "Sealed end to end: the relay only saw ciphertext."],
            ]
          : [["Cost", "Free. It ran on your device."]]),
      ];
  return (
    <details className="group mt-3 rounded-2xl border border-dashed border-line-bright text-sm">
      <summary className="flex cursor-pointer list-none items-center gap-2.5 rounded-2xl px-4 py-2.5 text-hush transition-colors hover:text-mist [&::-webkit-details-marker]:hidden">
        <ReceiptText size={15} aria-hidden className="shrink-0 text-faint" />
        <span className="tnum min-w-0 flex-1">
          {pay
            ? "Served on Bittensor subnet 64 (Chutes), confidential compute: "
            : who
              ? `Served by ${who} (key verified): `
              : "Your GPU wrote "}
          {about}
          {tokens(r.answerTokens)} in {secs(r.totalS)}
          {speed && ` at ${speed}`}. {pay ? `${bill}.` : who ? (r.usd !== undefined ? `Charged ${dollars(r.usd)} in credits.` : "Free during the beta.") : "Free."}
        </span>
        <ChevronDown size={15} aria-hidden className="shrink-0 transition-transform duration-300 group-open:rotate-180" />
      </summary>
      <dl className="tnum grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-1.5 border-t border-dashed border-line-bright px-4 py-3">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-faint">{k}</dt>
            <dd className="break-words text-mist">{v}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

/** What this is, how it works and something to try, above the model or lender list until a chat starts. */
export function EmptyState({ mode, ready, onPick }: { mode: Mode; ready: boolean; onPick: (text: string) => void }) {
  const network = mode === "network";
  return (
    <div className="animate-rise">
      <h2 className="wide text-4xl font-black sm:text-5xl">
        Ask anything.{" "}
        <span className="block">
          {network ? "It runs on a lender's GPU." : mode === "bittensor" ? "It runs on Bittensor." : "It runs on your GPU."}
        </span>
      </h2>
      {mode === "bittensor" ? (
        <p className="mt-5 max-w-xl text-hush">
          Open models answer from Bittensor subnet 64, run by Chutes. {TRUST} Pay with your own Chutes key, or with
          Inferno credits where this server takes them. Chats are saved only in this browser.
          {!ready && " Pick a model and a way to pay below to start."}
        </p>
      ) : network ? (
        <p className="mt-5 max-w-xl text-hush">
          Pick someone lending a GPU, from the list or by their wallet address. Each message is sealed in this tab so
          only their node can open it, and the answer comes back sealed to you. You don&apos;t need a wallet to ask
          during the beta, and chats are saved only in this browser.
          {!ready && " Pick a lender below to start."}
        </p>
      ) : (
        <p className="mt-5 max-w-xl text-hush">
          Your browser downloads an open model once, then your graphics card writes every answer inside this tab. What
          you type isn&apos;t sent anywhere, and chats are saved only in this browser.
          {!ready && " Pick a model below to start."}
        </p>
      )}
      <ul className="mt-8 grid gap-2 sm:grid-cols-3">
        {STARTERS.map((s) => (
          <li key={s}>
            <button
              type="button"
              onClick={() => onPick(s)}
              className="h-full w-full rounded-2xl border border-line bg-night-2/60 px-4 py-3 text-left text-[15px] text-hush transition-colors hover:border-flame/60 hover:text-mist"
            >
              {s}
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-6 max-w-xl text-sm text-faint">
        {mode === "bittensor"
          ? "Every answer comes with a receipt: the subnet and model that wrote it, Chutes' request id, how fast it was, and what it cost."
          : network
            ? "Every answer comes with a receipt: whose GPU wrote it, how fast, and what it cost."
            : "Every answer comes with a receipt: where it ran, how fast, and whether this tab made any network request while the model wrote. That check reads the browser's resource timing for this page and the model's worker, so it shows that nothing went out, not what a request would have carried."}
      </p>
    </div>
  );
}
