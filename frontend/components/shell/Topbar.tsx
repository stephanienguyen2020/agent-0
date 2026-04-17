import type { ReactNode } from "react";

import { AvatarChip } from "@/components/AvatarChip";
import { IconButton } from "@/components/ui/Button";

function IconSearch() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
      <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconBell() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Topbar({
  title,
  actions,
  showSearch = true,
}: {
  title: string;
  actions?: ReactNode;
  showSearch?: boolean;
}) {
  return (
    <div className="mb-7 flex min-w-0 items-center justify-between gap-4">
      <h1 className="min-w-0 text-[26px] font-extrabold tracking-tight text-az-text">{title}</h1>
      <div className="flex shrink-0 items-center gap-2.5">
        {actions}
        {showSearch && (
          <IconButton type="button" aria-label="Search" className="hidden sm:flex">
            <IconSearch />
          </IconButton>
        )}
        {showSearch && (
          <IconButton type="button" aria-label="Notifications" className="hidden sm:flex">
            <IconBell />
          </IconButton>
        )}
        <AvatarChip />
      </div>
    </div>
  );
}

/** Topbar without duplicate wallet row (parent supplies right side). */
export function TopbarSimple({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-7 flex min-w-0 items-center justify-between gap-4">
      <h1 className="min-w-0 text-[26px] font-extrabold tracking-tight text-az-text">{title}</h1>
      {children ? <div className="flex shrink-0 items-center gap-2.5">{children}</div> : null}
    </div>
  );
}
