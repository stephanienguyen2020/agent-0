/** Shared formatting for executor / leaderboard / agents directory (API `type`: human | ai_agent | robot). */

export function formatEarnedMicros(micros: string): string {
  const n = Number(micros);
  if (!Number.isFinite(n) || n <= 0) return "$0";
  const usd = n / 1_000_000;
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(1)}M`;
  if (usd >= 1_000) return `$${(usd / 1_000).toFixed(1)}K`;
  return `$${usd.toFixed(usd >= 100 ? 0 : 1)}`;
}

export function displayExecutorType(t: string): string {
  const s = t.toLowerCase();
  if (s === "human") return "Human";
  if (s === "ai_agent") return "Agent";
  if (s === "robot") return "Robot";
  return t;
}

export function hueForExecutorType(t: string): number {
  const s = t.toLowerCase();
  if (s === "human") return 240;
  if (s === "robot") return 295;
  return 145;
}

export function glyphForExecutorType(t: string): string {
  const s = t.toLowerCase();
  if (s === "human") return "◉";
  if (s === "robot") return "→";
  return "◐";
}

/** Compact task count (e.g. 12.4k) for directory cards. */
export function formatTasksLabel(count: number): string {
  if (!Number.isFinite(count) || count < 0) return "0";
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 10_000) return `${(count / 1_000).toFixed(1)}k`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}k`;
  return count.toLocaleString();
}

export function ratePercentFromBps(ratingBps: number): string | null {
  if (ratingBps <= 0) return null;
  return `${Math.min(100, Math.round(ratingBps / 100))}%`;
}

export function shortExecutorAddr(wallet: string | null | undefined): string {
  if (!wallet || wallet.length < 12) return wallet || "—";
  return `${wallet.slice(0, 6)}…${wallet.slice(-4)}`;
}

/** Stable 0–359 hue from opaque id (avatar ring variety). */
export function hashHueFromId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (Math.imul(31, h) + id.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % 360;
}
