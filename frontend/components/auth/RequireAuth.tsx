"use client";

import type { CSSProperties } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";

import { usePrivyConfigured } from "@/app/providers";
import { LandingLogoLink } from "@/components/brand/LandingLogoLink";
import { ThemeToggle } from "@/components/shell/ThemeToggle";

const primaryCta: CSSProperties = {
  border: "1px solid var(--ed-ink)",
  background: "var(--ed-ink)",
  color: "var(--ed-bg)",
  borderRadius: 999,
  padding: "12px 22px",
  fontSize: 14,
  fontWeight: 500,
  cursor: "pointer",
  transition: "transform 0.15s cubic-bezier(0.2, 0.9, 0.2, 1)",
};

const secondaryCta: CSSProperties = {
  border: "1px solid var(--ed-line)",
  background: "transparent",
  borderRadius: 999,
  padding: "12px 20px",
  fontSize: 14,
  cursor: "pointer",
  color: "var(--ed-ink)",
  transition: "transform 0.15s cubic-bezier(0.2, 0.9, 0.2, 1)",
};

const serifTitle: CSSProperties = {
  fontFamily: "var(--font-instrument-serif), ui-serif, Georgia, serif",
  fontSize: "clamp(32px, 5vw, 52px)",
  lineHeight: 1.05,
  letterSpacing: "-0.02em",
  fontWeight: 400,
  color: "var(--ed-ink)",
};

function AuthGateFrame({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--ed-bg)",
        color: "var(--ed-ink)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 40,
          borderBottom: "1px solid var(--ed-line)",
          backdropFilter: "saturate(1.1) blur(6px)",
          background: "color-mix(in oklab, var(--ed-bg) 88%, transparent)",
        }}
      >
        <div
          style={{
            maxWidth: 1360,
            margin: "0 auto",
            padding: "14px 20px",
            display: "flex",
            alignItems: "center",
            gap: 20,
          }}
        >
          <LandingLogoLink />
          <div style={{ flex: 1 }} />
          <ThemeToggle />
        </div>
      </header>
      {children}
    </div>
  );
}

/** Blocks `(app)` routes until Privy reports `authenticated`. Landing `/` stays public. */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const configured = usePrivyConfigured();
  const { ready, authenticated, login } = usePrivy();
  const router = useRouter();

  if (!configured) {
    return (
      <AuthGateFrame>
        <main
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "48px 24px",
            textAlign: "center",
          }}
        >
          <p
            style={{
              maxWidth: 520,
              fontSize: 15,
              lineHeight: 1.55,
              color: "var(--ed-ink-2)",
            }}
          >
            Wallet sign-in is not configured. Set{" "}
            <code
              style={{
                fontFamily: "var(--font-jetbrains), ui-monospace, monospace",
                fontSize: 13,
                padding: "2px 8px",
                borderRadius: 6,
                background: "color-mix(in oklab, var(--ed-line) 40%, transparent)",
              }}
            >
              NEXT_PUBLIC_PRIVY_APP_ID
            </code>{" "}
            in{" "}
            <code
              style={{
                fontFamily: "var(--font-jetbrains), ui-monospace, monospace",
                fontSize: 13,
                padding: "2px 8px",
                borderRadius: 6,
                background: "color-mix(in oklab, var(--ed-line) 40%, transparent)",
              }}
            >
              frontend/.env.local
            </code>
            .
          </p>
          <button
            type="button"
            className="landing-gate-btn"
            style={{ ...secondaryCta, marginTop: 28 }}
            onClick={() => router.push("/")}
          >
            Back to home
          </button>
        </main>
      </AuthGateFrame>
    );
  }

  if (!ready) {
    return (
      <AuthGateFrame>
        <main
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 20,
            padding: "48px 24px",
          }}
        >
          <p
            style={{
              fontFamily: "var(--font-jetbrains), ui-monospace, monospace",
              fontSize: 12,
              color: "var(--ed-mute)",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            Loading wallet
          </p>
          <div
            className="h-10 w-10 shrink-0 animate-spin rounded-full border-2 border-[color:var(--ed-line)] border-t-[color:var(--ed-ink)]"
            aria-hidden
          />
          <span className="sr-only">Loading wallet state</span>
        </main>
      </AuthGateFrame>
    );
  }

  if (!authenticated) {
    return (
      <AuthGateFrame>
        <main
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "56px 24px 48px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-jetbrains), ui-monospace, monospace",
              fontSize: 11,
              color: "var(--ed-mute)",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              marginBottom: 18,
            }}
          >
            Agent Zero
          </div>
          <h1 style={{ ...serifTitle, marginBottom: 22 }}>Sign in required</h1>
          <p
            style={{
              maxWidth: 560,
              fontSize: 16,
              lineHeight: 1.55,
              color: "var(--ed-ink-2)",
              marginBottom: 28,
            }}
          >
            Connect your wallet to use the dashboard, market, wallet, and other app pages. The landing page stays open
            to everyone.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
            <button
              type="button"
              className="landing-gate-btn landing-gate-btn-primary"
              style={primaryCta}
              onClick={() => void login()}
            >
              Connect wallet
            </button>
            <button
              type="button"
              className="landing-gate-btn"
              style={secondaryCta}
              onClick={() => router.push("/")}
            >
              Back to home
            </button>
          </div>
        </main>
      </AuthGateFrame>
    );
  }

  return <>{children}</>;
}
