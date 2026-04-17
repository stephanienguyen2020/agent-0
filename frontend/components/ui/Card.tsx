import type { HTMLAttributes } from "react";

export function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={["az-card", className].filter(Boolean).join(" ")} {...props} />;
}

export function GlassCard({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={["az-glass", className].filter(Boolean).join(" ")} {...props} />;
}
