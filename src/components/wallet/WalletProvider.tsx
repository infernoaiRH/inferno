"use client";

/**
 * Hand-rolled wallet layer (no wagmi): EIP-6963 multi-wallet discovery with a
 * legacy window.ethereum fallback, Robinhood Chain ensure-switch (switch, then
 * add on 4902), localStorage session restore, and account/chain listeners.
 * Copied from karan-personal/parq-test (apps/web/src/components/wallet).
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CHAIN, CHAIN_HEX, EXPLORER_URL } from "@/lib/chain";

export interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] | object }): Promise<unknown>;
  on?(event: string, handler: (...args: never[]) => void): void;
  removeListener?(event: string, handler: (...args: never[]) => void): void;
}

export interface WalletOption {
  id: string; // rdns when announced, brand slug otherwise
  name: string;
  icon?: string; // data: URI from the announce payload
  provider: Eip1193Provider;
}

interface WalletState {
  address: `0x${string}` | null;
  chainHex: string | null;
  connected: boolean;
  connecting: boolean;
  onRobinhoodChain: boolean;
  providerName: string | null;
  wallets: WalletOption[];
  connect: (walletId: string) => Promise<void>;
  disconnect: () => void;
  switchToRobinhood: () => Promise<void>;
  provider: Eip1193Provider | null;
}

const WalletContext = createContext<WalletState | null>(null);

const STORAGE_KEY = "inferno.wallet.rdns";

declare global {
  interface Window {
    ethereum?: Eip1193Provider & { providers?: Eip1193Provider[]; isMetaMask?: boolean };
  }
}

function legacyName(p: { isMetaMask?: boolean; isRabby?: boolean; isCoinbaseWallet?: boolean; isBraveWallet?: boolean }): string {
  if (p.isRabby) return "Rabby";
  if (p.isCoinbaseWallet) return "Coinbase Wallet";
  if (p.isBraveWallet) return "Brave Wallet";
  if (p.isMetaMask) return "MetaMask";
  return "Browser wallet";
}

export async function ensureRobinhoodChain(provider: Eip1193Provider): Promise<void> {
  const current = (await provider.request({ method: "eth_chainId" })) as string;
  if (current?.toLowerCase() === CHAIN_HEX) return;
  try {
    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN_HEX }] });
  } catch (err) {
    const e = err as { code?: number; message?: string };
    const unknownChain = e.code === 4902 || /unknown chain|unrecognized chain|not been added/i.test(e.message ?? "");
    if (!unknownChain) throw err;
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: CHAIN_HEX,
          chainName: CHAIN.name,
          nativeCurrency: CHAIN.nativeCurrency,
          // Always the official public RPC: a keyed NEXT_PUBLIC_RPC_URL must never land in users' wallets.
          rpcUrls: [CHAIN.rpcUrls.default.http[0]],
          blockExplorerUrls: [EXPLORER_URL],
        },
      ],
    });
  }
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [wallets, setWallets] = useState<WalletOption[]>([]);
  const [address, setAddress] = useState<`0x${string}` | null>(null);
  const [chainHex, setChainHex] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [providerName, setProviderName] = useState<string | null>(null);
  const [provider, setProvider] = useState<Eip1193Provider | null>(null);
  const activeProvider = useRef<Eip1193Provider | null>(null);
  const restored = useRef(false);

  // Discovery: EIP-6963 announce events plus a legacy fallback.
  useEffect(() => {
    const found = new Map<string, WalletOption>();

    const onAnnounce = (event: Event) => {
      const detail = (event as CustomEvent<{ info: { rdns: string; name: string; icon: string }; provider: Eip1193Provider }>).detail;
      if (!detail?.info?.rdns || found.has(detail.info.rdns)) return;
      found.set(detail.info.rdns, { id: detail.info.rdns, name: detail.info.name, icon: detail.info.icon, provider: detail.provider });
      setWallets(Array.from(found.values()));
    };

    window.addEventListener("eip6963:announceProvider", onAnnounce);
    window.dispatchEvent(new Event("eip6963:requestProvider"));

    const t = setTimeout(() => {
      const legacy = window.ethereum;
      if (!legacy) return;
      const candidates = legacy.providers?.length ? legacy.providers : [legacy];
      for (const p of candidates) {
        if (Array.from(found.values()).some((w) => w.provider === p)) continue;
        const name = legacyName(p as never);
        const id = `legacy:${name.toLowerCase().replace(/\s+/g, "-")}`;
        if (!found.has(id)) {
          found.set(id, { id, name, provider: p as Eip1193Provider });
          setWallets(Array.from(found.values()));
        }
      }
    }, 400);

    return () => {
      window.removeEventListener("eip6963:announceProvider", onAnnounce);
      clearTimeout(t);
    };
  }, []);

  const attach = useCallback(async (option: WalletOption, silent: boolean) => {
    const provider = option.provider;
    const accounts = (await provider.request({ method: silent ? "eth_accounts" : "eth_requestAccounts" })) as string[];
    if (!accounts?.length) {
      if (silent) return;
      throw new Error("The wallet didn't share an account. Unlock it and try again.");
    }
    if (!silent) await ensureRobinhoodChain(provider);
    const chain = (await provider.request({ method: "eth_chainId" })) as string;

    activeProvider.current = provider;
    setProvider(provider);
    setAddress(accounts[0] as `0x${string}`);
    setChainHex(chain?.toLowerCase() ?? null);
    setProviderName(option.name);
    try {
      localStorage.setItem(STORAGE_KEY, option.id);
    } catch {
      // Storage may be unavailable; the session just won't restore.
    }

    provider.on?.("accountsChanged", ((accs: string[]) => {
      if (!accs?.length) {
        activeProvider.current = null;
        setProvider(null);
        setAddress(null);
        setProviderName(null);
      } else {
        setAddress(accs[0] as `0x${string}`);
      }
    }) as never);
    provider.on?.("chainChanged", ((c: string) => setChainHex(c?.toLowerCase() ?? null)) as never);
  }, []);

  // Silent session restore once wallets are discovered.
  useEffect(() => {
    if (restored.current || wallets.length === 0) return;
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(STORAGE_KEY);
    } catch {
      return;
    }
    const option = saved ? wallets.find((w) => w.id === saved) : undefined;
    if (!option) return;
    restored.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- attach() awaits the wallet before any setState
    void attach(option, true).catch(() => {});
  }, [wallets, attach]);

  const connect = useCallback(
    async (walletId: string) => {
      const option = wallets.find((w) => w.id === walletId);
      if (!option) throw new Error("That wallet is no longer available. Reload and try again.");
      setConnecting(true);
      try {
        await attach(option, false);
      } finally {
        setConnecting(false);
      }
    },
    [wallets, attach],
  );

  const disconnect = useCallback(() => {
    activeProvider.current = null;
    setProvider(null);
    setAddress(null);
    setChainHex(null);
    setProviderName(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  const switchToRobinhood = useCallback(async () => {
    if (!activeProvider.current) return;
    await ensureRobinhoodChain(activeProvider.current);
    const chain = (await activeProvider.current.request({ method: "eth_chainId" })) as string;
    setChainHex(chain?.toLowerCase() ?? null);
  }, []);

  const value = useMemo<WalletState>(
    () => ({
      address,
      chainHex,
      connected: address !== null,
      connecting,
      onRobinhoodChain: chainHex === CHAIN_HEX,
      providerName,
      wallets,
      connect,
      disconnect,
      switchToRobinhood,
      provider,
    }),
    [address, chainHex, connecting, providerName, wallets, connect, disconnect, switchToRobinhood, provider],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletState {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used inside WalletProvider");
  return ctx;
}
