/**
 * Read the chain the browser wallet extension is actually on (EIP-1193 `eth_chainId`).
 * May disagree with wagmi `useChainId()` briefly after network switches.
 */

export async function readInjectedChainId(): Promise<number | null> {
  if (typeof window === "undefined") return null;
  const ethereum = (
    window as Window & { ethereum?: { request?: (args: { method: string }) => Promise<unknown> } }
  ).ethereum;
  if (!ethereum?.request) return null;
  try {
    const hex = (await ethereum.request({ method: "eth_chainId" })) as string;
    return Number.parseInt(hex, 16);
  } catch {
    return null;
  }
}
