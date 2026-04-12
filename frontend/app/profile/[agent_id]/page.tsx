export default async function ProfilePage({ params }: { params: Promise<{ agent_id: string }> }) {
  const { agent_id } = await params;
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold">Profile</h1>
      <p className="text-[var(--muted)]">ERC-8004 agent id: {agent_id}</p>
    </div>
  );
}
