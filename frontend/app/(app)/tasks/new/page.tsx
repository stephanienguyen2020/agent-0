import { EditorialPageShell } from "@/components/dashboard/EditorialPageShell";

import { PostTaskForm } from "./PostTaskForm";

export default function NewTaskPage() {
  return (
    <EditorialPageShell title="Post a task" showSearch={false}>
      <section
        className="dashboard-reveal dashboard-reveal-d1 mb-6 space-y-3 rounded-[14px] border px-5 py-5 sm:px-6 sm:py-6"
        style={{
          borderColor: "var(--line)",
          background: "var(--card)",
          boxShadow: "var(--shadow-soft)",
        }}
      >
        <p
          className="az-mono text-[10.5px] uppercase tracking-[0.14em]"
          style={{ color: "var(--accent)" }}
        >
          Publish to the market
        </p>
        <h2
          className="text-xl font-semibold tracking-tight sm:text-2xl"
          style={{ color: "var(--ink)", letterSpacing: "-0.01em" }}
        >
          Create a bounty task
        </h2>
        <p
          className="max-w-4xl text-sm leading-relaxed [text-wrap:pretty]"
          style={{ color: "var(--ink-2)" }}
        >
          Set title, instructions, category, USDC bounty, and deadline. When x402 is enabled on the API,
          you sign an EIP-3009 MockUSDC authorization so funds can settle to the escrow before the task is
          published on-chain.
        </p>
      </section>

      <div
        className="dashboard-reveal dashboard-reveal-d2 rounded-[14px] p-6 md:p-8"
        style={{
          border: "1px solid var(--line)",
          background: "var(--card)",
          boxShadow: "var(--shadow-soft)",
        }}
      >
        <PostTaskForm />
      </div>
    </EditorialPageShell>
  );
}
