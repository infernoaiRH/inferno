import type { Metadata } from "next";
import { HushCanvas } from "@/components/hush/HushCanvas";
import { ConnectionStatus, NetworkStats, RecentBlocks } from "@/components/network/NetworkLive";

export const metadata: Metadata = { title: "Network", alternates: { canonical: "/network" } };

const ours = [
  { name: "Credits", status: "Live. Bought with USDG transfers to the treasury, counted once the chain finalizes them." },
  { name: "Lender payouts", status: "Sent by hand in USDG during the beta." },
  { name: "Inference relay", status: "Live. It routes sealed requests to lenders and can't read them." },
  { name: "Sealed messages", status: "Demo. Nothing leaves your browser yet." },
];

export default function NetworkPage() {
  return (
    <>
      <div className="mx-auto max-w-7xl px-5 pt-16 sm:px-8 sm:pt-24">
        <h1 className="text-[clamp(2.75rem,7vw,5.5rem)] leading-[0.95]">Robinhood Chain, live</h1>
        <ConnectionStatus className="mt-5" />
      </div>

      <HushCanvas variant="band" className="mt-10" />

      <div className="mx-auto grid max-w-7xl gap-x-16 gap-y-16 px-5 pt-12 sm:px-8 lg:grid-cols-12">
        <section aria-labelledby="now-title" className="lg:col-span-5">
          <h2 id="now-title" className="mb-5 text-3xl">
            Right now
          </h2>
          <NetworkStats />
        </section>
        <section aria-labelledby="blocks-title" className="lg:col-span-7">
          <h2 id="blocks-title" className="mb-5 text-3xl">
            Recent blocks
          </h2>
          <RecentBlocks />
        </section>
      </div>

      <section aria-labelledby="ours-title" className="mx-auto max-w-7xl px-5 pt-24 sm:px-8">
        <h2 id="ours-title" className="text-3xl">
          Inferno on Robinhood Chain
        </h2>
        <p className="mt-3 max-w-[60ch] text-hush">
          Inferno has no contracts of its own. Money moves as plain USDG transfers, so every payment is on the explorer.
        </p>
        <ul className="mt-8 border-b border-line">
          {ours.map((s) => (
            <li key={s.name} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-t border-line py-4">
              <span className="text-mist">{s.name}</span>
              <span className="text-hush">{s.status}</span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
