"use client";

import Link from "next/link";

import { BrandMark } from "@/components/brand/BrandMark";

/** Matches landing nav logo — links home. */
export function LandingLogoLink() {
  return (
    <Link
      href="/"
      style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0, color: "var(--ed-ink)" }}
    >
      <BrandMark className="h-[22px] w-[22px] shrink-0" />
      <div style={{ lineHeight: 1 }}>
        <div style={{ fontWeight: 600, letterSpacing: "-0.01em", fontSize: 15 }}>
          Agent<span style={{ color: "var(--ed-mute)" }}>.</span>Zero
        </div>
      </div>
    </Link>
  );
}
