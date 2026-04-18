"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { WagmiProvider } from "@privy-io/wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Children,
  createContext,
  isValidElement,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

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
    if (process.env.NODE_ENV !== "development") return;
    const arr = Children.toArray(children);
    const segments = arr.map((c, i) => ({
      i,
      key: isValidElement(c) ? String(c.key ?? "") : null,
      type:
        isValidElement(c) && typeof c.type === "function"
          ? (c.type as { name?: string }).name ?? "anonymous"
          : isValidElement(c)
            ? String(c.type)
            : typeof c,
    }));
    fetch("http://127.0.0.1:7675/ingest/a6edaa57-fc9c-4bd9-9435-f1ce83aaa252", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "b12d08" },
      body: JSON.stringify({
        sessionId: "b12d08",
        location: "providers.tsx:PrivyStack",
        message: "Providers segment children snapshot",
        hypothesisId: "H_segments_keys",
        data: { segmentChildCount: Children.count(children), segments },
        timestamp: Date.now(),
        runId: "privy-3.22.1-key-verify",
      }),
    }).catch(() => {});
  }, [children]);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    /** React often logs missing-key via `console.error`, not `console.warn`. */
    const ingestKeyMessage = (channel: "warn" | "error", args: unknown[]) => {
      const msg =
        typeof args[0] === "string"
          ? args[0]
          : args.map((a) => (typeof a === "string" ? a : "")).join(" ");
      if (!msg.includes("unique") || !msg.includes("key")) return;
      fetch("http://127.0.0.1:7675/ingest/a6edaa57-fc9c-4bd9-9435-f1ce83aaa252", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "b12d08" },
        body: JSON.stringify({
          sessionId: "b12d08",
          location: "providers.tsx:PrivyStack",
          message: "React key warning intercepted",
          hypothesisId: "H_react_key_warning_source",
          data: {
            channel,
            prefix: msg.slice(0, 500),
            rest: args
              .slice(1)
              .map((a) => (typeof a === "string" ? a : ""))
              .join("|")
              .slice(0, 400),
          },
          timestamp: Date.now(),
          runId: "privy-3.22.1-key-verify",
        }),
      }).catch(() => {});
    };
    const prevWarn = console.warn;
    const prevErr = console.error;
    console.warn = (...args: unknown[]) => {
      ingestKeyMessage("warn", args);
      prevWarn.apply(console, args as Parameters<typeof console.warn>);
    };
    console.error = (...args: unknown[]) => {
      ingestKeyMessage("error", args);
      prevErr.apply(console, args as Parameters<typeof console.error>);
    };
    return () => {
      console.warn = prevWarn;
      console.error = prevErr;
    };
  }, []);
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
