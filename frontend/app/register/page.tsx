import { Topbar } from "@/components/shell/Topbar";
import { Card } from "@/components/ui/Card";

import { RegisterFlow } from "./RegisterFlow";

export default function RegisterPage() {
  return (
    <div className="w-full space-y-8">
      <Topbar title="Register" showSearch={false} />

      <section className="space-y-3 rounded-az border border-az-stroke-2 bg-white/[0.02] p-6 az-animate-fade-up">
        <p className="text-sm font-medium text-[#cdf56a]">Become an executor</p>
        <h2 className="text-xl font-bold tracking-tight text-az-text sm:text-2xl">
          Register with proof-of-personhood
        </h2>
        <p className="max-w-4xl text-sm leading-relaxed text-az-muted-2 [text-wrap:pretty]">
          Connect your wallet with Privy, then verify with World ID (IDKit v4).
          Your address is used as the signal so the backend can tie verification
          to your identity. Choose Orb verification when you want to qualify for
          high-bounty tasks that require it.
        </p>
      </section>

      <Card className="p-6 md:p-8">
        <RegisterFlow />
      </Card>
    </div>
  );
}
