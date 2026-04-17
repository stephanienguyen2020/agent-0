"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  IconAgents,
  IconDashboard,
  IconLeaderboard,
  IconLink,
  IconMarket,
  IconSettings,
  IconShield,
  IconTasks,
  IconWallet,
  LogoMark,
} from "@/components/icons/NavIcons";
import { NavBadge } from "@/components/ui/Badge";
import { SidebarDisconnect } from "@/components/shell/SidebarDisconnect";

function NavLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-[14px] border border-transparent px-3.5 py-[11px] text-[13.5px] font-medium text-az-muted-2 transition hover:bg-white/[0.03] hover:text-az-text ${
        active ? "az-nav-active" : ""
      }`}
    >
      {children}
    </Link>
  );
}

export function Sidebar({ marketCount }: { marketCount?: number }) {
  const pathname = usePathname();

  const activePrefix = (prefix: string) =>
    prefix === "/"
      ? pathname === "/"
      : pathname === prefix || pathname.startsWith(`${prefix}/`);

  return (
    <nav
      className="sticky top-0 flex h-screen w-[240px] shrink-0 flex-col overflow-y-auto border-r border-az-stroke px-4 py-6"
      aria-label="Main"
    >
      <Link href="/" className="mb-8 flex items-center gap-2.5 px-2 py-1">
        <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-az-green">
          <LogoMark className="h-[18px] w-[18px]" />
        </div>
        <span className="text-[15px] font-extrabold tracking-[1.5px] text-az-text">AGENTZERO</span>
      </Link>

      <div className="flex flex-col gap-1">
        <NavLink href="/" active={pathname === "/"}>
          <IconDashboard className="h-[18px] w-[18px] shrink-0" />
          Dashboard
        </NavLink>
        <NavLink href="/tasks" active={pathname === "/tasks" || pathname.startsWith("/tasks/")}>
          <IconMarket className="h-[18px] w-[18px] shrink-0" />
          Market
          {marketCount != null && marketCount > 0 ? <NavBadge>{marketCount > 99 ? "99+" : marketCount}</NavBadge> : null}
        </NavLink>
        <NavLink href="/my-tasks" active={activePrefix("/my-tasks")}>
          <IconTasks className="h-[18px] w-[18px] shrink-0" />
          My Tasks
        </NavLink>
        <NavLink href="/agents" active={activePrefix("/agents")}>
          <IconAgents className="h-[18px] w-[18px] shrink-0" />
          Agents
        </NavLink>
        <NavLink href="/wallet" active={activePrefix("/wallet")}>
          <IconWallet className="h-[18px] w-[18px] shrink-0" />
          Wallet
        </NavLink>
        <NavLink href="/leaderboard" active={activePrefix("/leaderboard")}>
          <IconLeaderboard className="h-[18px] w-[18px] shrink-0" />
          Leaderboard
        </NavLink>
      </div>

      <div className="mt-5 px-3.5 pb-2 pt-5 text-[10px] font-bold uppercase tracking-[1.5px] text-az-muted">
        Protocol
      </div>
      <div className="flex flex-col gap-1">
        <Link
          href="/register"
          className={`flex items-center gap-3 rounded-[14px] border border-transparent px-3.5 py-[11px] text-[13.5px] font-medium transition hover:bg-white/[0.03] hover:text-az-text ${
            activePrefix("/register") ? "az-nav-active text-az-text" : "text-az-muted-2"
          }`}
        >
          <IconShield className="h-[18px] w-[18px] shrink-0" />
          Register
        </Link>
        <span className="flex cursor-not-allowed items-center gap-3 rounded-[14px] px-3.5 py-[11px] text-[13.5px] font-medium text-az-muted-2/70">
          <IconLink className="h-[18px] w-[18px] shrink-0" />
          IRC Channels
        </span>
        <Link
          href="/verification"
          className={`flex items-center gap-3 rounded-[14px] border border-transparent px-3.5 py-[11px] text-[13.5px] font-medium transition hover:bg-white/[0.03] hover:text-az-text ${
            activePrefix("/verification") ? "az-nav-active text-az-text" : "text-az-muted-2"
          }`}
        >
          <IconShield className="h-[18px] w-[18px] shrink-0" />
          Verification
        </Link>
      </div>

      <div className="mt-auto border-t border-az-stroke pt-5">
        <span className="flex cursor-not-allowed items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-[13px] text-az-muted-2/70">
          <IconSettings className="h-4 w-4 shrink-0" />
          Settings
        </span>
        <SidebarDisconnect />
      </div>
    </nav>
  );
}
