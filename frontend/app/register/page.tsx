import { Topbar } from "@/components/shell/Topbar";
import { Card } from "@/components/ui/Card";

import { RegisterFlow } from "./RegisterFlow";

export default function RegisterPage() {
  return (
    <div className="max-w-3xl space-y-8">
      <Topbar title="Register" showSearch={false} />

      <section className="space-y-3 rounded-az border border-az-stroke-2 bg-white/[0.02] p-6 az-animate-fade-up">
        <p className="text-sm font-medium text-[#cdf56a]">Become an executor</p>
        <h2 className="text-xl font-bold tracking-tight text-az-text sm:text-2xl">
          Register with proof-of-personhood
        </h2>
        <p className="max-w-2xl text-sm leading-relaxed text-az-muted-2 [text-wrap:pretty]">
          Connect your wallet with Privy, then verify with World ID (IDKit v4). Your address is used as the signal so the
          backend can tie verification to your identity. Choose Orb verification when you want to qualify for high-bounty
          tasks that require it.
        </p>
      </section>

      <Card className="p-6 md:p-8">
        <RegisterFlow />
      </Card>

      <details className="rounded-az border border-az-stroke-2 bg-white/[0.02] px-5 py-4 text-sm text-az-muted-2">
        <summary className="cursor-pointer list-none font-semibold text-az-text hover:text-[#cdf56a] [&::-webkit-details-marker]:hidden">
          Developer setup (environment variables)
        </summary>
        <div className="mt-4 space-y-3 border-t border-az-stroke pt-4">
          <p>
            Backend: <code className="az-mono rounded bg-white/10 px-1.5 py-0.5 text-[13px] text-az-text">WORLD_ID_APP_ID</code>{" "}
            and <code className="az-mono rounded bg-white/10 px-1.5 py-0.5 text-[13px] text-az-text">WORLD_ID_RP_ID</code>{" "}
            (with matching frontend <code className="az-mono rounded bg-white/10 px-1.5 py-0.5 text-[13px] text-az-text">NEXT_PUBLIC_WORLD_ID_APP_ID</code>
            ). The Next.js server route{" "}
            <code className="az-mono rounded bg-white/10 px-1.5 py-0.5 text-[13px] text-az-text">POST /api/world-id/rp-context</code>{" "}
            requires <code className="az-mono rounded bg-white/10 px-1.5 py-0.5 text-[13px] text-az-muted">WORLD_ID_RP_SIGNING_KEY</code>.
          </p>
          <p className="text-xs leading-relaxed text-az-muted">
            IDKit forwards proofs to your backend <code className="az-mono rounded bg-white/10 px-1 py-0.5">POST /api/v1/world-id/verify</code> (v4 or legacy v2).
          </p>
        </div>
      </details>
    </div>
  );
}
