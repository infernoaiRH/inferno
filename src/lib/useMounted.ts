import { useSyncExternalStore } from "react";

const noop = () => () => {};

/** False during SSR and hydration, true afterwards. No effect, no extra render pass. */
export function useMounted(): boolean {
  return useSyncExternalStore(noop, () => true, () => false);
}
