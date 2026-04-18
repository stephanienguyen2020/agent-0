"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { BrandMark } from "@/components/brand/BrandMark";
import { useOptionalAppChrome } from "@/components/shell/app-chrome-context";

import {
  IconAgents,
  IconChat,
  IconDashboard,
  IconLeaderboard,
  IconLink,
  IconMarket,
  IconSettings,
  IconShield,
  IconTasks,
  IconWallet,
} from "@/components/icons/NavIcons";
import { SidebarDisconnect } from "@/components/shell/SidebarDisconnect";

function SidebarNavLink({
  href,
  active,
  title,
  children,
}: {
  href: string;
  active: boolean;
  title: string;
  children: ReactNode;
}) {
  const chrome = useOptionalAppChrome();
  return (
    <Link
      href={href}
      className="sidebar-nav-link border border-transparent"
      data-active={active ? "true" : undefined}
      title={title}
      onClick={() => chrome?.setMobileNavOpen(false)}
    >
      {children}
    </Link>
  );
}

function IconCollapse({ expanded }: { expanded: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      {expanded ? (
        <path
          d="M14 6 L8 12 L14 18"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="square"
          strokeLinejoin="miter"
        />
      ) : (
        <path
          d="M10 6 L16 12 L10 18"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="square"
          strokeLinejoin="miter"
        />
      )}
    </svg>
  );
}

export function Sidebar({ marketCount }: { marketCount?: number }) {
  const pathname = usePathname();
  const chrome = useOptionalAppChrome();
  const collapsed = chrome?.sidebarCollapsed ?? false;

  const activePrefix = (prefix: string) =>
    pathname === prefix || pathname.startsWith(`${prefix}/`);

  const marketActive = pathname === "/tasks" || /^\/tasks\/tk_/.test(pathname);

  useEffect(() => {
    chrome?.setMobileNavOpen(false);
  }, [pathname, chrome]);

  const mobileOpen = chrome?.mobileNavOpen ?? false;

  return (
    <nav
      data-collapsed={collapsed ? "true" : "false"}
      className={[
        "app-sidebar az-sidebar-scroll flex h-screen shrink-0 flex-col overflow-y-auto border-r py-6",
        "transition-[width,padding] duration-300 [transition-timing-function:cubic-bezier(0.22,0.61,0.36,1)]",
        "w-[min(280px,88vw)] sm:w-[232px]",
        collapsed ? "lg:w-[76px] lg:px-2" : "lg:w-[232px] lg:px-4",
        "max-lg:px-4",
        "fixed left-0 top-0 z-40 [transition-timing-function:cubic-bezier(0.2,0.9,0.2,1)] max-lg:transition-transform max-lg:duration-300",
        "shadow-[8px_0_32px_-12px_rgba(0,0,0,0.35)] lg:sticky lg:top-0 lg:z-20 lg:h-[100dvh] lg:max-h-[100dvh] lg:self-start lg:translate-x-0 lg:shadow-none",
        mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
      ].join(" ")}
      aria-label="Main"
      id="app-sidebar-nav"
    >
      <div className="mb-8 flex items-center gap-1 px-1 sm:gap-1.5 sm:px-2">
        <Link
          href="/"
          className={[
            "flex min-w-0 flex-1 items-center gap-2 py-1 transition-opacity hover:opacity-90",
            collapsed ? "lg:min-w-0 lg:justify-center" : "",
          ].join(" ")}
          title="Agent Zero home"
          onClick={() => chrome?.setMobileNavOpen(false)}
        >
          <BrandMark className={["shrink-0 text-[color:var(--ed-ink)]", collapsed ? "h-7 w-7 lg:h-7" : "h-8 w-8"].join(" ")} />
          <div
            className={["min-w-0", collapsed ? "lg:sr-only" : ""].filter(Boolean).join(" ")}
            style={{ lineHeight: 1 }}
          >
            <div className="font-mono text-[13px] font-bold tracking-[0.06em] text-[color:var(--ed-ink)]">
              AGENT<span className="text-[color:var(--ed-mute)]"> </span>ZERO
            </div>
          </div>
        </Link>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            className="hidden h-8 w-8 shrink-0 place-items-center rounded-lg border border-[color:var(--ed-line)] text-[color:var(--ed-ink)] transition hover:bg-[color:var(--ed-bg-2)] lg:grid"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            onClick={() => chrome?.toggleSidebarCollapsed()}
          >
            <IconCollapse expanded={!collapsed} />
          </button>
          <button
            type="button"
            className="grid h-8 w-8 place-items-center rounded-lg border border-[color:var(--ed-line)] text-[color:var(--ed-ink)] transition hover:bg-[color:var(--ed-bg-2)] lg:hidden"
            aria-label="Close menu"
            onClick={() => chrome?.setMobileNavOpen(false)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M6 6L18 18M18 6L6 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-0.5">
        <SidebarNavLink href="/dashboard" active={pathname === "/dashboard"} title="Dashboard">
          <IconDashboard className="h-4 w-4 shrink-0 opacity-90" />
          <span className="sidebar-nav-text">Dashboard</span>
        </SidebarNavLink>
        <SidebarNavLink href="/tasks" active={marketActive} title="Market">
          <IconMarket className="h-4 w-4 shrink-0 opacity-90" />
          <span className="sidebar-nav-text">Market</span>
          {marketCount != null && marketCount > 0 ? (
            <span className="ed-nav-badge">{marketCount > 99 ? "99+" : marketCount}</span>
          ) : null}
        </SidebarNavLink>
        <SidebarNavLink
          href="/tasks/chat"
          active={pathname === "/tasks/chat" || pathname.startsWith("/tasks/chat/")}
          title="Create with AI"
        >
          <IconChat className="h-4 w-4 shrink-0 opacity-90" />
          <span className="sidebar-nav-text">Create with AI</span>
        </SidebarNavLink>
        <SidebarNavLink href="/my-tasks" active={activePrefix("/my-tasks")} title="My tasks">
          <IconTasks className="h-4 w-4 shrink-0 opacity-90" />
          <span className="sidebar-nav-text">My Tasks</span>
        </SidebarNavLink>
        <SidebarNavLink href="/agents" active={activePrefix("/agents")} title="Agents">
          <IconAgents className="h-4 w-4 shrink-0 opacity-90" />
          <span className="sidebar-nav-text">Agents</span>
        </SidebarNavLink>
        <SidebarNavLink href="/wallet" active={activePrefix("/wallet")} title="Wallet">
          <IconWallet className="h-4 w-4 shrink-0 opacity-90" />
          <span className="sidebar-nav-text">Wallet</span>
        </SidebarNavLink>
        <SidebarNavLink href="/leaderboard" active={activePrefix("/leaderboard")} title="Leaderboard">
          <IconLeaderboard className="h-4 w-4 shrink-0 opacity-90" />
          <span className="sidebar-nav-text">Leaderboard</span>
        </SidebarNavLink>
      </div>

      <div
        className={["sidebar-nav-eyebrow mt-6 px-3 pb-1 pt-2", collapsed ? "lg:hidden" : ""].filter(Boolean).join(" ")}
      >
        Protocol
      </div>
      <div className="flex flex-col gap-0.5">
        <Link
          href="/register"
          className="sidebar-nav-link border border-transparent"
          data-active={activePrefix("/register") ? "true" : undefined}
          title="Register"
          onClick={() => chrome?.setMobileNavOpen(false)}
        >
          <IconShield className="h-4 w-4 shrink-0 opacity-90" />
          <span className="sidebar-nav-text">Register</span>
        </Link>
        <span className="sidebar-nav-link cursor-not-allowed opacity-[0.55]" title="IRC channels (soon)">
          <IconLink className="h-4 w-4 shrink-0 opacity-90" />
          <span className="sidebar-nav-text">IRC Channels</span>
        </span>
        <Link
          href="/verification"
          className="sidebar-nav-link border border-transparent"
          data-active={activePrefix("/verification") ? "true" : undefined}
          title="Verification"
          onClick={() => chrome?.setMobileNavOpen(false)}
        >
          <IconShield className="h-4 w-4 shrink-0 opacity-90" />
          <span className="sidebar-nav-text">Verification</span>
        </Link>
      </div>

      <div className="mt-auto border-t border-[color:var(--ed-line)] pt-4">
        <span className="sidebar-nav-link cursor-not-allowed opacity-[0.55]" title="Settings (soon)">
          <IconSettings className="h-4 w-4 shrink-0 opacity-90" />
          <span className="sidebar-nav-text">Settings</span>
        </span>
        <SidebarDisconnect />
      </div>
    </nav>
  );
}
