"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { WagmiProvider } from "@privy-io/wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Children, createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { SyncOpBNBChain } from "@/components/wallet/SyncOpBNBChain";
import { opBNBTestnet } from "@/lib/chains";
import { wagmiConfig } from "@/lib/wagmi-config";

export const PrivyEnabledContext = createContext(false);

export function usePrivyConfigured() {
  return useContext(PrivyEnabledContext);
}

function PrivyStack({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";

  /** Stable reference — new object literals each render can disturb Privy/wagmi internals (React 19 key warnings). */
  const privyProviderConfig = useMemo(
    () => ({
      embeddedWallets: {
        ethereum: { createOnLogin: "users-without-wallets" as const },
      },
      supportedChains: [opBNBTestnet],
      defaultChain: opBNBTestnet,
    }),
    [],
  );

  // #region agent log
  useEffect(() => {
    const arr = Children.toArray(children);
    fetch("http://127.0.0.1:7675/ingest/a6edaa57-fc9c-4bd9-9435-f1ce83aaa252", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "b12d08" },
      body: JSON.stringify({
        sessionId: "b12d08",
        location: "providers.tsx:PrivyStack",
        message: "Wagmi single-wrapper verification",
        hypothesisId: "H_single_wagmi_child",
        data: {
          segmentChildCount: Children.count(children),
          segmentToArrayLen: arr.length,
          keyedWrapper: true,
        },
        timestamp: Date.now(),
        runId: "wagmi-contents-wrapper",
      }),
    }).catch(() => {});
  }, [children]);
  // #endregion

  return (
    <PrivyProvider
      appId={appId}
      config={privyProviderConfig}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>
          {/* One React child for @privy-io/wagmi — avoids sibling lists without keys in some versions */}
          <div className="contents">
            <SyncOpBNBChain />
            {children}
          </div>
        </WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  const configured = Boolean(process.env.NEXT_PUBLIC_PRIVY_APP_ID);

  if (!configured) {
    return (
      <PrivyEnabledContext.Provider value={false}>
        <div className="border-b border-amber-500/30 bg-amber-500/10 px-6 py-2 text-center text-xs text-amber-200">
          Wallet UI disabled: set{" "}
          <code className="rounded bg-black/30 px-1">NEXT_PUBLIC_PRIVY_APP_ID</code> in{" "}
          <code className="rounded bg-black/30 px-1">frontend/.env.local</code>.
        </div>
        {children}
      </PrivyEnabledContext.Provider>
    );
  }

  return (
    <PrivyEnabledContext.Provider value={true}>
      <PrivyStack>{children}</PrivyStack>
    </PrivyEnabledContext.Provider>
  );
}
