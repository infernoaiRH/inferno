"use client";

import { memo, useRef, useState, type ComponentProps } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Copy } from "lucide-react";

const plugins = [remarkGfm];

const prose = [
  "text-[16.5px] leading-[1.75] text-mist/90 break-words",
  "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
  "[&_p]:my-3 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1 [&_li]:pl-1 [&_li::marker]:text-faint",
  "[&_h1]:mt-7 [&_h1]:mb-3 [&_h1]:text-2xl [&_h2]:mt-7 [&_h2]:mb-3 [&_h2]:text-xl [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:text-lg [&_h4]:mt-5 [&_h4]:mb-2",
  "[&_strong]:font-semibold [&_strong]:text-mist",
  "[&_blockquote]:my-4 [&_blockquote]:border-l-2 [&_blockquote]:border-line-bright [&_blockquote]:pl-4 [&_blockquote]:text-hush",
  "[&_hr]:my-8 [&_hr]:border-line",
  "[&_:not(pre)>code]:rounded-md [&_:not(pre)>code]:bg-night-3 [&_:not(pre)>code]:px-1.5 [&_:not(pre)>code]:py-0.5 [&_:not(pre)>code]:text-[0.88em]",
  "[&_table]:w-full [&_table]:text-[15px] [&_th]:border-b [&_th]:border-line-bright [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-medium [&_td]:border-b [&_td]:border-line [&_td]:px-3 [&_td]:py-2",
].join(" ");

function CodeBlock({ children }: ComponentProps<"pre">) {
  const pre = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);

  function copy() {
    void navigator.clipboard?.writeText(pre.current?.textContent ?? "").then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      },
      () => {},
    );
  }

  return (
    <div className="relative my-4">
      <pre
        ref={pre}
        className="overflow-x-auto rounded-2xl border border-line bg-night-2 px-4 pt-11 pb-4 font-mono text-[13.5px] leading-relaxed text-mist sm:pt-4 sm:pr-24"
      >
        {children}
      </pre>
      <button
        type="button"
        onClick={copy}
        className="absolute top-2 right-2 flex items-center gap-1.5 rounded-full border border-line bg-night px-2.5 py-1 text-xs text-hush transition-colors hover:border-line-bright hover:text-mist"
      >
        {copied ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

const components: Components = {
  // Only web links, always in a new tab.
  a: ({ href, children }) =>
    href && /^https?:\/\//i.test(href) ? (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="text-flame underline decoration-flame/40 underline-offset-4 hover:decoration-flame"
      >
        {children}
      </a>
    ) : (
      <span>{children}</span>
    ),
  // Never fetch an image the model names: that would be a request leaving the tab.
  img: ({ alt }) => <span className="text-faint">[{alt || "image"}]</span>,
  pre: CodeBlock,
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto">
      <table>{children}</table>
    </div>
  ),
};

/** Model output as Markdown. Raw HTML is dropped (no rehype-raw), so nothing is injected. */
export const Markdown = memo(function Markdown({ text }: { text: string }) {
  return (
    <div className={prose}>
      <ReactMarkdown remarkPlugins={plugins} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  );
});
