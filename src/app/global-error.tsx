"use client";

import "./globals.css";
import { ErrorState } from "@/components/site/ErrorState";

/** Last-resort boundary for errors in the root layout. It renders its own document. */
export default function GlobalError(props: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en">
      <body className="min-h-dvh">
        <title>Something went wrong | Inferno</title>
        <ErrorState {...props} />
      </body>
    </html>
  );
}
