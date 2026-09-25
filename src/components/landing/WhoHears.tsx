import { type ComponentProps } from "react";
import { Gpu, Laptop, Mail } from "lucide-react";
import { Tau } from "@/components/brand/Tau";
import { Title } from "@/components/landing/Title";

/** Adapts the em-sized, className-only `Tau` to the lucide `<Icon size .../>` call sites below. */
function TauIcon({ size, className }: ComponentProps<typeof Gpu>) {
  return (
    <span style={{ fontSize: size }} className={className}>
      <Tau />
    </span>
  );
}

const modes = [
  { Icon: TauIcon, name: "Bittensor chat" },
  { Icon: Laptop, name: "Private chat" },
  { Icon: Gpu, name: "Network chat" },
  { Icon: Mail, name: "Sealed messages" },
];

const rows = [
  [
    "Your words",
    "Chutes' gateway, in memory, and Inferno's server in passing when you pay with credits. Miners can't read them.",
    "Only you",
    "You and the lender whose GPU serves the request",
    "You and the recipient",
  ],
  [
    "Your wallet",
    "No one with your own key; Inferno's server when you pay with credits.",
    "No one. No wallet needed.",
    "Inferno's server, to bill your credits. Your top-ups are public on Robinhood Chain. Lenders never see it.",
    "The recipient, and the relay that routes the envelope",
  ],
  [
    "Who and when",
    "Chutes sees request time and size, and so does Inferno when you pay with credits.",
    "No one",
    "Inferno sees request time and size to bill you",
    "The relay sees sender, recipient and time, never content",
  ],
  [
    "Payments",
    "Your Chutes account, or Inferno credits on Robinhood Chain.",
    "Nothing to pay",
    "Public on Robinhood Chain, like any transfer",
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
        Bittensor chat, private chat and network chat work today. Sealed messages still run on a demo relay that keeps
        everything in your browser.
      </p>
    </section>
  );
}
