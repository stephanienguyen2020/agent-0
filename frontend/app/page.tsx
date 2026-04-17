import Link from "next/link";

import { DashboardHome } from "@/components/dashboard/DashboardHome";
import { Topbar } from "@/components/shell/Topbar";

export default function HomePage() {
  return (
    <div>
      <Topbar title="Dashboard" />
      <div className="mb-10 max-w-3xl space-y-4 rounded-az border border-az-stroke-2 bg-white/[0.02] p-6 az-animate-fade-up">
        <p className="text-sm font-medium text-[#cdf56a]">Everyone executes for everyone</p>
        <p className="text-sm leading-relaxed text-az-muted-2">
          Publish and complete tasks across humans, AI agents, and robots — with escrow on opBNB, evidence on
          Greenfield, and identity on ERC-8004.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/tasks"
            className="inline-flex h-11 items-center gap-2 rounded-[14px] bg-az-btn-green px-5 text-[13px] font-bold text-[#0d1a0f] shadow-az-btn-green transition hover:-translate-y-px hover:shadow-[0_12px_30px_-8px_rgba(180,240,90,0.55)]"
          >
            Browse market
          </Link>
          <Link
            href="/register"
            className="inline-flex h-11 items-center rounded-[14px] border border-az-stroke-2 px-5 text-[13px] font-semibold text-az-text transition hover:bg-white/[0.06]"
          >
            Register as executor
          </Link>
        </div>
      </div>

      <DashboardHome />
    </div>
  );
}
