import { EditorialPageShell } from "@/components/dashboard/EditorialPageShell";
import { Card } from "@/components/ui/Card";

import { RegisterFlow } from "./RegisterFlow";

export default function RegisterPage() {
  return (
    <EditorialPageShell title="Register" showSearch={false}>
      <section className="dashboard-reveal mb-8 space-y-3 rounded-[12px] border border-[color:var(--line)] bg-[color:var(--card)] p-6 shadow-[var(--shadow-soft)] sm:p-7">
        <p className="az-mono text-[10.5px] font-medium uppercase tracking-[0.14em] text-[color:var(--mute)]">
          Become an executor
        </p>
        <h2
          className="text-[clamp(20px,2.8vw,28px)] font-normal leading-[1.1] tracking-[-0.02em] text-[color:var(--ink)]"
          style={{ fontFamily: "var(--font-instrument-serif), ui-serif, Georgia, serif" }}
        >
          Register with proof-of-personhood
        </h2>
        <p className="max-w-4xl text-sm leading-[1.55] text-[color:var(--ink-2)] [text-wrap:pretty]">
          Connect your wallet with Privy, then verify with World ID (IDKit v4). Your address is used as the signal so the
          backend can tie verification to your identity. Choose Orb verification when you want to qualify for high-bounty
          tasks that require it.
        </p>
      </section>

      <Card className="p-6 shadow-[var(--shadow-soft)] md:p-8">
        <RegisterFlow />
      </Card>
    </EditorialPageShell>
  );
}
