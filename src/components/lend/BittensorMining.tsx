import Link from "next/link";
import type { ReactNode } from "react";
import { CopyButton } from "@/components/credits/CreditsAccount";
import { buttonClass } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { LENDER_SHARE } from "@/lib/relay/protocol";
import { Rules } from "./Rules";

/**
 * "Mine on Bittensor": what subnet 64 (Chutes) mining is, who can do it, and the steps from Chutes' and
 * Bittensor's own docs. Facts checked on 2026-09-25 against SOURCES; Chutes changes its miner setup often.
 */

const wrap = "mx-auto max-w-7xl px-5 sm:px-8";
const split = "grid gap-x-16 gap-y-10 py-20 sm:py-28 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]";
const subhead = "wide text-3xl sm:text-5xl";
const link = "text-flame underline decoration-flame/40 underline-offset-4 hover:decoration-flame";
const mono = "rounded-md bg-night-3 px-1.5 py-0.5 font-mono text-[0.88em] text-mist wrap-anywhere";

const HOTKEY = "~/.bittensor/wallets/miner/hotkeys/default";
const TAOSTATS = "https://taostats.io/subnets/64";
const share = `${Math.round(LENDER_SHARE * 100)}%`;

const LANES: { name: string; rows: [string, string][] }[] = [
  {
    name: "Inferno, in your browser",
    rows: [
      ["GPU", "Any recent GPU with WebGPU. 8 GB runs small models."],
      ["Confidential computing", "Not needed."],
      ["Machine", "Your own computer, with a browser tab open."],
      ["To join", "A wallet on Robinhood Chain."],
      ["Pays", `${share} of each answer, in USDG, when the site has payments on. Paid out by hand during the beta.`],
    ],
  },
  {
    name: "Bittensor, subnet 64",
    rows: [
      ["GPU", "Eight H200, B200 or RTX Pro 6000 cards in one server, the setups Chutes has tested. The H100 isn't on that list."],
      ["Confidential computing", "Required: an Intel TDX CPU and NVIDIA confidential computing."],
      ["Machine", "Bare-metal GPU servers on Ubuntu 26.04 with fixed public IPs, plus a control server."],
      ["To join", "A Bittensor wallet, and TAO for the registration price."],
      ["Pays", "Subnet 64's alpha token, for the compute you serve."],
    ],
  },
];

const RISKS = [
  {
    term: "The registration price",
    detail: (
      <>
        Paid in TAO from your coldkey. It jumps with every registration and decays while nobody registers, so check it
        live, with btcli or on <Out href={TAOSTATS}>taostats</Out>. The burned part is never refunded, even if your miner is
        dropped later.
      </>
    ),
  },
  {
    term: "Hardware and power",
    detail:
      "Eight data-center GPUs in a TDX server and a control server, bought or rented, with power and bandwidth on top. They cost the same whether or not your miner earns.",
  },
  {
    term: "Earnings move",
    detail:
      "Your share depends on how much compute you serve next to every other miner. It's paid in subnet 64's alpha, and what that's worth in TAO, or in dollars, changes all the time.",
  },
  {
    term: "You can be dropped",
    detail:
      "Subnet 64 has a fixed number of slots. Once your immunity period ends, the lowest earner is the first pushed out when someone new registers, and coming back means paying the price again.",
  },
  {
    term: "No promises",
    detail: "Inferno doesn't run subnet 64, doesn't pay Bittensor miners, and can't promise you'll earn anything.",
  },
];

const TIES = [
  {
    term: "The same miners as Bittensor chat",
    detail: (
      <>
        Pick Bittensor in{" "}
        <Link href="/chat?mode=bittensor" className={link}>
          Inferno&apos;s chat
        </Link>{" "}
        and Chutes answers on subnet 64 miners like these, inside the same confidential hardware.
      </>
    ),
  },
  {
    term: "TAO on Robinhood Chain",
    detail: (
      <>
        TAO reaches Robinhood Chain through Chainlink&apos;s CCIP bridge, so Inferno can take it for{" "}
        <Link href="/credits" className={link}>
          credits
        </Link>{" "}
        once the site&apos;s operator turns TAO payments on.
      </>
    ),
  },
  {
    term: "Who pays whom",
    detail:
      `The Bittensor network pays subnet 64 miners, in alpha. Inferno pays browser miners ${share} of each answer, in USDG, when the site has payments on.`,
  },
];

const SOURCES = [
  ["Chutes miner README: TEE-only network, control plane, registration, adding nodes", "https://github.com/chutesai/chutes-miner"],
  ["sek8s host tools: tested GPU setups and Ubuntu 26.04", "https://github.com/chutesai/sek8s/tree/main/host-tools"],
  ["sek8s end-to-end miner guide", "https://github.com/chutesai/sek8s/blob/main/docs/end-to-end-miner.md"],
  ["GPU names Chutes accepts", "https://github.com/chutesai/chutes-api/blob/main/api/gpu.py"],
  ["Chutes docs: mining on Chutes (last updated in 2025)", "https://chutes.ai/docs/miner-resources/overview"],
  ["Bittensor docs: mining", "https://www.bittensor.com/docs/guides/mining"],
  ["Bittensor docs: the registration price", "https://www.bittensor.com/docs/guides/mining/burn"],
  ["Bittensor docs: wallets and keys", "https://www.bittensor.com/docs/concepts/wallets"],
  ["Bittensor docs: emissions", "https://www.bittensor.com/docs/concepts/emissions"],
  ["btcli now ships in the bittensor package", "https://github.com/opentensor/btcli"],
  ["Subnet 64 on taostats", TAOSTATS],
  ["Lium, subnet 51: the GPUs it takes", "https://docs.lium.io/providers/architecture"],
  ["Lium validator: which idle GPUs earn emissions", "https://github.com/Datura-ai/lium-io/blob/main/neurons/validators/src/services/const.py"],
  ["IOTA, subnet 9: compute requirements", "https://github.com/macrocosm-os/IOTA"],
  ["TAO on Robinhood Chain over Chainlink CCIP", "https://github.com/TalismanSociety/talisman/pull/2555"],
];

/** An outside link, in a new tab. */
function Out({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className={link}>
      {children}
    </a>
  );
}

/** Terminal commands, exactly as the docs give them, with a copy button. */
function Code({ children }: { children: string }) {
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-2xl border border-line bg-night-2 px-4 pt-14 pb-4 font-mono text-[13.5px] leading-relaxed text-mist sm:pt-4 sm:pr-32">
        {children}
      </pre>
      <div className="absolute top-2 right-2 rounded-full bg-night-2">
        <CopyButton text={children} label="Copy" />
      </div>
    </div>
  );
}

function Step({ n, title, source, children }: { n: number; title: string; source: [string, string]; children: ReactNode }) {
  return (
    <li className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3 border-t border-line py-8 sm:grid-cols-[3rem_minmax(0,1fr)]">
      <span aria-hidden className="tnum font-display text-2xl font-extrabold text-faint">
        {n}
      </span>
      <div className="min-w-0">
        <h4 className="text-2xl">{title}</h4>
        <div className="mt-4 space-y-4 text-hush">{children}</div>
        <p className="mt-4 text-[15px]">
          <Out href={source[1]}>{source[0]}</Out>
        </p>
      </div>
    </li>
  );
}

export function BittensorMining() {
  return (
    <section id="mine-bittensor" aria-labelledby="mine-bittensor-title" className="border-t border-line">
      <div className={cn(wrap, "py-20 sm:py-28")}>
        {/* 2.25rem floor: "Bittensor" at full width must fit 320px of content at a 360px viewport. */}
        <h2 id="mine-bittensor-title" className="xwide text-[clamp(2.25rem,7vw,6rem)] leading-[0.95]">
          Mine on Bittensor
        </h2>
        <div className="mt-10 grid gap-x-16 gap-y-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-end">
          <p className="max-w-[58ch] text-lg text-hush sm:text-xl">
            Bittensor is an open network of subnets, and each one pays miners for one kind of work. On subnet 64, called
            Chutes, miners run open AI models inside confidential-compute servers and answer requests from everyone who uses
            Chutes. They earn subnet 64&apos;s alpha token, which trades for TAO.
          </p>
          <p className="max-w-[46ch] border-l border-line-bright pl-4 text-mist">
            This is data-center work: eight-GPU servers, Linux, Kubernetes and TAO to register. None of it runs in a browser,
            and none of it is guaranteed to pay.
          </p>
        </div>
      </div>

      <div className="border-t border-line">
        <div className={cn(wrap, split)}>
          <div>
            <h3 className={subhead}>Can my hardware do it?</h3>
            <p className="mt-5 max-w-[52ch] text-hush">
              Not if it&apos;s a gaming PC, a laptop or a Mac. Subnet 64 only takes servers that prove, in hardware, that
              nobody can look inside: an Intel TDX confidential VM with NVIDIA confidential computing on. Consumer cards like
              the RTX 4090 don&apos;t have it. The GPU test below measures speed, so it can&apos;t change that answer, but
              those cards are a good fit for mining on Inferno, right in your browser.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#serve" className={buttonClass()}>
                Mine in your browser
              </a>
              <a href="#test" className={buttonClass({ variant: "quiet" })}>
                Test my GPU
              </a>
            </div>
            <p className="heat-text xwide tnum mt-12 font-display text-[clamp(4rem,14vw,9rem)] leading-none font-extrabold">8</p>
            <p className="mt-3 max-w-[40ch] text-hush">
              data-center GPUs in one server, in every setup Chutes has tested for subnet 64.
            </p>
          </div>

          <div>
            <div className="grid gap-4 sm:grid-cols-2">
              {LANES.map((lane) => (
                <div key={lane.name} className="rounded-3xl border border-line bg-night-2 p-5 sm:p-6">
                  <h4 className="text-xl">{lane.name}</h4>
                  <dl className="mt-4 space-y-4 text-[15px]">
                    {lane.rows.map(([term, detail]) => (
                      <div key={term}>
                        <dt className="text-hush">{term}</dt>
                        <dd className="mt-0.5">{detail}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
            </div>
            <p className="mt-8 max-w-[62ch] text-[15px] text-hush">
              Want Bittensor with a consumer card anyway? A few subnets take them.{" "}
              <Out href="https://docs.lium.io/providers/architecture">Lium, subnet 51</Out>, rents GPUs out, and its
              validator gives idle RTX 3090, 4090 and 5090 cards a share of emissions.{" "}
              <Out href="https://github.com/macrocosm-os/IOTA">IOTA, subnet 9</Out>, trains models and asks for a GPU with
              16 GB or more, such as an RTX 4090. Each has its own setup and registration price, and many GPU subnets,
              subnet 64 included, want data-center cards.
            </p>
          </div>
        </div>
      </div>

      <div className="border-t border-line">
        <div className={cn(wrap, split)}>
          <div>
            <h3 className={subhead}>The steps</h3>
            <p className="mt-5 max-w-[52ch] text-hush">
              In order, from Chutes&apos; and Bittensor&apos;s own docs. Make the wallet on a computer you trust that
              isn&apos;t one of your servers, and keep the coldkey there.
            </p>
            <p className="mt-6 max-w-[52ch] border-l border-line-bright pl-4 text-[15px] text-mist">
              Checked on 25 September 2026. Chutes changes its miner setup often, so when its docs disagree with this page,
              follow its docs.
            </p>
          </div>

          <ol className="border-b border-line">
            <Step
              n={1}
              title="Check the hardware"
              source={[
                "Tested setups, in Chutes' sek8s host tools",
                "https://github.com/chutesai/sek8s/tree/main/host-tools#validated-host-topologies",
              ]}
            >
              <p>
                Chutes has tested three setups end to end: eight H200, eight B200 or eight RTX Pro 6000 cards in one server
                with an Intel TDX CPU, running Ubuntu 26.04. You also need one server without a GPU, with at least 4 cores and
                32 GB of RAM, for the control plane.
              </p>
              <p>
                Every server needs a fixed public IP, and the GPU servers must be bare metal. Runpod, Vast and similar rentals
                won&apos;t work.
              </p>
            </Step>

            <Step
              n={2}
              title="Make a wallet and put TAO in it"
              source={["Wallets and keys, Bittensor docs", "https://www.bittensor.com/docs/concepts/wallets"]}
            >
              <Code>{"pip install bittensor\nbtcli wallet create -w miner -H default"}</Code>
              <p>
                That makes a coldkey, which holds your TAO, and a hotkey, which is your miner&apos;s identity on the subnet.
                btcli shows a recovery phrase for each only once: write them down offline, because they&apos;re the only way
                back in.
              </p>
              <p>
                Then send TAO for the registration to your coldkey&apos;s address, which{" "}
                <code className={mono}>btcli wallet list</code> shows. Never send TAO to a hotkey address. Check it arrived:
              </p>
              <Code>{"btcli wallet balance miner"}</Code>
            </Step>

            <Step n={3} title="Set up the control plane" source={["Chutes miner README", "https://github.com/chutesai/chutes-miner#readme"]}>
              <p>
                The control server runs Chutes&apos; miner API, database and scheduler. Ansible sets it up from your own
                computer. Get the miner repo and a copy of its inventory:
              </p>
              <Code>
                {"git clone https://github.com/chutesai/chutes-miner\nmkdir -p ~/chutes\ncp chutes-miner/ansible/k3s/inventory.yml ~/chutes/inventory.yml"}
              </Code>
              <p>
                Put your control server and <code className={mono}>hotkey_path: {HOTKEY}</code> in that file, and your chart
                settings in <code className={mono}>~/chutes/values.yaml</code>, as the README explains. Then install Ansible
                and its collections, and run:
              </p>
              <Code>{"cd chutes-miner/ansible/k3s\nansible-playbook -i ~/chutes/inventory.yml playbooks/site.yml"}</Code>
            </Step>

            <Step n={4} title="Register on subnet 64" source={["Mining guide, Bittensor docs", "https://www.bittensor.com/docs/guides/mining"]}>
              <p>
                The price floats, so check it first. The dry run shows exactly what you&apos;d pay, without paying.
              </p>
              <Code>
                {"btcli query burn --netuid 64\nbtcli tx burned-register --netuid 64 -w miner -H default --dry-run"}
              </Code>
              <p>When the price looks right, register for real:</p>
              <Code>{"btcli tx burned-register --netuid 64 -w miner -H default"}</Code>
              <p>
                Register once: Chutes says a second slot only competes with your first, so add GPUs to one miner instead.
                Don&apos;t publish an axon either, because Chutes doesn&apos;t use one. A new slot is only protected for a
                while, so have your GPU servers ready to go. You can also watch the price on <Out href={TAOSTATS}>taostats</Out>.
              </p>
            </Step>

            <Step
              n={5}
              title="Turn each GPU server into a confidential VM"
              source={["End-to-end miner guide, Chutes' sek8s", "https://github.com/chutesai/sek8s/blob/main/docs/end-to-end-miner.md"]}
            >
              <p>
                Chutes&apos; sek8s tools install the TDX kernel and attestation services on each GPU server, then boot the
                confidential VM that runs your share of Chutes. You&apos;ll need an API key from Intel&apos;s Trusted Services
                portal.
              </p>
              <Code>
                {"git clone https://github.com/chutesai/sek8s\ncd sek8s/ansible/host\ncp inventory/hosts.yml ~/chutes/my-inventory.yml"}
              </Code>
              <p>
                List your GPU servers in <code className={mono}>~/chutes/my-inventory.yml</code> and set{" "}
                <code className={mono}>chutes_hotkey_path: {HOTKEY}</code>. Then:
              </p>
              <Code>
                {
                  "ansible-playbook -i ~/chutes/my-inventory.yml playbooks/setup.yml \\\n  -e pccs_api_key=<your-key> -e pccs_password=<your-password>\nansible-playbook -i ~/chutes/my-inventory.yml playbooks/launch.yml"
                }
              </Code>
              <p>
                The VM has no SSH, and its disk only unlocks when the hardware proves it&apos;s running Chutes&apos; approved
                image. So nobody, you included, can see the prompts it serves.
              </p>
            </Step>

            <Step
              n={6}
              title="Add each GPU server to your miner"
              source={[
                "Adding TEE nodes, Chutes miner README",
                "https://github.com/chutesai/chutes-miner#8-deploy-and-add-your-tee-worker-nodes",
              ]}
            >
              <p>
                Once a VM reports ready, run this once per GPU server, from the computer that holds your hotkey. It checks the
                server&apos;s attestation and offers its GPUs to the validator.
              </p>
              <Code>
                {`pip install chutes-miner-cli
chutes-miner add-node \\
  --name <gpu-server-name> \\
  --validator <validator-hotkey> \\
  --hourly-cost <usd-per-gpu-hour> \\
  --gpu-short-ref h200 \\
  --hotkey ${HOTKEY} \\
  --agent-api http://<gpu-server-ip>:32000 \\
  --miner-api http://<control-server-ip>:32000`}
              </Code>
              <p>
                The name is the server&apos;s name in your inventory. Use <code className={mono}>b200</code> or{" "}
                <code className={mono}>pro_6000</code> for those cards. The README lists the validator&apos;s hotkey.
              </p>
            </Step>

            <Step n={7} title="Watch it earn" source={["Subnet 64 on taostats", TAOSTATS]}>
              <p>
                Subnet 64&apos;s validators score the compute you served over the last 7 days, so a new miner starts slow.
                Rewards arrive on your hotkey as subnet 64 stake every tempo, about 72 minutes by default, and you can unstake
                them into TAO.
              </p>
              <Code>{"btcli wallet overview -w miner"}</Code>
            </Step>
          </ol>
        </div>
      </div>

      <div className="border-t border-line">
        <div className={cn(wrap, split)}>
          <div>
            <h3 className={subhead}>Costs and risks</h3>
            <p className="mt-5 max-w-[46ch] text-hush">Know these before you spend anything.</p>
          </div>
          <Rules rows={RISKS} />
        </div>
      </div>

      <div className="border-t border-line">
        <div className={cn(wrap, split)}>
          <h3 className={subhead}>How it ties to Inferno</h3>
          <Rules rows={TIES} />
        </div>
      </div>

      <div className="border-t border-line">
        <div className={cn(wrap, split)}>
          <div>
            <h3 className={subhead}>Sources</h3>
            <p className="mt-5 max-w-[46ch] text-hush">Everything above comes from these pages.</p>
          </div>
          <ol className="space-y-4 text-[15px]">
            {SOURCES.map(([label, href]) => (
              <li key={href}>
                <Out href={href}>{label}</Out>
                <span className="block text-[13px] text-faint wrap-anywhere">{href}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
