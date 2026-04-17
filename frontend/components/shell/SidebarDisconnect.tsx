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
        className="sidebar-nav-link mt-0.5 w-full cursor-not-allowed opacity-50"
        title="Disconnect"
      >
        <IconLogout className="h-4 w-4 shrink-0 opacity-90" />
        <span className="sidebar-nav-text">Disconnect</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => logout()}
      className="sidebar-nav-link mt-0.5 w-full text-left text-[color:var(--ed-mute)] transition hover:text-[color:var(--ed-ink)]"
      title="Disconnect wallet"
    >
      <IconLogout className="h-4 w-4 shrink-0 opacity-90" />
      <span className="sidebar-nav-text">Disconnect</span>
    </button>
  );
}
