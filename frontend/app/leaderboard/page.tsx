export default function LeaderboardPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Leaderboard</h1>
      <p className="text-[var(--muted)]">Reads from Supabase materialized view mv_executor_leaderboard.</p>
    </div>
  );
}
