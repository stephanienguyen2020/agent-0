"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "agentzero-dashboard-theme";

function readTheme(): "dark" | "light" {
  if (typeof document === "undefined") return "dark";
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr === "light" || attr === "dark") return attr;
  return "dark";
}

/** Sets `html[data-theme]`; sidebar + editorial surfaces read `--ed-*` tokens. */
export function ThemeToggle({ className = "theme-icon-btn" }: { className?: string } = {}) {
  const [dark, setDark] = useState(true);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (saved === "light" || saved === "dark") {
      document.documentElement.setAttribute("data-theme", saved);
      setDark(saved === "dark");
    } else {
      setDark(readTheme() === "dark");
    }
  }, []);

  const toggle = () => {
    const nextDark = !dark;
    setDark(nextDark);
    const mode = nextDark ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", mode);
    try {
      window.localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      /* ignore */
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      className={className}
    >
      {dark ? (
        <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden>
          <path
            d="M20 14.5A8 8 0 1 1 9.5 4 7 7 0 0 0 20 14.5z"
            fill="currentColor"
          />
        </svg>
      ) : (
        <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden>
          <circle cx="12" cy="12" r="4.5" fill="currentColor" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
            <line
              key={a}
              x1="12"
              y1="2.5"
              x2="12"
              y2="5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              transform={`rotate(${a} 12 12)`}
            />
          ))}
        </svg>
      )}
    </button>
  );
}
