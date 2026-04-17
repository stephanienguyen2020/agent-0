"use client";

/**
 * Prompt the wallet to switch to opBNB Testnet once after login if the user is on another chain
 * (e.g. MetaMask left on XRPL EVM Testnet). Privy/wagmi defaultChain does not override MetaMask's extension selection.
 */

import { usePrivy } from "@privy-io/react-auth";
import { useEffect, useRef } from "react";
import { useChainId, useSwitchChain } from "wagmi";

import { opBNBTestnet } from "@/lib/chains";

export function SyncOpBNBChain() {
  const { authenticated, ready } = usePrivy();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const attemptedAutoSwitch = useRef(false);

  useEffect(() => {
    if (!ready || !authenticated) return;
    if (chainId === opBNBTestnet.id) {
      attemptedAutoSwitch.current = false;
      return;
    }
    if (attemptedAutoSwitch.current) return;
    attemptedAutoSwitch.current = true;
    void switchChainAsync({ chainId: opBNBTestnet.id }).catch(() => {});
  }, [ready, authenticated, chainId, switchChainAsync]);

  return null;
}
