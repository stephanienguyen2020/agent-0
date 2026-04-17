"use client";

import { usePrivy } from "@privy-io/react-auth";

import { IconLogout } from "@/components/icons/NavIcons";
import { usePrivyConfigured } from "@/app/providers";

export function SidebarDisconnect() {
  const configured = usePrivyConfigured();
  const { ready, authenticated, logout } = usePrivy();

  if (!configured || !ready || !authenticated) {
    return (
      <button
        type="button"
        disabled
        className="flex w-full cursor-not-allowed items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-[13px] text-az-muted-2 opacity-60"
      >
        <IconLogout className="h-4 w-4 shrink-0" />
        Disconnect
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => logout()}
      className="flex w-full items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-left text-[13px] text-az-muted-2 transition hover:text-az-text"
    >
      <IconLogout className="h-4 w-4 shrink-0" />
      Disconnect
    </button>
  );
}
