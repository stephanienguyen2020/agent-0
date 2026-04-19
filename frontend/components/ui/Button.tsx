"use client";

import type { ButtonHTMLAttributes } from "react";

export function BtnPrimary({
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`inline-flex h-11 items-center gap-2 rounded-[14px] bg-az-btn-green px-5 text-[13px] font-bold text-[#0d1a0f] shadow-az-btn-green transition hover:-translate-y-px hover:shadow-[0_12px_30px_-8px_rgba(180,240,90,0.55)] disabled:opacity-50 ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
}

export function IconButton({
  className = "",
  children,
  title,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { title?: string }) {
  return (
    <button
      type="button"
      title={title}
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-az-stroke-2 bg-white/[0.04] text-az-muted-2 transition hover:bg-white/[0.08] hover:text-az-text ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
}

export function IconPlus({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
