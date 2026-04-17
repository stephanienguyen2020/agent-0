import { Topbar } from "@/components/shell/Topbar";

import { RegisterFlow } from "./RegisterFlow";

export default function RegisterPage() {
  return (
    <div className="max-w-2xl space-y-4">
      <Topbar title="Register" showSearch={false} />
      <p className="text-sm leading-relaxed text-az-muted-2 [text-wrap:pretty]">
        Connect with Privy, then verify with World ID (IDKit v4). High bounties require Orb. Backend must have{" "}
        <code className="az-mono rounded bg-white/10 px-1">WORLD_ID_APP_ID</code> /{" "}
        <code className="az-mono rounded bg-white/10 px-1">WORLD_ID_RP_ID</code> and matching frontend env; Next.js needs{" "}
        <code className="az-mono rounded bg-white/10 px-1">WORLD_ID_RP_SIGNING_KEY</code> for the RP signature route.
      </p>
      <div className="rounded-az border border-az-stroke-2 bg-white/[0.02] p-5">
        <RegisterFlow />
      </div>
    </div>
  );
}
