import type { ReactNode } from "react";

/** Term and detail rows between hairlines: the page's plain-facts list. */
export function Rules({ rows }: { rows: { term: string; detail: ReactNode }[] }) {
  return (
    <dl className="border-b border-line">
      {rows.map((r) => (
        <div key={r.term} className="grid gap-x-8 gap-y-1 border-t border-line py-5 sm:grid-cols-[13rem_minmax(0,1fr)]">
          <dt>{r.term}</dt>
          <dd className="text-hush">{r.detail}</dd>
        </div>
      ))}
    </dl>
  );
}
