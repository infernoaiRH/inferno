<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Inferno project conventions

**Product.** Inferno: an AI inference network on Robinhood Chain (chain 4663, testnet 46630). Chat is the flagship: open models answer on your own GPU in the browser (private mode), on GPUs people lend, picked by wallet address (network mode, a beta over the relay in `src/lib/relay`), or on Bittensor subnet 64 through Chutes (`src/lib/bittensor`). Payment is Inferno credits (`src/lib/credits`: USDG transfers to the treasury, Postgres ledger: Neon on Vercel, PGlite locally, on only with `PAYMENTS_ENABLED=1`); lenders earn 70%, paid out by hand in USDG. "Mine" (`/lend`) has two lanes: serve from the browser, or the Bittensor mining guide. Sealed wallet-to-wallet messages are a secondary feature. Independent; not affiliated with Robinhood Markets. Spec: `docs/superpowers/specs/2026-09-24-inference-network-redesign.md`. Background research: `docs/research/opencomm-evaluation.md`.

**Stack.** Next.js 16.3 (App Router, Turbopack), React 19.2, TypeScript, Tailwind v4 (tokens in `src/app/globals.css` `@theme`), `motion` 13 (`motion/react`), `lucide-react`, `viem` 2.56 (`robinhood` from `viem/chains`), `@noble/*` v2 (ESM; import paths end in `.js`), `@mlc-ai/web-llm` 0.2.85, `react-markdown` + `remark-gfm`. Do not add dependencies without the lead.

**Theme "Thermal" (never raw hex in components).** Heat means compute: anything working (streaming tokens, busy GPUs, new blocks) glows along the ramp; idle stays cold. Surfaces `bg-night`, `bg-night-2`, `bg-night-3`; rules `border-line`, `border-line-bright`; text `text-mist` / `text-hush` / `text-faint`. Ramp `heat-1` (cold violet) `heat-2` (magenta) `heat-3` (red) `heat-4` (orange) `heat-5` (hot yellow). `flame` = primary actions and focus (orange; dark `text-night` on it). `mint` ok, `ember` error. Old names `moon`, `moon-deep`, `brass` are aliases (flame, heat-3, heat-5). Utilities: `.heat-text` (gradient text, one signature element per view), `.heat-fill` (ramp background), `.wide` / `.xwide` / `.narrow` (Anybody width axis), `.tnum`. Never put body text on heat-4 or heat-5 backgrounds.

**Type.** `font-display` = Anybody (variable: wdth 50 to 150, wght 100 to 900; headings default to wdth 118, weight 800). `font-sans` = Hanken Grotesk for body. Numbers use `.tnum`.

**Voice: say it out loud.** Plain, direct, self-explanatory, sentence case. Every section answers one question a newcomer has. Say what it is, what it costs, and what is live. No ALL-CAPS eyebrow labels, no middle-dot meta strings, no arrows appended to button text, no "uncensored", no token talk. Anything not live says so plainly ("demo", "estimate", "planned", "when payments are on").

**Motion.** Big and alive is fine here, but motion should mean something (heat = work). Always respect `prefers-reduced-motion` with a static fallback. Pause canvas/shader loops offscreen and in hidden tabs.

**Shared files (lead only).** `src/app/layout.tsx`, `src/app/(site)/layout.tsx`, `src/app/(app)/layout.tsx`, `src/app/globals.css`, `src/lib/{site,chain,cn,format,useMounted,useChainPulse}.ts`, `src/components/{site,wallet,brand,ui}/*`, `package.json`, `next.config.ts`. Reuse them; request changes instead of editing.

**React 19 lint.** `react-hooks` v6 rejects synchronous setState inside `useEffect` and ref reads during render. Use `useSyncExternalStore`, event handlers, or derived state.

**Verify.** `npx tsc --noEmit --incremental false` and `npx eslint <your paths>`. Parallel sessions must not run `next dev` or `next build` (shared `.next`).
