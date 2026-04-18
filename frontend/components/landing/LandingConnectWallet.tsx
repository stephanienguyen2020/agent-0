"use client";

import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useAccount } from "wagmi";

import { usePrivyConfigured } from "@/app/providers";

/** Landing header pill — matches inline styles of `LandingClient` nav actions. */
export function LandingConnectWallet() {
  const configured = usePrivyConfigured();
  const { ready, authenticated, login, logout } = usePrivy();
  const { address } = useAccount();
  const { wallets } = useWallets();

  const addr =
    address || (wallets[0]?.address as string | undefined) || undefined;

  const pill = {
    border: "1px solid var(--line)",
    background: "transparent",
    borderRadius: 999,
    padding: "8px 14px",
    fontSize: 13,
    whiteSpace: "nowrap" as const,
    fontFamily: "inherit",
    cursor: "pointer" as const,
  };

  if (!configured) {
    return (
      <span
        className="mono"
        style={{
          ...pill,
          cursor: "default",
          color: "var(--mute)",
          borderStyle: "dashed",
        }}
        title="Set NEXT_PUBLIC_PRIVY_APP_ID"
      >
        Wallet N/A
      </span>
    );
  }

  if (!ready) {
    return (
      <span className="mono" style={{ ...pill, color: "var(--mute)" }}>
        …
      </span>
    );
  }

  if (!authenticated || !addr) {
    return (
      <button type="button" className="btn" style={pill} onClick={() => login()}>
        Connect wallet
      </button>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span
        className="mono"
        style={{
          fontSize: 12,
          color: "var(--mute)",
          maxWidth: 120,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
        title={addr}
      >
        {addr.slice(0, 6)}…{addr.slice(-4)}
      </span>
      <button
        type="button"
        className="btn"
        style={{
          ...pill,
          padding: "6px 10px",
          fontSize: 12,
        }}
        onClick={() => logout()}
      >
        Log out
      </button>
    </div>
  );
}
