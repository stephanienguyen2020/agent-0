/**
 * Outline-only mark: rounded square + check (design.md §5 · no fill).
 * Color via `currentColor` — e.g. `text-[color:var(--ed-ink)]` in the app shell.
 */
export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="1.5" y="1.5" width="21" height="21" rx="5" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M7 12 L11 16 L17 8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
    </svg>
  );
}
