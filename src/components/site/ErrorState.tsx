"use client";

import Link from "next/link";
import { useEffect } from "react";
import { buttonClass } from "@/components/ui/Button";

/** Shared fallback for the route error boundaries. */
export function ErrorState({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col justify-center px-5 py-24 sm:px-8">
      <h1 className="text-[clamp(2.5rem,6vw,4rem)] leading-[1.02]">Something on this page broke.</h1>
      <p className="mt-5 max-w-[52ch] text-lg text-hush">
        Something on this page stopped working. Try it again. If it keeps happening, reload the page or go back home.
      </p>
      {error.digest ? <p className="tnum mt-3 text-[13px] text-faint">Reference {error.digest}</p> : null}
      <div className="mt-10 flex flex-wrap gap-3">
        <button onClick={() => retry()} className={buttonClass({ size: "lg" })}>
          Try again
        </button>
        <Link href="/" className={buttonClass({ size: "lg", variant: "quiet" })}>
          Go home
        </Link>
      </div>
    </div>
  );
}
