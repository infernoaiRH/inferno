# Redesign: an AI inference network, chat first

- **Date:** 2026-09-24
- **Ask:** make the chat the best, craziest feature. Tell the whole story: AI inference plus GPU lending. The site must be more presentable, with a better theme, loud, and self-explanatory. Use /21st:21st-ui.
- **Supersedes:** the "loud silence" direction written earlier the same day. A quiet brand contradicts "say it out loud".

## Positioning, said out loud

The one line: **"Chat with AI that runs on GPUs people lend. Lend yours and get paid in USDG on Robinhood Chain."**

In order of prominence:
1. **Chat** is the flagship.
2. **The inference network** is how answers get served.
3. **GPU lending** is how people earn.
4. Secondary: private mode (the model runs on your own GPU, works today) and sealed wallet-to-wallet messages.

**Honesty rule:** network inference and GPU lending open with testnet, and every element that isn't live says so. Private mode works today.

## Brand

- **Name: Inferno** (recommended). Inference plus heat: GPUs doing the work. Alternatives: keep Sotto, or Holler. Either way it's a one-line change in `src/lib/site.ts`. Check the domain and trademark before launch.
- **Theme "Thermal":** the inferno colormap, where heat means compute. Busy GPUs, streaming tokens and new blocks glow hot; idle stays cold violet.
  - Base `#0B0A10` (violet-black, not neutral). Surfaces `#14121C`, `#1D1A28`. Text `#F3F0FF` and `#A9A3C2`.
  - Thermal ramp, cold to hot: `#2A0B4F` → `#7A1E6E` → `#D2433E` → `#F7902B` → `#FCE78A`.
- **Type:**
  - Display: **Anybody**, a variable font with width 50–150 and weight 100–900. Headlines are loud and wide, and the width and weight animate as things heat up.
  - Body: Hanken Grotesk (kept). Tabular figures for every number.
- **Logo:** a flame built from three rising bars, like GPU utilisation or an equaliser, filled with the thermal ramp.
- **Voice:** plain and direct, sentence case. Say what it is and what it costs.

## Site map

- **`/` landing.** Every section answers one question.
  1. **Hero, "What is this?"** Headline "Chat with AI that runs on everyone's GPUs". A thermal shader field sits behind a live chat card that streams a clearly labelled demo answer with its inference receipt. CTAs: "Start chatting" and "Lend your GPU".
  2. **How it works:** three animated steps. You ask; a GPU answers (yours in private mode, a lender's on the network); payment settles on Robinhood Chain and the lender keeps 70% (planned).
  3. **Chat showcase:** heat trace, inference receipts, "where it ran", model choice, private vs network.
  4. **GPU lending:** "Your GPU could be earning". Links to the in-browser benchmark and the earnings estimate.
  5. **Live network:** the Robinhood Chain pulse (real), plus an operator globe marked illustrative until testnet.
  6. **Pricing:** pay per token, with a calculator.
  7. **Privacy and messages:** private mode plus sealed messages.
  8. **FAQ**, then the closing CTA.
- **`/chat`, the flagship.**
  - **Heat trace:** tokens stream in glowing hot, then cool to text colour. Faster generation burns hotter.
  - **Inference receipt** on every answer: model, where it ran (the WebGPU adapter name, e.g. "Apple M3 GPU"), tokens, tokens/s and cost. Private mode is free.
  - **Network mode** shows the operator path as "opens with testnet".
- **`/lend`, new.**
  - An in-browser WebGPU benchmark: a matmul GFLOPS run with no model download.
  - That gives estimated tokens/s per model size, then an estimated USDG per month from hours per day and the planned rates.
  - Requirements, and an honest operator waitlist state.
- **`/network`** and **`/messages`** are kept, re-themed.

## 21st.dev components (after restart; free tier allows 2 installs a day)

- **P1:** `ravikatiyar162/animated-shader-hero`, retuned to the thermal ramp, with uniforms time, pulse (from `onPulseBlock`) and pointer.
- **P2:** `easemize/ai-prompt-box`, the flagship chat composer, also used for the hero chat card.
- **Later, or hand-built from the catalog:**
  - `xubohuah/particle-text-effect` (hero headline)
  - `easemize/spotlight-card` (chat showcase)
  - `larsen66/sticky-scroll` (how it works)
  - `dev.yadhakim/interactive-globe` (network)
  - `easemize/dot-text` (live counters)
  - `jatin-yadav05/etheral-shadow` (closing CTA)

## Constraints

- **Must not break:** seal crypto (`node scripts/seal-check.ts`), the wallet layer, the web-llm engine, and the `useChainPulse` API.
- **Privacy:** /chat stays network-silent while the model answers.
- **Accessibility:** reduced motion gets a static fallback for every shader, particle and heat effect. Visible focus. Real text for screen readers. AA contrast on the thermal colours: text never sits on the hot yellow.
- **Performance:** hero under ~4 ms a frame; pause when offscreen or when the tab is hidden; lazy-load three/shader bundles.
- **Honest labels:** "demo", "opens with testnet", "illustrative", "planned".
- **QA gate:** tsc, eslint, `next build` and seal-check green. No horizontal overflow at 375 px. Browser pass at mobile and desktop.

## Next steps (after the key is set and Claude Code restarts)

1. `get_usage`, then `search` + `get_component` for P1 and P2, and read their real props.
2. Write `docs/superpowers/plans/2026-09-24-inference-network-redesign.md` against those APIs.
3. Execute with parallel subagents, split by theme+brand, landing, /chat, and /lend, then browser QA.
