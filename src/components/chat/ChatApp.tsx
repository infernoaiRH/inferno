"use client";

import { Suspense, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useSearchParams } from "next/navigation";
import { Cpu, Network, PanelLeft, Pickaxe } from "lucide-react";
import type { ChutesModel } from "@/lib/bittensor/chutes";
import { useChutes, useChutesKey, useCreditsEnabled, type ChutesBill, type Pay } from "@/lib/bittensor/client";
import { cn } from "@/lib/cn";
import { shortAddress } from "@/lib/format";
import {
  friendlyError,
  modelName,
  toPrompt,
  useLocalModel,
  useWebGPU,
  type Answer,
  type Gpu,
  type Status,
} from "@/lib/llm/engine";
import { LenderGone, useRemoteModel } from "@/lib/relay/asker";
import type { ListedNode } from "@/lib/relay/protocol";
import { BittensorPanel, TRUST } from "./BittensorPanel";
import { Composer } from "./Composer";
import { HeatMeter, type Chunk } from "./Heat";
import { LenderPanel } from "./LenderPanel";
import { EmptyState, Messages, type Draft } from "./Messages";
import { ModelPanel } from "./ModelPanel";
import { Rail } from "./Rail";
import { deleteChat, readChats, saveChat, useChats, type Chat, type Mode, type Msg } from "./store";

const NO_MESSAGES: Msg[] = [];
const labelHost = (host: string) => (host === location.host ? `${host} (this site)` : host);
// By id rather than a ref, so any composer can drop in with the same props.
const focusComposer = () => document.getElementById("composer")?.focus();

/**
 * `/chat?mode=bittensor` or `?mode=network` opens that mode; anything else opens private. The page is
 * prerendered without its query string, so, as Next's useSearchParams docs ask, the link is read under a
 * Suspense boundary: the prerendered HTML is the private chat, and the browser renders the linked one.
 */
export function ChatApp() {
  return (
    <Suspense fallback={<Chat linked="private" />}>
      <LinkedChat />
    </Suspense>
  );
}

function LinkedChat() {
  const m = useSearchParams().get("mode");
  return <Chat linked={m === "network" || m === "bittensor" ? m : "private"} />;
}

function Chat({ linked }: { linked: Mode }) {
  const chats = useChats();
  const gpu = useWebGPU();
  const llm = useLocalModel();
  const remote = useRemoteModel();
  const chutes = useChutes();
  const [mode, setMode] = useState<Mode>(linked); // private unless a link asked for another mode
  const [lender, setLender] = useState<ListedNode | null>(null);
  const [chute, setChute] = useState<ChutesModel | null>(null);
  const [pay, setPay] = useState<Pay>("key");
  const chutesKey = useChutesKey();
  const credits = useCreditsEnabled(mode === "bittensor");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState<(Draft & { chatId: string }) | null>(null);
  const [input, setInput] = useState("");
  const [changing, setChanging] = useState(false);
  const [storageFull, setStorageFull] = useState(false);
  const drawer = useRef<HTMLDialogElement>(null);

  const { status } = llm;
  const active = chats.find((c) => c.id === activeId) ?? null;
  const messages = active?.messages ?? NO_MESSAGES;
  const busy = draft !== null;
  // Credits only while this server takes them; the reader's own key always works.
  const payWith: Pay = credits ? pay : "key";
  const ready =
    mode === "network"
      ? lender !== null
      : mode === "bittensor"
        ? chute !== null && (payWith === "credits" || chutesKey !== "")
        : status.state === "ready";
  const name = status.state === "ready" || status.state === "loading" ? modelName(status.model) : "";
  const panelOpen = !ready || changing;
  const stop = mode === "network" ? remote.stop : mode === "bittensor" ? chutes.stop : llm.stop;

  const persist = (chat: Chat) => setStorageFull(!saveChat(chat));

  async function send() {
    const content = input.trim();
    const node = mode === "network" ? lender : null;
    const picked = mode === "bittensor" && ready ? chute : null;
    const local = mode === "private" && status.state === "ready" ? modelName(status.model) : null;
    const model = picked?.id ?? node?.modelName ?? local;
    if (!content || busy || model === null) return;
    const id = active?.id ?? crypto.randomUUID();
    const title = active?.title ?? content.replace(/\s+/g, " ").slice(0, 60);
    const turns: Msg[] = [...messages, { role: "user", content }];
    persist({ id, title, messages: turns });
    setActiveId(id);
    setInput("");
    setChanging(false); // no model or lender switch mid-answer; the chip stays disabled until it ends
    focusComposer();
    const pays = picked ? payWith : undefined;
    const base = { chatId: id, role: "assistant" as const, model, mode, pay: pays };
    setDraft({ ...base, content: "", chunks: [] });

    let text = "";
    const chunks: Chunk[] = [];
    const onDelta = (delta: string, tps: number) => {
      text += delta;
      chunks.push({ text: delta, tps });
      setDraft({ ...base, content: text, chunks: [...chunks] });
    };
    let reply: Msg;
    try {
      // A lender's answer names the GPU it ran on, a local one ran on this device's, and Chutes adds a bill.
      const answer: Answer & { gpu?: string; bill?: ChutesBill; error?: string } = picked
        ? await chutes.generate(picked, turns, payWith, onDelta)
        : node
          ? await remote.generate(id, node, turns, onDelta, (ahead) => setDraft((d) => d && { ...d, ahead }))
          : await llm.generate(toPrompt(turns), onDelta);
      reply = {
        role: "assistant",
        content: text,
        model,
        mode,
        pay: pays,
        node: node?.address,
        hosts: answer.hosts.map(labelHost),
        stopped: answer.stopped || undefined,
        error: answer.error,
        receipt: answer.stats && { ...answer.stats, gpu: answer.gpu ?? (gpu.state === "ok" ? gpu.name : ""), ...answer.bill },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Network and Bittensor errors are already written for people. A gone lender reopens the list to pick another.
      if (err instanceof LenderGone) setLender(null);
      reply = {
        role: "assistant",
        content: text,
        model,
        mode,
        pay: pays,
        node: node?.address,
        error: mode === "private" ? friendlyError(message) : message,
      };
    }
    // One render swaps the glowing draft for the saved Markdown answer, so it never shows twice.
    flushSync(() => {
      setDraft(null);
      // Deleted while the answer was being written: let it go.
      if (readChats().some((c) => c.id === id)) persist({ id, title, messages: [...turns, reply] });
    });
  }

  function remove(id: string) {
    if (!window.confirm("Delete this chat? It is saved only in this browser, so it can't be brought back.")) return;
    if (draft?.chatId === id) stop();
    setStorageFull(!deleteChat(id));
    if (activeId === id) setActiveId(null);
  }

  function load(id: string) {
    setChanging(false);
    llm.load(id);
  }

  const rail = {
    chats,
    activeId,
    storageFull,
    onSelect: (id: string) => {
      setActiveId(id);
      drawer.current?.close();
    },
    onNew: () => {
      setActiveId(null);
      drawer.current?.close();
      focusComposer();
    },
    onDelete: remove,
  };

  return (
    <div className="flex h-full">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-line bg-night-2/40 md:flex">
        <Rail {...rail} />
      </aside>
      {/* Mobile drawer: the native dialog brings focus trapping, Escape and an inert page behind it. */}
      <dialog
        ref={drawer}
        onClick={(e) => e.target === e.currentTarget && e.currentTarget.close()}
        className="m-0 h-dvh max-h-none w-80 max-w-[85vw] border-r border-line bg-night-2 p-0 text-mist backdrop:bg-night/70"
      >
        <div className="flex h-full flex-col">
          <Rail {...rail} onClose={() => drawer.current?.close()} />
        </div>
      </dialog>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2.5 sm:px-5">
          <button
            type="button"
            onClick={() => drawer.current?.showModal()}
            aria-label="Show saved chats"
            className="rounded-full p-2 text-hush hover:text-mist md:hidden"
          >
            <PanelLeft size={18} />
          </button>
          <ModeSwitch
            mode={mode}
            disabled={busy}
            onChange={(m) => {
              setMode(m);
              setChanging(false);
            }}
            className="order-last w-full sm:order-none sm:w-auto"
          />
          <ModelChip
            {...(mode === "network"
              ? lenderChip(lender, busy)
              : mode === "bittensor"
                ? chuteChip(chute, ready, busy)
                : modelChip(gpu, status, name, busy))}
            busy={busy}
            open={panelOpen}
            onToggle={() => setChanging((c) => !c)}
          />
          {mode === "bittensor" && <p className="order-last w-full px-1 text-sm text-hush">{TRUST}</p>}
        </div>

        <Messages key={activeId ?? "new"} messages={messages} draft={draft?.chatId === activeId ? draft : null}>
          {messages.length === 0 && (
            <EmptyState
              mode={mode}
              ready={ready}
              onPick={(text) => {
                setInput(text);
                focusComposer();
              }}
            />
          )}
          {panelOpen &&
            (mode === "network" ? (
              <LenderPanel
                picked={lender?.key}
                onPick={(n) => {
                  setLender(n);
                  setChanging(false);
                  focusComposer();
                }}
                onClose={ready ? () => setChanging(false) : undefined}
              />
            ) : mode === "bittensor" ? (
              <BittensorPanel
                picked={chute?.id}
                onPick={(m) => {
                  setChute(m);
                  setChanging(false);
                  // Without a way to pay yet, the panel stays open for the key.
                  if (payWith === "credits" || chutesKey) focusComposer();
                }}
                pay={payWith}
                onPay={setPay}
                credits={credits}
                onClose={ready ? () => setChanging(false) : undefined}
              />
            ) : (
              <ModelPanel gpu={gpu} status={status} onLoad={load} onClose={ready ? () => setChanging(false) : undefined} />
            ))}
        </Messages>

        <div className="shrink-0 border-t border-line px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
          <div className="mx-auto max-w-3xl">
            <Composer
              value={input}
              onChange={setInput}
              onSend={send}
              onStop={stop}
              busy={busy}
              disabled={!ready}
              placeholder={
                ready
                  ? "Ask anything"
                  : mode === "network"
                    ? "Pick a lender to start"
                    : mode === "bittensor"
                      ? chute
                        ? "Add your Chutes key to start"
                        : "Pick a model to start"
                      : gpu.state === "missing"
                      ? "Private mode needs WebGPU in this browser"
                      : "Load a model to start"
              }
            />
            {/* The hint's row turns into the heat meter while an answer is written, so nothing shifts. */}
            <div className="mt-2 flex h-5 items-center px-3 text-xs">
              {draft ? (
                <HeatMeter tps={draft.chunks.at(-1)?.tps ?? 0} ahead={draft.ahead} />
              ) : (
                <p className="text-faint">Enter sends. Shift and Enter adds a line.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const MODES = [
  { mode: "private", Icon: Cpu, name: "Private", more: "on this device" },
  { mode: "network", Icon: Network, name: "Network", more: "GPUs people lend", tag: "Beta" },
  { mode: "bittensor", Icon: Pickaxe, name: "Bittensor", more: "sealed miners", tag: "SN64" },
] as const;

type SwitchProps = { mode: Mode; disabled: boolean; onChange: (mode: Mode) => void; className?: string };

/**
 * Private runs on this device and is the default. Network seals each prompt to a lender's GPU (beta).
 * Bittensor asks subnet 64's confidential-compute miners through Chutes. Icons show from sm up, so
 * all three fit a 360 px phone.
 */
function ModeSwitch({ mode, disabled, onChange, className }: SwitchProps) {
  return (
    <div role="group" aria-label="Where answers run" className={cn("flex rounded-full border border-line p-1 text-sm", className)}>
      {MODES.map((o) => (
        <button
          key={o.mode}
          type="button"
          aria-pressed={o.mode === mode}
          disabled={disabled}
          onClick={() => onChange(o.mode)}
          title={o.mode === "bittensor" ? TRUST : undefined}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-full px-2 py-1.5 transition-colors sm:flex-none sm:gap-2 sm:px-3",
            o.mode === mode ? "bg-night-3 text-mist" : "text-hush enabled:hover:text-mist disabled:text-faint",
          )}
        >
          <o.Icon size={15} aria-hidden className={cn("hidden shrink-0 sm:block", o.mode === mode && "text-flame")} />
          <span>
            {o.name}
            <span className="sr-only xl:not-sr-only">: {o.more}</span>
          </span>
          {"tag" in o && <span className="rounded-full border border-line px-1.5 py-0.5 text-xs sm:px-2">{o.tag}</span>}
        </button>
      ))}
    </div>
  );
}

type ChipProps = { label: string; dot: string; ready: boolean; change: string; busy: boolean; open: boolean; onToggle: () => void };

function ModelChip({ label, dot, ready, change, busy, open, onToggle }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={!ready || busy}
      aria-expanded={ready ? open : undefined}
      aria-label={ready && !busy ? `${label}. ${change}` : undefined}
      className="ml-auto flex min-w-0 items-center gap-2 rounded-full border border-line px-3 py-1.5 text-sm text-hush transition-colors enabled:hover:border-line-bright enabled:hover:text-mist"
    >
      <span aria-hidden className={cn("size-2 shrink-0 rounded-full", dot)} />
      <span className="truncate">{label}</span>
    </button>
  );
}

const WRITING = "bg-heat-4 animate-breathe";

/** Private mode: the model on this device. */
function modelChip(gpu: Gpu, status: Status, name: string, busy: boolean) {
  const ready = status.state === "ready";
  const label =
    gpu.state === "missing"
      ? "WebGPU unavailable"
      : status.state === "loading"
        ? `Loading ${name}`
        : ready
          ? busy
            ? `${name} is writing`
            : name
          : status.state === "error"
            ? "The model didn't load"
            : "No model loaded";
  const dot =
    status.state === "loading" || busy
      ? WRITING
      : ready
        ? "bg-mint"
        : status.state === "error" || gpu.state === "missing"
          ? "bg-ember"
          : "bg-faint";
  return { label, dot, ready, change: "Change model" };
}

/** Network mode: the lender whose GPU answers. */
function lenderChip(node: ListedNode | null, busy: boolean) {
  const label = node ? `${node.modelName} on ${shortAddress(node.address)}` : "No lender picked";
  return {
    label: node && busy ? `${label} is writing` : label,
    dot: busy ? WRITING : node ? "bg-mint" : "bg-faint",
    ready: node !== null,
    change: "Change lender",
  };
}

/** Bittensor mode: the Chutes model that answers. Ready once there is also a way to pay. */
function chuteChip(model: ChutesModel | null, ready: boolean, busy: boolean) {
  const label = model ? `${model.name} on Bittensor` : "No model picked";
  return {
    label: busy ? `${label} is writing` : label,
    dot: busy ? WRITING : ready ? "bg-mint" : "bg-faint",
    ready,
    change: "Change model or payment",
  };
}
