"use client";

import { Square } from "lucide-react";
import { Button } from "@/components/ui/Button";

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  /** An answer is being written: Stop takes Send's place. */
  busy: boolean;
  /** Sending is off, for example before a model loads. Typing stays open. */
  disabled: boolean;
  placeholder: string;
};

/**
 * Enter sends, Shift+Enter adds a line. Only these props, so a prompt box component can drop in;
 * the page focuses the textarea by its id, "composer".
 */
export function Composer({ value, onChange, onSend, onStop, busy, disabled, placeholder }: Props) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSend();
      }}
      className="flex items-end gap-2 rounded-3xl border border-line bg-night-2 p-1.5 transition-colors focus-within:border-flame/70 focus-within:ring-2 focus-within:ring-flame/20"
    >
      <label htmlFor="composer" className="sr-only">
        Message
      </label>
      <textarea
        id="composer"
        rows={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
          e.preventDefault();
          onSend();
        }}
        enterKeyHint="send"
        placeholder={placeholder}
        className="field-sizing-content max-h-48 min-h-10 min-w-0 flex-1 resize-none bg-transparent px-3 py-2 text-mist placeholder:text-faint focus:outline-none"
      />
      {busy ? (
        <Button type="button" variant="quiet" onClick={onStop}>
          <Square size={13} aria-hidden className="fill-current" />
          Stop
        </Button>
      ) : (
        <Button type="submit" disabled={disabled || !value.trim()}>
          Send
        </Button>
      )}
    </form>
  );
}
