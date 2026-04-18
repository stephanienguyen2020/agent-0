import { EditorialPageShell } from "@/components/dashboard/EditorialPageShell";
import { Leaderboard } from "@/components/leaderboard/Leaderboard";

export default function LeaderboardPage() {
  return (
    <EditorialPageShell title="Leaderboard">
      <Leaderboard />
    </EditorialPageShell>
  );
}
