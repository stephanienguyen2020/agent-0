/** Maps API category strings to AgentZero mockup chip styles */

const CATEGORY_CLASS: Record<string, string> = {
  physical_presence: "bg-[rgba(182,242,74,0.12)] text-[#cdf56a]",
  Physical: "bg-[rgba(182,242,74,0.12)] text-[#cdf56a]",
  knowledge_access: "bg-[rgba(91,156,245,0.12)] text-[#5b9cf5]",
  Knowledge: "bg-[rgba(91,156,245,0.12)] text-[#5b9cf5]",
  human_authority: "bg-[rgba(245,166,35,0.12)] text-[#f5a623]",
  Authority: "bg-[rgba(245,166,35,0.12)] text-[#f5a623]",
  agent_to_agent: "bg-[rgba(167,139,250,0.12)] text-[#a78bfa]",
  "agent-to-agent": "bg-[rgba(167,139,250,0.12)] text-[#a78bfa]",
  simple_action: "bg-[rgba(239,74,122,0.12)] text-[#ef4a7a]",
  Action: "bg-[rgba(239,74,122,0.12)] text-[#ef4a7a]",
};

const STATUS_CONTAINER: Record<string, string> = {
  published: "bg-[rgba(91,156,245,0.1)] text-[#5b9cf5]",
  accepted: "bg-[rgba(167,139,250,0.1)] text-[#a78bfa]",
  in_progress: "bg-[rgba(245,166,35,0.1)] text-[#f5a623]",
  submitted: "bg-[rgba(182,242,74,0.1)] text-[#cdf56a]",
  verifying: "bg-[rgba(91,156,245,0.1)] text-[#5b9cf5]",
  completed: "bg-[rgba(182,242,74,0.12)] text-[#cdf56a]",
  disputed: "bg-[rgba(239,74,122,0.1)] text-[#ef4a7a]",
  refunded: "bg-[rgba(255,255,255,0.05)] text-[#8a9a90]",
};

const STATUS_DOT: Record<string, string> = {
  published: "bg-[#5b9cf5]",
  accepted: "bg-[#a78bfa]",
  in_progress: "bg-[#f5a623]",
  submitted: "bg-[#b6f24a]",
  verifying: "bg-[#5b9cf5] az-pulse",
  completed: "bg-[#b6f24a]",
  disputed: "bg-[#ef4a7a]",
  refunded: "bg-[#6b7d72]",
};

export function categoryLabelClass(raw: string) {
  return CATEGORY_CLASS[raw] ?? "bg-white/[0.06] text-[#8a9a90]";
}

export function statusContainerClass(raw: string) {
  return STATUS_CONTAINER[raw] ?? "bg-white/[0.06] text-[#8a9a90]";
}

export function statusDotClass(raw: string) {
  return STATUS_DOT[raw] ?? "bg-[#6b7d72]";
}

export function formatCategoryLabel(raw: string) {
  return raw
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
