"use client";

import type { ReactNode } from "react";

import { AvatarChip } from "@/components/AvatarChip";
import { ThemeToggle } from "@/components/shell/ThemeToggle";

function IconSearch() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.6" />
      <path d="M20 20 L16 16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function IconBell() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M18 16 H6 L7 14 V10 A5 5 0 0 1 17 10 V14 Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M10 19 A2 2 0 0 0 14 19" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

export function DashboardTopbar({
  title,
  actions,
  showSearch = true,
}: {
  title: string;
  actions?: ReactNode;
  showSearch?: boolean;
}) {
  return (
    <header
      className="dashboard-reveal dashboard-reveal-d2 mb-5 flex min-w-0 flex-col gap-4 overflow-visible border-b border-[color:var(--line)] bg-[color:var(--bg)] py-4 backdrop-blur-[6px] sm:mb-7 sm:flex-row sm:items-center sm:gap-3.5 sm:py-5"
      style={{ position: "sticky", top: 0, zIndex: 10 }}
    >
      <div className="min-w-0 flex-1">
        <div
          className="break-words text-[clamp(24px,5.5vw,34px)] font-normal leading-[1.12] tracking-[-0.01em] text-[color:var(--ink)] sm:text-[clamp(28px,3.6vw,34px)] line-clamp-2 sm:line-clamp-none"
          style={{ fontFamily: "var(--font-instrument-serif), ui-serif, Georgia, serif" }}
        >
          {title}
        </div>
      </div>

      <div className="flex min-w-0 flex-wrap items-center justify-end gap-2 sm:shrink-0 sm:gap-2.5">
        {actions ? <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:flex-nowrap">{actions}</div> : null}
        {showSearch ? (
          <button type="button" aria-label="Search" className="dashboard-icon-btn hidden sm:grid">
            <IconSearch />
          </button>
        ) : null}
        {showSearch ? (
          <button type="button" aria-label="Notifications" className="dashboard-icon-btn hidden sm:grid">
            <span
              className="live-dot pointer-events-none absolute right-[9px] top-[7px] h-1.5 w-1.5 rounded-full bg-[color:var(--accent)]"
              aria-hidden
            />
            <IconBell />
          </button>
        ) : null}
        <ThemeToggle className="dashboard-icon-btn grid shrink-0" />
        <div className="min-w-0 shrink">
          <AvatarChip editorial />
        </div>
      </div>
    </header>
  );
}
