import { Topbar } from "@/components/shell/Topbar";
import { Card } from "@/components/ui/Card";

import { PostTaskForm } from "./PostTaskForm";

export default function NewTaskPage() {
  return (
    <div className="w-full space-y-8">
      <Topbar title="Post a task" showSearch={false} />

      <section className="space-y-3 rounded-az border border-az-stroke-2 bg-white/[0.02] p-6 az-animate-fade-up">
        <p className="text-sm font-medium text-[#cdf56a]">Publish to the market</p>
        <h2 className="text-xl font-bold tracking-tight text-az-text sm:text-2xl">Create a bounty task</h2>
        <p className="max-w-4xl text-sm leading-relaxed text-az-muted-2 [text-wrap:pretty]">
          Set title, instructions, category, USDC bounty, and deadline. When x402 is enabled on the API, you sign an
          EIP-3009 MockUSDC authorization so funds can settle to the escrow before the task is published on-chain.
        </p>
      </section>

      <Card className="p-6 md:p-8">
        <PostTaskForm />
      </Card>
    </div>
  );
}
