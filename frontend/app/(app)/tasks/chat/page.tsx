import { EditorialPageShell } from "@/components/dashboard/EditorialPageShell";
import { ChatTaskPanel } from "@/components/tasks/ChatTaskPanel";

export default function TasksChatPage() {
  return (
    <EditorialPageShell title="Create with AI" showSearch={false}>
      <section
        className="dashboard-reveal dashboard-reveal-d1 mb-6 space-y-3 rounded-[14px] border px-5 py-5 sm:px-6 sm:py-6"
        style={{
          borderColor: "var(--line)",
          background: "var(--card)",
          boxShadow: "var(--shadow-soft)",
        }}
      >
        <p className="az-mono text-[10.5px] uppercase tracking-[0.14em]" style={{ color: "var(--accent)" }}>
          Natural language → draft → publish
        </p>
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl" style={{ color: "var(--ink)", letterSpacing: "-0.01em" }}>
          Describe a task in chat
        </h2>
        <p className="max-w-4xl text-sm leading-relaxed [text-wrap:pretty]" style={{ color: "var(--ink-2)" }}>
          The API turns your conversation into a validated task draft (title, instructions, category, USDC bounty,
          deadline). Connect your wallet and publish with the same EIP-3009 x402 flow as{" "}
          <span style={{ color: "var(--ink)" }}>Post a task</span>.
        </p>
        <p className="max-w-4xl text-xs leading-relaxed [text-wrap:pretty]" style={{ color: "var(--mute)" }}>
          Requires <code className="rounded px-1 py-0.5 font-mono text-[11px]">GEMINI_API_KEY</code> on the FastAPI
          server. If drafting is unavailable, you will see a clear error from the API (often HTTP 503).
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
        <ChatTaskPanel />
      </div>
    </EditorialPageShell>
  );
}
