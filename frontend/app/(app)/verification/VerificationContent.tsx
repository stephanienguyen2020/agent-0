"use client";

import { useQuery } from "@tanstack/react-query";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useMemo } from "react";
import { getAddress } from "viem";
import { useAccount } from "wagmi";

import { usePrivyConfigured } from "@/app/providers";
import { BtnPrimary } from "@/components/ui/Button";
import { fetchWorldIdStatus } from "@/lib/api";

/** Fallback when API omits `orb_bounty_threshold_micros` (matches default backend settings). */
const DEFAULT_ORB_BOUNTY_THRESHOLD_USD = 5;

function EligibilityRows({
  level,
  orbBountyThresholdLabel,
}: {
  level: "device" | "orb" | null;
  orbBountyThresholdLabel: string;
}) {
  const rows: {
    label: string;
    ok: boolean;
  }[] = [
    {
      label: "Browse tasks on the Market",
      ok: true,
    },
    {
      label: "Accept tasks (requires World ID Device or Orb)",
      ok: level === "device" || level === "orb",
    },
    {
      label: `Accept tasks with bounty ≥ $${orbBountyThresholdLabel} USDC (requires Orb)`,
      ok: level === "orb",
    },
  ];

  return (
    <ul className="space-y-2 text-sm text-az-muted-2">
      {rows.map((row) => (
        <li key={row.label} className="flex gap-2">
          <span className={row.ok ? "text-emerald-400" : "text-az-muted-2/60"}>
            {row.ok ? "✓" : "—"}
          </span>
          <span>{row.label}</span>
        </li>
      ))}
    </ul>
  );
}

function VerificationInner() {
  const { authenticated, login } = usePrivy();
  const { address } = useAccount();
  const { wallets } = useWallets();

  const wallet =
    (address as string | undefined) ||
    (wallets[0]?.address as string | undefined) ||
    undefined;

  const normalizedWallet = useMemo(() => {
    if (!wallet) return null;
    try {
      return getAddress(wallet);
    } catch {
      return null;
    }
  }, [wallet]);

  const {
    data: statusData,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["world-id-status", normalizedWallet],
    queryFn: async () => fetchWorldIdStatus(normalizedWallet!),
    staleTime: 0,
    enabled: Boolean(authenticated && normalizedWallet),
  });

  const level = statusData?.verification_level ?? null;

  const orbBountyThresholdUsd = useMemo(() => {
    const m = statusData?.orb_bounty_threshold_micros;
    if (typeof m === "number" && m >= 0) return m / 1_000_000;
    return DEFAULT_ORB_BOUNTY_THRESHOLD_USD;
  }, [statusData?.orb_bounty_threshold_micros]);

  const orbBountyThresholdLabel = useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(orbBountyThresholdUsd),
    [orbBountyThresholdUsd],
  );

  if (!authenticated) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-az-muted-2">
          Sign in with Privy to view World ID status for your wallet.
        </p>
        <BtnPrimary type="button" onClick={() => login()}>
          Connect wallet
        </BtnPrimary>
      </div>
    );
  }

  if (!wallet || !normalizedWallet) {
    return (
      <p className="text-sm text-az-muted-2">
        Connect an EVM wallet to load verification status.
      </p>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-4 w-48 animate-pulse rounded bg-white/[0.08]" />
        <div className="h-24 animate-pulse rounded-[14px] bg-white/[0.06]" />
      </div>
    );
  }

  if (isError) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    const is503 = msg.includes("503") || msg.toLowerCase().includes("supabase");
    return (
      <div className="rounded-[14px] border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
        {is503
          ? "Verification status is unavailable (check that the API and database are configured)."
          : `Could not load status: ${msg}`}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-az-muted">
          Signing address
        </p>
        <div className="rounded-[14px] border border-az-stroke-2 bg-white/[0.03] px-4 py-3">
          <p className="az-mono text-sm text-az-text" title={normalizedWallet}>
            {normalizedWallet}
          </p>
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-az-muted">
          World ID status
        </h3>
        {level === null && (
          <div className="rounded-[14px] border border-az-stroke-2 bg-white/[0.03] px-4 py-4">
            <p className="text-sm font-medium text-az-text">Not verified yet</p>
            <p className="mt-2 text-sm leading-relaxed text-az-muted-2">
              Complete World ID below to accept tasks. Your wallet address is used as the signal so
              the backend can tie verification to your identity.
            </p>
          </div>
        )}
        {level === "device" && (
          <div className="rounded-[14px] border border-sky-500/30 bg-sky-500/10 px-4 py-4">
            <p className="text-sm font-medium text-sky-100">Verified at Device level</p>
            <p className="mt-2 text-sm leading-relaxed text-sky-100/90">
              You can accept tasks that do not require Orb. For bounties at or above $
              {orbBountyThresholdLabel} USDC, Orb verification is required—upgrade in{" "}
              <a
                href="#world-id-verify"
                className="font-medium text-sky-50 underline underline-offset-2 hover:text-white"
              >
                Verify or upgrade
              </a>{" "}
              below.
            </p>
          </div>
        )}
        {level === "orb" && (
          <div className="rounded-[14px] border border-emerald-500/35 bg-emerald-500/10 px-4 py-4">
            <p className="text-sm font-medium text-emerald-100">Verified with Orb</p>
            <p className="mt-2 text-sm leading-relaxed text-emerald-100/90">
              Highest assurance level. You can accept tasks that require Device or Orb, including
              high-bounty work.
            </p>
          </div>
        )}
      </div>

      <div>
        <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-az-muted">
          Task eligibility (summary)
        </h3>
        <CardSection>
          <EligibilityRows level={level} orbBountyThresholdLabel={orbBountyThresholdLabel} />
        </CardSection>
      </div>

      <details className="rounded-[14px] border border-az-stroke-2 bg-white/[0.02] px-4 py-3 text-sm text-az-muted-2">
        <summary className="cursor-pointer font-medium text-az-text">
          Device vs Orb
        </summary>
        <p className="mt-3 leading-relaxed">
          <strong className="text-az-text">Device</strong> uses a browser-based World ID check—good
          for basic bot resistance. <strong className="text-az-text">Orb</strong> adds an in-person
          biometric at a World ID Orb for stronger proof-of-personhood. High-value tasks may require
          Orb.
        </p>
        <p className="mt-2">
          <a
            href="https://worldcoin.org/world-id"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#cdf56a] underline underline-offset-2 hover:text-az-text"
          >
            About World ID
          </a>
        </p>
      </details>

      <p className="text-sm text-az-muted-2">
        <a
          href="#world-id-verify"
          className="font-medium text-[#cdf56a] underline underline-offset-2 hover:text-az-text"
        >
          Verify or upgrade with World ID
        </a>{" "}
        on this page.
      </p>
    </div>
  );
}

function CardSection({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[14px] border border-az-stroke-2 bg-white/[0.02] px-4 py-4">
      {children}
    </div>
  );
}

export function VerificationContent() {
  const configured = usePrivyConfigured();
  if (!configured) {
    return (
      <div className="space-y-3 rounded-[14px] border border-amber-500/25 bg-amber-500/5 px-4 py-4 text-sm text-az-muted-2">
        <p className="font-medium text-amber-200/90">Wallet UI is not configured</p>
        <p>
          Set{" "}
          <code className="az-mono rounded bg-white/10 px-1.5 py-0.5 text-[13px]">
            NEXT_PUBLIC_PRIVY_APP_ID
          </code>{" "}
          in{" "}
          <code className="az-mono rounded bg-white/10 px-1 py-0.5">frontend/.env.local</code>.
        </p>
      </div>
    );
  }
  return <VerificationInner />;
}
