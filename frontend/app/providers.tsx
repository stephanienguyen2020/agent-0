"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { WagmiProvider } from "@privy-io/wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createContext, useContext, useState, type ReactNode } from "react";

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

  return (
    <PrivyProvider
      appId={appId}
      config={{
        embeddedWallets: {
          ethereum: { createOnLogin: "users-without-wallets" },
        },
        supportedChains: [opBNBTestnet],
        defaultChain: opBNBTestnet,
      }}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>
          <SyncOpBNBChain />
          {children}
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
