import type { ReactNode } from "react";

import { DashboardTopbar } from "@/components/dashboard/DashboardTopbar";

/**
 * Wraps in-app routes with the editorial canvas (design.md tokens + DashboardTopbar).
 * Theme follows `html[data-theme]` via `.dashboard-editorial` in globals.css.
 */
export function EditorialPageShell({
  title,
  actions,
  showSearch = true,
  children,
}: {
  title: string;
  actions?: ReactNode;
  showSearch?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={[
        "dashboard-editorial flex min-h-full flex-1 flex-col",
        "-mx-4 -my-4 px-4 py-5 sm:-mx-6 sm:-my-6 sm:px-6 sm:py-7 md:-mx-8 md:px-8 md:py-7",
      ].join(" ")}
    >
      <DashboardTopbar title={title} actions={actions} showSearch={showSearch} />
      <div className="mx-auto w-full max-w-[1360px] flex-1 pb-8 sm:pb-10">{children}</div>
    </div>
  );
}
