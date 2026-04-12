import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Execution Market",
  description: "Universal execution layer for humans, agents, and robots",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <header className="border-b border-white/10 px-6 py-4">
          <nav className="mx-auto flex max-w-5xl flex-wrap items-center gap-4 text-sm">
            <Link href="/" className="font-semibold text-[var(--accent)]">
              Execution Market
            </Link>
            <Link href="/tasks" className="text-[var(--muted)] hover:text-[var(--fg)]">
              Tasks
            </Link>
            <Link href="/dashboard/executor" className="text-[var(--muted)] hover:text-[var(--fg)]">
              Executor
            </Link>
            <Link href="/dashboard/agent" className="text-[var(--muted)] hover:text-[var(--fg)]">
              Agent
            </Link>
            <Link href="/leaderboard" className="text-[var(--muted)] hover:text-[var(--fg)]">
              Leaderboard
            </Link>
            <Link href="/register" className="text-[var(--muted)] hover:text-[var(--fg)]">
              Register
            </Link>
          </nav>
        </header>
        <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
      </body>
    </html>
  );
}
