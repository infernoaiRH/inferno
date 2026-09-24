import { Gpu, Laptop, Mail, Pickaxe } from "lucide-react";
import { Title } from "@/components/landing/Title";

const modes = [
  { Icon: Laptop, name: "Private chat" },
  { Icon: Gpu, name: "Network chat" },
  { Icon: Pickaxe, name: "Bittensor chat" },
  { Icon: Mail, name: "Sealed messages" },
];

const rows = [
  [
    "Your words",
    "Only you",
    "You and the lender whose GPU serves the request",
    "Chutes' gateway, in memory, and Inferno's server in passing when you pay with credits. Miners can't read them.",
    "You and the recipient",
  ],
  [
    "Your wallet",
    "No one. No wallet needed.",
    "Inferno's server, to bill your credits. Your top-ups are public on Robinhood Chain. Lenders never see it.",
    "No one with your own key; Inferno's server when you pay with credits.",
    "The recipient, and the relay that routes the envelope",
  ],
  [
    "Who and when",
    "No one",
    "Inferno sees request time and size to bill you",
    "Chutes sees request time and size, and so does Inferno when you pay with credits.",
    "The relay sees sender, recipient and time, never content",
  ],
  [
    "Payments",
    "Nothing to pay",
    "Public on Robinhood Chain, like any transfer",
    "Your Chutes account, or Inferno credits on Robinhood Chain.",
    "Free during beta",
  ],
];

/** A real table on wide screens; below lg each row stacks, with the mode's icon labelling each cell. */
export function WhoHears() {
  return (
    <section id="who-hears-what" aria-labelledby="who-title" className="mx-auto max-w-7xl px-5 py-24 sm:px-8 sm:py-32">
      <Title id="who-title" q="Is it private?">
        It depends on the mode. Here&apos;s exactly who sees what.
      </Title>
      {/* Stacked rows show only the icons, so name them once up front. */}
      <p aria-hidden className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-[15px] text-hush lg:hidden">
        {modes.map(({ Icon, name }) => (
          <span key={name} className="flex items-center gap-2">
            <Icon size={18} className="text-flame" /> {name}
          </span>
        ))}
      </p>
      <table className="mt-14 w-full max-lg:mt-6 max-lg:block lg:table-fixed">
        <caption className="sr-only">What each mode reveals about your words, your wallet, timing and payments</caption>
        <thead className="max-lg:hidden">
          <tr>
            <td className="w-48" />
            {modes.map(({ Icon, name }) => (
              <th key={name} scope="col" className="pr-8 pb-6 text-left align-bottom font-normal">
                <Icon aria-hidden size={30} className="text-flame" />
                <span className="mt-3 block font-display text-xl font-bold">{name}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="border-b border-line max-lg:block">
          {rows.map(([label, ...cells]) => (
            <tr key={label} className="border-t border-line max-lg:block max-lg:py-6">
              <th
                scope="row"
                className="py-6 pr-8 text-left align-top font-display text-lg font-bold max-lg:block max-lg:p-0 max-lg:pb-3"
              >
                {label}
              </th>
              {cells.map((text, i) => {
                const { Icon, name } = modes[i];
                return (
                  <td
                    key={name}
                    className="py-6 pr-8 align-top text-pretty text-hush max-lg:grid max-lg:grid-cols-[2rem_minmax(0,1fr)] max-lg:gap-2 max-lg:py-1.5 max-lg:pr-0"
                  >
                    <span className="lg:hidden">
                      <Icon aria-hidden size={18} className="mt-1 text-flame" />
                      <span className="sr-only">{name}: </span>
                    </span>
                    {text}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-6 text-sm text-hush">
        Private chat, network chat and Bittensor chat work today. Sealed messages still run on a demo relay that keeps
        everything in your browser.
      </p>
    </section>
  );
}
