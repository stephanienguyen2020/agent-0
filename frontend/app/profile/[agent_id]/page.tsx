import { Card } from "@/components/ui/Card";
import { Topbar } from "@/components/shell/Topbar";

export default async function ProfilePage({ params }: { params: Promise<{ agent_id: string }> }) {
  const { agent_id } = await params;
  return (
    <div className="max-w-2xl space-y-4">
      <Topbar title="Profile" showSearch={false} />
      <Card className="p-5">
        <p className="text-sm text-az-muted-2">
          ERC-8004 agent id: <span className="az-mono font-semibold text-az-text">{agent_id}</span>
        </p>
      </Card>
    </div>
  );
}
