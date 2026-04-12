"use client";

import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useAccount } from "wagmi";

import { usePrivyConfigured } from "@/app/providers";

function WalletControlsInner() {
  const { ready, authenticated, login, logout } = usePrivy();
  const { address } = useAccount();
  const { wallets } = useWallets();

  const addr =
    address ||
    (wallets[0]?.address as string | undefined) ||
    undefined;

  if (!ready) {
    return <span className="text-xs text-[var(--muted)]">…</span>;
  }

  if (!authenticated || !addr) {
    return (
      <button
        type="button"
        onClick={() => login()}
        className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-[var(--fg)] hover:bg-white/10"
      >
        Connect
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="max-w-[140px] truncate text-xs text-[var(--muted)]" title={addr}>
        {addr.slice(0, 6)}…{addr.slice(-4)}
      </span>
      <button
        type="button"
        onClick={() => logout()}
        className="rounded-lg border border-white/10 px-2 py-1 text-xs text-[var(--muted)] hover:text-[var(--fg)]"
      >
        Log out
      </button>
    </div>
  );
}

export function WalletControls() {
  const configured = usePrivyConfigured();
  if (!configured) {
    return <span className="text-xs text-[var(--muted)]">No wallet</span>;
  }
  return <WalletControlsInner />;
}
