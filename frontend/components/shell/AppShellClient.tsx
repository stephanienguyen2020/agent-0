"use client";

import type { ReactNode } from "react";

import { AppChromeProvider, useAppChrome } from "@/components/shell/app-chrome-context";
import { Sidebar } from "@/components/shell/Sidebar";

function MobileNavBackdrop() {
  const { mobileNavOpen, setMobileNavOpen } = useAppChrome();
  if (!mobileNavOpen) return null;
  return (
    <button
      type="button"
      aria-label="Close navigation menu"
      className="fixed inset-0 z-[35] bg-black/45 backdrop-blur-[4px] lg:hidden"
      onClick={() => setMobileNavOpen(false)}
    />
  );
}

function AppShellInner({ marketCount, children }: { marketCount?: number; children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <MobileNavBackdrop />
      <Sidebar marketCount={marketCount} />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col px-4 pb-6 pt-4 sm:px-6 sm:pb-7 sm:pt-6 md:px-8 md:pb-8 md:pt-7">
        {children}
      </div>
    </div>
  );
}

export function AppShellClient({
  marketCount,
  children,
}: {
  marketCount?: number;
  children: ReactNode;
}) {
  return (
    <AppChromeProvider>
      <AppShellInner marketCount={marketCount}>{children}</AppShellInner>
    </AppChromeProvider>
  );
}
