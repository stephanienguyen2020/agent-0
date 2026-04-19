import type { HTMLAttributes } from "react";

export function NavBadge({ children, className = "" }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={`ml-auto rounded-full bg-az-green px-[7px] py-0.5 text-[10px] font-bold text-[#0d1a0f] ${className}`.trim()}
    >
      {children}
    </span>
  );
}
