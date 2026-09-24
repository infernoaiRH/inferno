# Inferno

**Chat with AI that runs on GPUs people lend.** Inferno is an AI inference network on [Robinhood Chain](https://docs.robinhood.com/chain). Ask anything and a GPU answers: yours, right in the browser, or one lent by someone else. Lenders get paid in USDG for every token.

Inferno is independent and is not affiliated with Robinhood Markets, Inc.

## What's here

| Route | What it does | Status |
|---|---|---|
| `/` | Landing page: what Inferno is, how it works, the chat, Bittensor (live subnet 64 models and prices), mining with your GPU (two lanes), live chain data, pricing, privacy, FAQ | Live chain data and Chutes prices; demo chat card is labelled |
| `/chat` | The flagship, in three modes: private (your GPU through WebGPU, `@mlc-ai/web-llm`), network (a lender's GPU picked by wallet address, over the relay) and Bittensor (Chutes subnet 64, confidential compute). A heat trace while they answer and a receipt for every answer. `?mode=network` or `?mode=bittensor` opens a mode directly | Private works in WebGPU browsers; network is a beta, paid with credits when payments are on; Bittensor needs your own Chutes key or credits |
| `/lend` (and `/mine`) | Mine with your GPU: test it (memory-bandwidth benchmark, no download), estimate earnings, serve a model from your browser under your wallet address (`#serve`), or follow the Bittensor subnet 64 mining guide (`#mine-bittensor`) | Serving is a live beta; lenders earn 70% in the ledger, paid out by hand in USDG |
| `/credits` | Sign in with your wallet (SIWE), see your balance, top up by sending USDG to the treasury | Live when `PAYMENTS_ENABLED=1` |
| `/network` | Live Robinhood Chain monitor: blocks, tx/s, base fee, finality, Chainlink ETH/USD, USDG supply | Live data |
| `/messages` | Sealed wallet-to-wallet messages: X25519 + XChaCha20-Poly1305, sender authentication, wallet-signed keys, safety numbers | In-browser demo relay |

Network inference runs as a beta: lenders' browsers announce a wallet-signed node key, askers seal each prompt to that key, and the relay (`/api/relay/*`: Redis on Vercel, or one server's memory) forwards only ciphertext. The lender's GPU reads prompts in memory to answer them; their node page never shows or stores them, but only confidential-computing hardware could fully hide prompts from a lender. Payments are credits, not a contract: an ERC-20 transfer to `TREASURY_ADDRESS` is credited once finalized, answers are charged from a Postgres ledger (Neon on Vercel, PGlite locally), and lender payouts are exported as CSV and sent by hand (see `docs/deploy.md`). Design spec: `docs/superpowers/specs/2026-09-24-inference-network-redesign.md`. Research notes are in `docs/research/` (kept out of git by default).

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000. Node 22+.

```bash
npm run build && npm start   # production
npx tsc --noEmit             # types
npx eslint src               # lint
node scripts/seal-check.ts   # messaging crypto self-check
node scripts/lend-check.ts   # lending estimate self-check
node scripts/relay-check.ts  # relay routing and node-key binding self-check
node scripts/credits-check.ts   # ledger, holds, caps, indexer, cookie and SIWE
node src/lib/bittensor/check.ts # Chutes pricing and stream parsing
```

## Configuration

Copy `.env.example` to `.env.local`. Everything is optional.

| Variable | Default | Purpose |
|---|---|---|
| `NEXT_PUBLIC_CHAIN` | `mainnet` | `testnet` switches to Robinhood Chain testnet (46630) |
| `NEXT_PUBLIC_RPC_URL` | public Robinhood RPC | The public RPC is rate-limited. Use Alchemy or QuickNode for real traffic. |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` | Absolute URL for metadata and OG images |

## Logo

The default mark is an original dragon drawn in SVG (`src/components/brand/Logo.tsx`, `src/app/icon.svg`, `src/app/opengraph-image.tsx`). To use other artwork you have the rights to, put it at `public/brand/logo.png`, set `NEXT_PUBLIC_LOGO_SRC=/brand/logo.png` in `.env.local`, and rebuild. Replace `src/app/icon.svg` with an `icon.png` for the favicon.

## Stack and design

Next.js 16 (App Router, Turbopack), React 19, Tailwind CSS v4, TypeScript, `motion`, `viem` (chain `robinhood`), `@noble/*` crypto, `@mlc-ai/web-llm`. Wallets connect through EIP-6963 without wagmi.

The theme is "Thermal": heat means compute. Anything working (streaming tokens, busy GPUs, new blocks) glows along the inferno colour ramp. Tokens live in `src/app/globals.css`; brand name and navigation in `src/lib/site.ts` (renaming is a one-line change). Conventions for contributors and coding agents are in `AGENTS.md`.

## Robinhood Chain facts used

- Mainnet chain id 4663 (live since 2026-07-01), testnet 46630, ETH gas, blocks about every 0.1 s, settles to Ethereum.
- USDG `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168` (6 decimals). There is no trustworthy USDT on the chain.
- Chainlink ETH/USD `0x78F3556b67E17Df817D51Ef5a990cDaF09E8d3A9`.
- Credit deposits only once the `finalized` block tag reaches them (about 15 to 20 minutes).
