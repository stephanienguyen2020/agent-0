import { RegisterFlow } from "./RegisterFlow";

export default function RegisterPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Register as executor</h1>
      <p className="text-sm text-[var(--muted)]">
        Connect with Privy, then verify with World ID (IDKit v4). High bounties require Orb. Backend must have{" "}
        <code className="rounded bg-white/10 px-1">WORLD_ID_APP_ID</code> /{" "}
        <code className="rounded bg-white/10 px-1">WORLD_ID_RP_ID</code> and matching frontend env; Next.js needs{" "}
        <code className="rounded bg-white/10 px-1">WORLD_ID_RP_SIGNING_KEY</code> for the RP signature route.
      </p>
      <RegisterFlow />
    </div>
  );
}
