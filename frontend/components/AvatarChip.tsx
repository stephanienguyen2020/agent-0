"use client";

import type { ReactNode } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useAccount, useChainId, useSwitchChain } from "wagmi";

import { opBNBTestnet } from "@/lib/chains";
import { usePrivyConfigured } from "@/app/providers";

function EditorialAvatarDisc({ children }: { children?: ReactNode }) {
  return (
    <span className="editorial-avatar-wrap">
      <span className="editorial-avatar-glow" aria-hidden />
      <span className="editorial-wallet-avatar">{children}</span>
    </span>
  );
}

function shortAddr(a: string) {
  if (a.length < 10) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function AvatarChip({ editorial = false }: { editorial?: boolean } = {}) {
  const configured = usePrivyConfigured();
  const { ready, authenticated, login } = usePrivy();
  const { address } = useAccount();
  const { wallets } = useWallets();
  const chainId = useChainId();
  const { switchChainAsync, isPending: switching } = useSwitchChain();

  const addr =
    address || (wallets[0]?.address as string | undefined) || undefined;

  const wrongChain = Boolean(chainId && chainId !== opBNBTestnet.id);

  const chainLabel =
    chainId === opBNBTestnet.id
      ? "opBNB Testnet"
      : chainId
        ? `Chain ${chainId}`
        : "—";

  const shellChip =
    "flex min-w-0 items-center gap-2.5 rounded-full border py-1.5 pl-1.5 pr-3.5";
  const chipWrap = editorial
    ? `${shellChip} min-w-0 max-w-[11rem] overflow-visible border-[color:var(--line)] bg-[color:var(--card)] sm:max-w-none`
    : `${shellChip} border-az-stroke-2 bg-white/[0.04]`;
  const shellAvatar = editorial ? (
    <EditorialAvatarDisc>—</EditorialAvatarDisc>
  ) : (
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#9945ff] to-[#14f195] text-[11px] font-bold text-white">
      —
    </div>
  );

  if (!configured) {
    return (
      <div className={`flex cursor-default items-center gap-2.5 ${chipWrap}`}>
        {shellAvatar}
        <div className="leading-tight">
          <div
            className={`text-[13px] font-semibold ${editorial ? "text-[color:var(--ink)]" : "text-az-text"}`}
          >
            No wallet
          </div>
          <div
            className={`text-[10px] ${editorial ? "text-[color:var(--mute)]" : "text-az-muted"}`}
          >
            Set NEXT_PUBLIC_PRIVY_APP_ID
          </div>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div
        className={`rounded-full border px-3 py-2 text-xs ${
          editorial
            ? "border-[color:var(--line)] text-[color:var(--mute)]"
            : "border-az-stroke-2 text-az-muted-2"
        }`}
      >
        …
      </div>
    );
  }

  if (!authenticated || !addr) {
    return (
      <button
        type="button"
        onClick={() => login()}
        className={`flex items-center gap-2.5 rounded-full border py-1.5 pl-1.5 pr-3.5 text-left transition ${
          editorial
            ? "dashboard-btn border-[color:var(--line)] bg-[color:var(--card)] hover:bg-[color:var(--bg-2)]"
            : "border-az-stroke-2 bg-white/[0.04] hover:bg-white/[0.08]"
        }`}
      >
        {editorial ? (
          <EditorialAvatarDisc>+</EditorialAvatarDisc>
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#9945ff] to-[#14f195] text-[11px] font-bold text-white">
            +
          </div>
        )}
        <div className="leading-tight">
          <div
            className={`text-[13px] font-semibold ${editorial ? "text-[color:var(--ink)]" : "text-az-text"}`}
          >
            Connect
          </div>
          <div
            className={`text-[10px] ${editorial ? "text-[color:var(--mute)]" : "text-az-muted"}`}
          >
            {chainLabel}
          </div>
        </div>
      </button>
    );
  }

  return (
    <div className="flex cursor-default items-center gap-2">
      <div className={chipWrap}>
        {editorial ? (
          <EditorialAvatarDisc />
        ) : (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#9945ff] to-[#14f195] text-[11px] font-bold text-white">
            0x
          </div>
        )}
        <div className="min-w-0 leading-tight">
          <div
            className={`truncate text-[13px] font-semibold ${editorial ? "text-[color:var(--ink)]" : "text-az-text"}`}
            title={addr}
          >
            {shortAddr(addr)}
          </div>
          <div
            className={`truncate text-[10px] ${wrongChain ? "text-amber-300/90" : editorial ? "text-[color:var(--mute)]" : "text-az-muted"}`}
            title={
              wrongChain ? "Agent Zero uses opBNB Testnet (5611)" : undefined
            }
          >
            {chainLabel}
          </div>
        </div>
      </div>
      {wrongChain ? (
        <button
          type="button"
          disabled={switching}
          onClick={() => void switchChainAsync({ chainId: opBNBTestnet.id })}
          className="shrink-0 rounded-full border border-amber-400/40 bg-amber-500/15 px-3 py-1.5 text-[10px] font-bold text-amber-200 transition hover:bg-amber-500/25 disabled:opacity-50"
        >
          {switching ? "…" : "Use opBNB Testnet"}
        </button>
      ) : null}
    </div>
  );
}
