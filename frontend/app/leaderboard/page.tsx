import { Leaderboard } from "@/components/leaderboard/Leaderboard";
import { Topbar } from "@/components/shell/Topbar";

export default function LeaderboardPage() {
  return (
    <div>
      <Topbar title="Leaderboard" />
      <Leaderboard />
    </div>
  );
}
