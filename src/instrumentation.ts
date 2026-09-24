/** Runs once when a Next.js server instance starts (not during `next build`): logs the payment settings. Starts no loops. */
export async function register() {
  // The documented runtime guard, so edge bundles drop the Node-only import.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const { startCredits } = await import("./lib/credits/indexer");
      startCredits();
    } catch (e) {
      // A throw here would stop the server from starting; credits stay off instead.
      console.error("[credits] Couldn't check the payment settings:", e instanceof Error ? e.message : e);
    }
  }
}
