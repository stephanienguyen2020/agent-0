import { EditorialPageShell } from "@/components/dashboard/EditorialPageShell";
import { Card } from "@/components/ui/Card";

export default function DisputesPage() {
  return (
    <EditorialPageShell title="Disputes" showSearch={false}>
      <div className="max-w-2xl">
        <Card className="p-6 shadow-[var(--shadow-soft)]">
          <p className="text-sm leading-relaxed text-[color:var(--ink-2)]">
            Arbitration scaffold (
            <code className="az-mono rounded-md border border-[color:var(--line)] bg-[color:var(--bg-2)] px-1.5 py-0.5 text-[12px] text-[color:var(--ink)]">
              EMArbitration.sol
            </code>{" "}
            + dispute rows). Wire this view to on-chain events and Supabase when available.
          </p>
        </Card>
      </div>
    </EditorialPageShell>
  );
}
