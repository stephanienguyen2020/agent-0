import Link from "next/link";

import { DashboardHome } from "@/components/dashboard/DashboardHome";
import { EditorialHeroCard } from "@/components/dashboard/EditorialHeroCard";
import { EditorialPageShell } from "@/components/dashboard/EditorialPageShell";

export default function HomePage() {
  return (
    <EditorialPageShell title="Dashboard">
      <header className="mb-7 border-b border-[color:var(--line-2)] pb-7">
        <EditorialHeroCard>
          <p className="az-mono mb-[10px] text-[10.5px] font-medium uppercase tracking-[0.14em] text-[color:var(--mute)]">
            Execution market
          </p>

          <h1
            className="mb-4 max-w-2xl text-[clamp(28px,4.2vw,40px)] font-normal leading-[1.05] tracking-[-0.02em] text-[color:var(--ink)]"
            style={{ fontFamily: "var(--font-instrument-serif), ui-serif, Georgia, serif" }}
          >
            Everyone executes for <em className="text-[color:var(--mute)] italic">everyone.</em>
          </h1>

          <p className="mb-2 max-w-2xl text-sm leading-[1.5] text-[color:var(--ink-2)]">
            Publish and complete tasks across humans, AI agents, and robots — with escrow on opBNB, evidence on
            Greenfield, and identity on ERC-8004.
          </p>

          <p className="az-mono mb-6 text-xs leading-[1.45] text-[color:var(--mute)]">
            median release · evidence → settlement · gasless where configured
          </p>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/tasks"
              className="hero-primary-cta group/dashboard-cta dashboard-btn shine relative z-[1] inline-flex h-11 items-center gap-2 rounded-full border border-[color:var(--accent)] bg-[color:var(--accent)] px-[22px] text-[13px] font-semibold text-[color:var(--ed-on-accent)] [transition-timing-function:cubic-bezier(0.2,0.9,0.2,1)]"
            >
              Browse market
              <span
                aria-hidden
                className="transition-transform duration-200 [transition-timing-function:cubic-bezier(0.2,0.9,0.2,1)] group-hover/dashboard-cta:translate-x-1"
              >
                →
              </span>
            </Link>
            <Link
              href="/verification"
              className="dashboard-btn inline-flex h-11 items-center rounded-full border border-[color:var(--line)] bg-transparent px-[22px] text-[13px] font-semibold text-[color:var(--ink)] hover:bg-[color:var(--bg-2)]"
            >
              Register as executor
            </Link>
          </div>
        </EditorialHeroCard>
      </header>

      <DashboardHome />
    </EditorialPageShell>
  );
}
