# Bittensor Branding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Bittensor the first thing a visitor reads and sees across Inferno ("Powered by Bittensor"), with live proof from subnet 64, and leave every page right on phones.

**Architecture:** One server endpoint (`GET /api/bittensor/models`) reads Chutes' sealed-model list (cached, CDN 5 min) and whether Inferno credits pay for Bittensor; a shared client hook (`useSubnet`) feeds the hero badge, a new live strip and the Bittensor section, so visitors' browsers never contact Chutes to render the site. A drawn τ mark (`Tau`) tags everything that runs on Bittensor. Private mode stays the chat default.

**Tech Stack:** Next.js 16.3 App Router, React 19.2, Tailwind v4 tokens (Thermal theme), lucide-react. No new dependencies.

**Spec:** Agreed in chat on 2026-09-26 (Q1 option a plus more branding, Q2 live count through our server, Q3 footer/chat/share image/lend plus landing, Q4 τ in our styling, Q5 fix the mobile audit). Product background: `docs/superpowers/specs/2026-09-24-inference-network-redesign.md`.

## Global Constraints

- Theme tokens only, never raw hex in components: `bg-night`, `bg-night-2`, `bg-night-3`, `border-line`, `border-line-bright`, `text-mist`, `text-hush`, `text-faint`, `heat-1`..`heat-5`, `flame`, `mint`, `ember`. `.heat-text` is one signature element per view; `.tnum` for numbers.
- Voice: plain, sentence case, says what is live. No ALL-CAPS eyebrow labels, no middle-dot meta strings, no arrows appended to button text, no "uncensored", no token (coin) promotion.
- Motion means work. Respect `prefers-reduced-motion` with a static fallback. Pause loops offscreen and in hidden tabs.
- React 19 lint: no synchronous setState inside `useEffect`, no ref reads during render.
- Lead-only files (do not edit; ask the lead): `src/app/layout.tsx`, `src/app/(site)/layout.tsx`, `src/app/(app)/layout.tsx`, `src/app/globals.css`, `src/lib/{site,chain,cn,format,useMounted,useChainPulse}.ts`, `src/components/{site,wallet,brand,ui}/*`, `package.json`, `next.config.ts`.
- Phones: no horizontal page overflow at 360 px; tap targets at least 40 x 40 px.
- Bittensor facts to keep straight: Bittensor is a decentralized network whose miners compete to serve AI and are paid in TAO. Inferno uses subnet 64, run by Chutes, and lists only its confidential-compute models ("sealed hardware": the miner can't read prompts). Paying with your own Chutes key is live. Paying with Inferno credits is live only when `useSubnet().credits` is true; otherwise say "when payments are on".
- Verify with `npx tsc --noEmit --incremental false` and `npx eslint <your paths>`. Never run `next dev` or `next build` (shared `.next`). Do not commit; the lead commits once.

## Foundation (done by the lead)

- `Tau` from `@/components/brand/Tau`: `<Tau className="text-heat-4" />` is an em-sized SVG τ coloured by `currentColor`, `aria-hidden`.
- `useSubnet()` from `@/lib/bittensor/useSubnet` returns `{ models: ChutesModel[] | null; credits: boolean; loading: boolean }`. `ChutesModel` is `{ id, name, context, input, output }` from `@/lib/bittensor/chutes`, prices in USD per million tokens. One shared request per tab.
- `GET /api/bittensor/models` returns `{ models, credits }` (12 sealed models on 2026-09-26).

---

### Task 1: Landing top (hero, live strip, demo chat, section order)

**Files:**
- Modify: `src/components/landing/Hero.tsx`
- Create: `src/components/landing/SubnetStrip.tsx`
- Modify: `src/components/landing/DemoChat.tsx` (`SCRIPT` at line 10 and the receipt row)
- Modify: `src/app/(site)/page.tsx`

**Interfaces:**
- Consumes: `useSubnet`, `Tau`, `formatUsd` from `@/lib/format`, `ButtonLink` from `@/components/ui/Button`.
- Produces: `export function SubnetStrip()` (client component, no props).

- [ ] **Step 1: Hero badge.** Above the `h1`, a link to `#bittensor`, pill-shaped (`inline-flex items-center gap-2 rounded-full border border-heat-2/50 bg-night-2/60 px-3.5 py-1.5 text-[15px] text-hush hover:text-mist`, at least 40 px tall): a dot (`animate-breathe bg-heat-5` once models loaded, `bg-faint` otherwise), `<Tau className="text-heat-4" />`, then text. Loading: "Powered by Bittensor". Loaded with n > 0: "Powered by Bittensor: n sealed models live on subnet 64" where " sealed" and " on subnet 64" are `hidden sm:inline`, so phones read "Powered by Bittensor: n models live". Models null or empty: "Powered by Bittensor subnet 64". One line at 360 px.
- [ ] **Step 2: Hero copy and buttons.**

```tsx
<h1 id="hero-title" className="wide mt-6 text-[clamp(2.5rem,5.4vw,4.75rem)] leading-[0.92] font-black tracking-[-0.02em]">
  Chat with AI on <span className="heat-text">Bittensor</span> and GPUs people lend.
</h1>
<p className="mt-8 max-w-[60ch] text-lg text-hush sm:text-xl">
  Ask anything. Miners on Bittensor subnet 64 answer inside sealed hardware, so they can&apos;t read your words. Or
  pick a GPU someone lends, or your own GPU in private mode. Pay with credits on Robinhood Chain.
</p>
```

Buttons: primary `<ButtonLink href="/chat?mode=bittensor" size="lg">` with `<Tau />` then "Chat on Bittensor"; quiet `<ButtonLink href="/lend" size="lg" variant="quiet">Mine with your GPU</ButtonLink>`. Check that `ButtonLink` lays an icon and text out in a row (read `src/components/ui/Button.tsx`); if not, wrap them in an `inline-flex items-center gap-2` span.
- [ ] **Step 3: `SubnetStrip`.** A full-width band (`border-y border-line bg-night-2/40`), content in `mx-auto max-w-7xl px-5 sm:px-8 py-5`, `flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-8`. Left label (no shrink): `<Tau className="text-heat-4" />` plus "Live on Bittensor subnet 64" (`text-[15px] text-mist`). Right: a marquee of models, each `<span className="whitespace-nowrap"><span className="text-mist">{m.name}</span> <span className="tnum text-hush">{perMillion(m.input)} in, {perMillion(m.output)} out</span></span>`, separated by a small `<Tau className="text-heat-3" />` (decorative), where `const perMillion = (usd: number) => formatUsd(usd, usd >= 0.1 ? 2 : 4);`. Under the marquee a `text-[13px] text-hush` note: "Chutes' own prices per million tokens, read live. Only models in sealed hardware are listed." States: loading "Asking subnet 64 which models are live…"; `models === null` after loading "Chutes' model list didn't load. The chat asks again when you open it."; empty "Chutes lists no sealed models right now." Marquee mechanics (render the list twice, the second copy `aria-hidden`):

```tsx
const css = `
@keyframes subnet-strip { to { transform: translateX(-50%); } }
.subnet-strip { animation: subnet-strip var(--subnet-dur) linear infinite; }
.subnet-strip[data-paused="true"] { animation-play-state: paused; }
@media (prefers-reduced-motion: reduce) { .subnet-strip { animation: none; } }
`;
// <style href="subnet-strip" precedence="default">{css}</style>
// Viewport: <div className="min-w-0 flex-1 overflow-hidden motion-reduce:overflow-x-auto [mask-image:linear-gradient(90deg,transparent,black_6%,black_94%,transparent)]">
// Track:    <div ref={track} className="subnet-strip flex w-max items-center gap-8 pr-8" style={{ "--subnet-dur": `${models.length * 6}s` } as React.CSSProperties}>
```

Pause offscreen and in hidden tabs by setting `track.current.dataset.paused` from an `IntersectionObserver` callback and a `visibilitychange` listener registered in `useEffect` (no React state needed).
- [ ] **Step 4: Demo chat leads with Bittensor.** Move the `SCRIPT` entry whose `q` is "Is there a much bigger model that keeps my question private?" to the front. Where its `receipt` renders, show `<Tau className="text-heat-4" />` in place of the generic receipt icon for receipts that start with "Served on Bittensor". Keep everything else.
- [ ] **Step 5: Section order** in `src/app/(site)/page.tsx`: `Hero`, `SubnetStrip`, `BittensorSection`, `HowItWorks`, `ChatShowcase`, `LendTeaser`, `ChainSection`, `Pricing`, `WhoHears`, `SealDemo`, `Faq`, `FinalCta`.
- [ ] **Step 6: Verify:** `npx tsc --noEmit --incremental false` and `npx eslint src/components/landing/Hero.tsx src/components/landing/SubnetStrip.tsx src/components/landing/DemoChat.tsx "src/app/(site)/page.tsx"`. Report changed files and any decisions in a few lines.

### Task 2: Landing sections (Bittensor section, how it works, FAQ, mine teaser, lane lists)

**Files:**
- Modify: `src/components/landing/BittensorSection.tsx`
- Modify: `src/components/landing/HowItWorks.tsx` (`steps[1].body`)
- Modify: `src/components/landing/Faq.tsx`
- Modify: `src/components/landing/LendTeaser.tsx`
- Modify where the three chat lanes are listed: `src/components/landing/ChatShowcase.tsx`, `Pricing.tsx`, `WhoHears.tsx`, `FinalCta.tsx` (only if they list lanes)

**Interfaces:**
- Consumes: `useSubnet`, `Tau`.
- Produces: the section keeps `id="bittensor"` (the hero badge links to it).

- [ ] **Step 1: Section title.** `<Title id="bittensor-title" q="What powers the answers?">Powered by Bittensor.</Title>`.
- [ ] **Step 2: Live data through `useSubnet`.** Delete the `chutesModels()` call, the `IntersectionObserver`, the per-maker table (`onePerMaker`) and `perMillion`; the strip above the section now lists models. Keep one live line with the breathing dot: loaded "`n` sealed models live on subnet 64 right now, listed in the strip above."; loading "Asking subnet 64 which models are live…"; failed "Chutes' model list didn't load. The chat asks again when you open it."
- [ ] **Step 3: Truthful pay labels.** In "Two ways to pay", the Inferno credits row reads status "Live" with the mint style when `credits` is true, else "When payments are on".
- [ ] **Step 4: τ on the chip.** In `SealedChip`, set a large `<Tau />` on the die, coloured along the heat ramp (for example `text-heat-4` with `drop-shadow` glow in `heat-3`), breathing slowly to show work (`animate-breathe` or a small keyframe in a `<style href precedence>` tag); static under `prefers-reduced-motion`.
- [ ] **Step 5: Bittensor first elsewhere.** `HowItWorks` step 2 body: "A Bittensor miner's, on subnet 64, inside sealed hardware, so the miner can't read your words. A lender's, picked by wallet address, in the network beta. Or your own, through WebGPU." `Faq`: move "What is Bittensor, and how does Inferno use it?" and "Can I pay with TAO?" to the top, answers unchanged unless they contradict this plan. `LendTeaser`: lead with mining on Bittensor subnet 64, then serving from the browser. Lane lists in `ChatShowcase`, `Pricing`, `WhoHears`, `FinalCta`: Bittensor first; facts unchanged.
- [ ] **Step 6: Verify:** `npx tsc --noEmit --incremental false` and `npx eslint` on your files. Report changed files and decisions in a few lines.

### Task 3: Chat, lend page, command menu

**Files:**
- Modify: `src/components/chat/ChatApp.tsx` (mode list near line 316, and wherever it renders `Icon`)
- Modify: `src/components/chat/BittensorPanel.tsx`
- Modify: `src/app/(site)/lend/page.tsx` (`<BittensorMining />` at line 165)
- Modify: `src/components/palette/CommandPalette.tsx` (items at lines 13-22)

**Interfaces:**
- Consumes: `Tau`.
- Produces: nothing new. The chat default stays private: do not change the `linked` logic (`/chat` opens private; `?mode=bittensor` opens Bittensor).

- [ ] **Step 1: Mode switcher.** Order `bittensor`, `private`, `network`. The Bittensor entry shows the τ mark instead of `Pickaxe` (wrap `Tau` so it accepts whatever props `Icon` receives, such as `size`), keeps `more: "sealed miners"` and tag `SN64`.
- [ ] **Step 2: Panel header.** In `BittensorPanel`, add one line with `<Tau className="text-heat-4" />`: "Powered by Bittensor subnet 64, through Chutes." Don't repeat what `TRUST` already says.
- [ ] **Step 3: /lend.** Render `<BittensorMining />` (anchor `mine-bittensor`) before the browser-serving lane, and make the page intro present mining on Bittensor first. Keep metadata accurate.
- [ ] **Step 4: Command menu.** Move "Chat on Bittensor" and "Mine on Bittensor" to the top of the items.
- [ ] **Step 5: Verify:** `npx tsc --noEmit --incremental false` and `npx eslint` on your files. Report changed files and decisions in a few lines.

### Task 4 (lead): shared files, integration, mobile, ship

- [ ] `src/lib/site.ts`: tagline "Chat with AI on Bittensor and GPUs people lend."; description names Bittensor subnet 64, lent GPUs, private mode, USDG on Robinhood Chain.
- [ ] `src/app/layout.tsx`: default title `Inferno: AI chat on Bittensor, paid on Robinhood Chain`.
- [ ] `src/components/site/Footer.tsx`: "Powered by Bittensor subnet 64, through Chutes." line with `Tau` under the logo; a Bittensor column (Chat on Bittensor, Mine on Bittensor, Subnet 64 on taostats, Chutes).
- [ ] `src/components/site/Nav.tsx`: "Powered by Bittensor" pill with `Tau` from `lg` up, linking to `/#bittensor`; the same link inside the phone menu.
- [ ] `src/app/opengraph-image.tsx`: headline "Chat with AI on / Bittensor / and GPUs people lend." with Bittensor in heat; a "Powered by Bittensor" pill with the τ top right; font subset text updated.
- [ ] Apply the mobile audit's fixes after Tasks 1-3 land; re-check every page at 360, 390, 430, 768 and 1280 px in the browser pane.
- [ ] `npx tsc --noEmit --incremental false`, `npx eslint src`, `npx next build`; commit and push to `hoodLMdev/inferno` `main`.
