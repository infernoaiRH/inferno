"use client";

import { HardDrive, Plus, Trash, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import type { Chat } from "./store";

type Props = {
  chats: Chat[];
  activeId: string | null;
  storageFull: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  /** Set when the rail sits in the mobile drawer. */
  onClose?: () => void;
};

export function Rail({ chats, activeId, storageFull, onSelect, onNew, onDelete, onClose }: Props) {
  return (
    <div className="flex min-h-0 flex-1 flex-col p-3">
      <div className="flex items-center justify-between gap-2 px-2 pt-1 pb-3">
        <h2 className="text-lg">Chats</h2>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close saved chats"
            className="flex h-10 w-10 items-center justify-center rounded-full text-hush hover:text-mist"
          >
            <X size={18} />
          </button>
        )}
      </div>
      <Button variant="quiet" onClick={onNew} className="w-full">
        <Plus size={16} aria-hidden />
        New chat
      </Button>

      <nav aria-label="Saved chats" className="-mx-1 mt-3 min-h-0 flex-1 overflow-y-auto px-1">
        {chats.length === 0 ? (
          <p className="px-2 py-3 text-sm text-faint">No saved chats yet.</p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {chats.map((c) => (
              <li key={c.id} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onSelect(c.id)}
                  aria-current={c.id === activeId ? "true" : undefined}
                  className={cn(
                    "min-w-0 flex-1 truncate rounded-xl px-3 py-2 text-left text-[15px] transition-colors",
                    c.id === activeId ? "bg-night-3 text-mist" : "text-hush hover:bg-night-3/50 hover:text-mist",
                  )}
                >
                  {c.title}
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(c.id)}
                  aria-label={`Delete chat: ${c.title}`}
                  className="shrink-0 rounded-full p-2 text-faint transition-colors hover:text-ember"
                >
                  <Trash size={15} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </nav>

      <div className="mt-3 border-t border-line px-2 pt-3 text-sm">
        <p className="flex items-center gap-2 text-hush">
          <HardDrive size={15} aria-hidden className="shrink-0" />
          Saved in this browser only
        </p>
        <p className={cn("mt-1", storageFull ? "text-ember" : "text-faint")}>
          {storageFull
            ? "This browser's storage is full, so new messages aren't being saved. Delete old chats to make room."
            : "Clearing this site's data erases them."}
        </p>
      </div>
    </div>
  );
}
