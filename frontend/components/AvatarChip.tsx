"use client";

import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useAccount, useChainId } from "wagmi";

import { opBNBTestnet } from "@/lib/chains";
import { usePrivyConfigured } from "@/app/providers";

function shortAddr(a: string) {
  if (a.length < 10) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function AvatarChip() {
  const configured = usePrivyConfigured();
  const { ready, authenticated, login } = usePrivy();
  const { address } = useAccount();
  const { wallets } = useWallets();
  const chainId = useChainId();

  const addr =
    address || (wallets[0]?.address as string | undefined) || undefined;

  const chainLabel =
    chainId === opBNBTestnet.id ? "opBNB Testnet" : chainId ? `Chain ${chainId}` : "—";

  if (!configured) {
    return (
      <div className="flex cursor-default items-center gap-2.5 rounded-full border border-az-stroke-2 bg-white/[0.04] py-1.5 pl-1.5 pr-3.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#9945ff] to-[#14f195] text-[11px] font-bold text-white">
          —
        </div>
        <div className="leading-tight">
          <div className="text-[13px] font-semibold text-az-text">No wallet</div>
          <div className="text-[10px] text-az-muted">Set NEXT_PUBLIC_PRIVY_APP_ID</div>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="rounded-full border border-az-stroke-2 px-3 py-2 text-xs text-az-muted-2">…</div>
    );
  }

  if (!authenticated || !addr) {
    return (
      <button
        type="button"
        onClick={() => login()}
        className="flex items-center gap-2.5 rounded-full border border-az-stroke-2 bg-white/[0.04] py-1.5 pl-1.5 pr-3.5 text-left transition hover:bg-white/[0.08]"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#9945ff] to-[#14f195] text-[11px] font-bold text-white">
          +
        </div>
        <div className="leading-tight">
          <div className="text-[13px] font-semibold text-az-text">Connect</div>
          <div className="text-[10px] text-az-muted">{chainLabel}</div>
        </div>
      </button>
    );
  }

  return (
    <div className="flex cursor-default items-center gap-2.5 rounded-full border border-az-stroke-2 bg-white/[0.04] py-1.5 pl-1.5 pr-3.5">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#9945ff] to-[#14f195] text-[11px] font-bold text-white">
        0x
      </div>
      <div className="min-w-0 leading-tight">
        <div className="truncate text-[13px] font-semibold text-az-text" title={addr}>
          {shortAddr(addr)}
        </div>
        <div className="text-[10px] text-az-muted">{chainLabel}</div>
      </div>
    </div>
  );
}
