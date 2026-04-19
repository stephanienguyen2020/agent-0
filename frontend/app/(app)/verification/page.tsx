import { EditorialPageShell } from "@/components/dashboard/EditorialPageShell";
import { Card } from "@/components/ui/Card";

import { RegisterFlow } from "../register/RegisterFlow";
import { VerificationContent } from "./VerificationContent";

export default function VerificationPage() {
  return (
    <EditorialPageShell title="World ID" showSearch={false}>
      <section className="dashboard-reveal mb-8 space-y-3 rounded-[12px] border border-[color:var(--line)] bg-[color:var(--card)] p-6 shadow-[var(--shadow-soft)] sm:p-7">
        <p className="az-mono text-[10.5px] font-medium uppercase tracking-[0.14em] text-[color:var(--mute)]">
          Proof-of-personhood
        </p>
        <h2
          className="text-[clamp(20px,2.8vw,28px)] font-normal leading-[1.1] tracking-[-0.02em] text-[color:var(--ink)]"
          style={{ fontFamily: "var(--font-instrument-serif), ui-serif, Georgia, serif" }}
        >
          World ID status for your executor wallet
        </h2>
        <p className="max-w-4xl text-sm leading-[1.55] text-[color:var(--ink-2)] [text-wrap:pretty]">
          See your verification level and task eligibility below. Verify with World ID or upgrade from Device to Orb in
          the same place—scroll to{" "}
          <a href="#world-id-verify" className="text-[color:var(--ink)] underline underline-offset-2 hover:opacity-90">
            Verify or upgrade
          </a>
          .
        </p>
      </section>

      <Card className="mb-6 p-6 shadow-[var(--shadow-soft)] md:p-8">
        <h3 className="mb-6 text-[13px] font-semibold uppercase tracking-wide text-[color:var(--mute)]">
          Status
        </h3>
        <VerificationContent />
      </Card>

      <Card className="p-6 shadow-[var(--shadow-soft)] md:p-8">
        <h3 className="mb-6 text-[13px] font-semibold uppercase tracking-wide text-[color:var(--mute)]">
          Verify or upgrade
        </h3>
        <RegisterFlow />
      </Card>
    </EditorialPageShell>
  );
}
