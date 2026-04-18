import { opBNBTestnet } from "@/lib/chains";

const BASE = opBNBTestnet.blockExplorers.default.url.replace(/\/$/, "");

/** Block explorer origin (no path). */
export function explorerOrigin(): string {
  return BASE;
}

/** opBNBScan transaction URL for opBNB Testnet (5611). */
export function explorerTxUrl(txHash: string): string {
  const h = txHash.startsWith("0x") ? txHash : `0x${txHash}`;
  return `${BASE}/tx/${h}`;
}

/** Truncate `0x…` hash for display (e.g. `0xabc1…9f3e`). */
export function shortTxHash(hash: string, head = 8, tail = 4): string {
  const h = hash.startsWith("0x") ? hash : `0x${hash}`;
  if (h.length <= 2 + head + tail) return h;
  return `${h.slice(0, 2 + head)}…${h.slice(-tail)}`;
}
