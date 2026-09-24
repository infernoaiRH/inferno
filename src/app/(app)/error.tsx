"use client";

import { ErrorState } from "@/components/site/ErrorState";

export default function AppError(props: { error: Error & { digest?: string }; retry: () => void }) {
  return <ErrorState {...props} />;
}
