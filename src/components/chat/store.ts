import { useSyncExternalStore } from "react";
import type { ChutesBill, Pay } from "@/lib/bittensor/client";
import type { Stats } from "@/lib/llm/engine";

/** What one answer cost the GPU. `gpu` is the adapter name, "" when the browser shares none. Bittensor adds its bill. */
export type Receipt = Stats & { gpu: string } & Partial<ChutesBill>;

/** Where answers run: this device, a lender's GPU through the relay, or Bittensor subnet 64 (Chutes). */
export type Mode = "private" | "network" | "bittensor";

export type Msg = {
  role: "user" | "assistant";
  content: string;
  /** Display name of the model that wrote an answer (Chutes' model id in Bittensor mode). */
  model?: string;
  mode?: Mode;
  /** Bittensor mode: paid with the reader's own Chutes key, or with Inferno credits. */
  pay?: Pay;
  /** Network mode: the lender's wallet address. Its node key was verified before anything was sent. */
  node?: string;
  /** Privacy meter: hosts this tab requested while the answer was written. */
  hosts?: string[];
  stopped?: boolean;
  error?: string;
  receipt?: Receipt;
};

export type Chat = { id: string; title: string; messages: Msg[] };

const KEY = "inferno.chats";
const EMPTY: Chat[] = [];
const listeners = new Set<() => void>();
let cache: Chat[] | undefined;

/** Chats live only in this browser's localStorage, newest first. */
export function readChats(): Chat[] {
  if (!cache) {
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
      cache = Array.isArray(parsed) ? parsed.filter((c) => typeof c?.id === "string" && Array.isArray(c.messages)) : [];
    } catch {
      cache = [];
    }
  }
  return cache;
}

/** Returns false when the browser refuses to store it (full or blocked); it stays in memory for this visit. */
function write(next: Chat[]): boolean {
  cache = next;
  listeners.forEach((l) => l());
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
    return true;
  } catch {
    return false;
  }
}

export const saveChat = (chat: Chat) => write([chat, ...readChats().filter((c) => c.id !== chat.id)]);
export const deleteChat = (id: string) => write(readChats().filter((c) => c.id !== id));

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Another tab changed them.
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY && e.key !== null) return;
    cache = undefined;
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export const useChats = () => useSyncExternalStore(subscribe, readChats, () => EMPTY);
