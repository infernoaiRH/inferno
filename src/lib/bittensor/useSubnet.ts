import { useEffect, useState } from "react";
import type { ChutesModel } from "./chutes";

type Reply = { models: ChutesModel[] | null; credits: boolean };

export type Subnet = Reply & {
  /** True until /api/bittensor/models answers. `models` stays null after that if Chutes was down. */
  loading: boolean;
};

let request: Promise<Reply> | undefined;
/** The last good reply, so coming back to a page doesn't flash the loading state. */
let last: Reply | undefined;

/**
 * Subnet 64's live sealed models and whether Inferno credits pay for them, fetched once per tab and
 * shared. A failed fetch is retried on the next mount instead of sticking for the tab's life.
 */
export function useSubnet(): Subnet {
  // `last` is unset during hydration, so server and client render the same loading state.
  const [reply, setReply] = useState<Reply | null>(last ?? null);
  useEffect(() => {
    let live = true;
    request ??= fetch("/api/bittensor/models")
      .then((r) => (r.ok ? (r.json() as Promise<Reply>) : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(
        (r) => (last = r),
        () => {
          request = undefined;
          return { models: null, credits: false };
        },
      );
    request.then((r) => live && setReply(r));
    return () => {
      live = false;
    };
  }, []);
  return { models: reply?.models ?? null, credits: reply?.credits ?? false, loading: reply === null };
}
