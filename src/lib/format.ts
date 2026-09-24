export function shortAddress(a: string): string {
  return a.length > 10 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}

const int = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
export const formatInt = (n: number | bigint | undefined) => (n === undefined ? "–" : int.format(n));

export function formatCompact(n: number): string {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

export function formatUsd(n: number, digits = 2): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n);
}
