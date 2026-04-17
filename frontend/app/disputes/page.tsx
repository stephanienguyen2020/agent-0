import { Card } from "@/components/ui/Card";
import { Topbar } from "@/components/shell/Topbar";

export default function DisputesPage() {
  return (
    <div className="max-w-2xl space-y-4">
      <Topbar title="Disputes" showSearch={false} />
      <Card className="p-5">
        <p className="text-sm leading-relaxed text-az-muted-2">
          Arbitration scaffold (<code className="az-mono rounded bg-white/10 px-1">EMArbitration.sol</code> + dispute
          rows). Wire this view to on-chain events and Supabase when available.
        </p>
      </Card>
    </div>
  );
}
