"use client";

import { buttonClass } from "@/components/ui/Button";
import { ConnectCta } from "@/components/wallet/ConnectButton";
import { useWallet } from "@/components/wallet/WalletProvider";
import { shortAddress } from "@/lib/format";

/** ConnectCta, or the connected address once there is one. */
export function WalletCta() {
  const { address } = useWallet();
  if (!address) return <ConnectCta label="Connect a wallet" className={buttonClass({ size: "lg" })} />;
  return (
    <p className="inline-flex h-12 items-center gap-1.5 rounded-full border border-line-bright px-6 text-mist">
      Connected as <span className="tnum">{shortAddress(address)}</span>
    </p>
  );
}
