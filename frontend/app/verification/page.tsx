import { Topbar } from "@/components/shell/Topbar";
import { Card } from "@/components/ui/Card";

import { VerificationContent } from "./VerificationContent";

export default function VerificationPage() {
  return (
    <div className="w-full space-y-8">
      <Topbar title="Verification" showSearch={false} />

      <section className="space-y-3 rounded-az border border-az-stroke-2 bg-white/[0.02] p-6 az-animate-fade-up">
        <p className="text-sm font-medium text-[#cdf56a]">Proof-of-personhood</p>
        <h2 className="text-xl font-bold tracking-tight text-az-text sm:text-2xl">
          World ID status for your executor wallet
        </h2>
        <p className="max-w-4xl text-sm leading-relaxed text-az-muted-2 [text-wrap:pretty]">
          See your current verification level and what you can do on the market. To verify with World
          ID or upgrade from Device to Orb, use{" "}
          <span className="text-az-text">Register</span> in the sidebar.
        </p>
      </section>

      <Card className="p-6 md:p-8">
        <VerificationContent />
      </Card>
    </div>
  );
}
