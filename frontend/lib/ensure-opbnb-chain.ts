import { getChainId } from "wagmi/actions";
import type { Config } from "wagmi";

import { opBNBTestnet } from "@/lib/chains";
import { readInjectedChainId } from "@/lib/read-injected-chain-id";

/** User-facing message when wagmi cannot reach opBNB Testnet after switch. */
export const PUBLISH_CHAIN_ERROR =
  "Your wallet must be on opBNB Testnet (chain 5611) to sign. Approve the network switch in MetaMask if prompted, then try again.";

type SwitchChainAsync = (args: { chainId: number }) => Promise<unknown>;

/**
 * Align the active wagmi signer with opBNB before EIP-712 x402 signing.
 * Uses `getChainId(config)` (authoritative for the connector that signs), not `window.ethereum`,
 * which can disagree when multiple wallets are installed (e.g. MetaMask vs Privy).
 */
export async function ensureOpBNBForX402Publish(opts: {
  config: Config;
  switchChainAsync: SwitchChainAsync;
}): Promise<void> {
  const { config, switchChainAsync } = opts;
  let cid = getChainId(config);
  if (cid !== opBNBTestnet.id) {
    await switchChainAsync({ chainId: opBNBTestnet.id });
  }
  for (let i = 0; i < 40; i++) {
    cid = getChainId(config);
    if (cid === opBNBTestnet.id) {
      if (process.env.NODE_ENV === "development") {
        const inj = await readInjectedChainId();
        if (inj != null && inj !== cid) {
          console.warn(
            "[agent-zero] window.ethereum chainId",
            inj,
            "differs from wagmi chainId",
            cid,
            "(signing uses wagmi)"
          );
        }
      }
      return;
    }
    await new Promise<void>((r) => setTimeout(r, 50));
  }
  throw new Error(PUBLISH_CHAIN_ERROR);
}
