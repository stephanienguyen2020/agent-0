"use client";

import { IDKitRequestWidget } from "@worldcoin/idkit";
import { deviceLegacy, orbLegacy } from "@worldcoin/idkit-core";
import type { IDKitResult, RpContext } from "@worldcoin/idkit-core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getAddress } from "viem";
import { useAccount } from "wagmi";

import { usePrivyConfigured } from "@/app/providers";
import { BtnPrimary } from "@/components/ui/Button";
import { fetchWorldIdStatus, postWorldIdVerify } from "@/lib/api";

/** Next verification uses Device when false, Orb when true (only one "active" accent at a time). */
function levelChipClass(completed: boolean, activeNext: boolean) {
  if (completed) {
    return "cursor-not-allowed rounded-[14px] border border-sky-500/35 bg-sky-500/10 px-4 py-2.5 text-xs font-semibold text-sky-100 sm:text-[13px]";
  }
  if (activeNext) {
    return "rounded-[14px] border border-[rgba(182,242,74,0.3)] bg-[rgba(182,242,74,0.06)] px-4 py-2.5 text-xs font-semibold text-[#cdf56a] transition sm:text-[13px]";
  }
  return "rounded-[14px] border border-az-stroke-2 bg-white/[0.04] px-4 py-2.5 text-xs font-semibold text-az-muted-2 transition hover:border-white/[0.15] hover:text-az-text sm:text-[13px]";
}

function RegisterFlowInner() {
  const queryClient = useQueryClient();
  const { authenticated, login } = usePrivy();
  const { address } = useAccount();
  const { wallets } = useWallets();
  const [orbMode, setOrbMode] = useState(false);
  const [open, setOpen] = useState(false);
  const [rp, setRp] = useState<RpContext | null>(null);
  /** Wallet address frozen when starting verification — must match IDKit `signal` or backend signal_hash check fails. */
  const [boundSignal, setBoundSignal] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  /** IDKit can invoke onSuccess/handleVerify twice in quick succession; only one POST may run. */
  const verifyInFlightRef = useRef(false);

  const appId = process.env.NEXT_PUBLIC_WORLD_ID_APP_ID as
    | `app_${string}`
    | undefined;
  const action = process.env.NEXT_PUBLIC_WORLD_ID_ACTION || "register-executor";

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

  const { data: statusData } = useQuery({
    queryKey: ["world-id-status", normalizedWallet],
    queryFn: async () => fetchWorldIdStatus(normalizedWallet!),
    enabled: Boolean(authenticated && normalizedWallet),
  });

  const level = statusData?.verification_level ?? null;
  const hasDeviceOrHigher =
    level === "device" || level === "orb";
  const hasOrb = level === "orb";

  useEffect(() => {
    setOrbMode(false);
  }, [normalizedWallet]);

  /** After Device verification, default Orb as the next flow (upgrade); Orb tier keeps Orb selected. */
  useEffect(() => {
    if (level === "device" || level === "orb") {
      setOrbMode(true);
    }
  }, [level]);

  const loadRp = useCallback(async () => {
    setErr(null);
    const r = await fetch("/api/world-id/rp-context", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setErr(
        (j as { error?: string }).error || (await r.text()) || r.statusText,
      );
      return null;
    }
    const ctx = (await r.json()) as RpContext;
    setRp(ctx);
    return ctx;
  }, [action]);

  const startVerify = useCallback(async () => {
    setOk(null);
    setErr(null);
    if (!wallet) {
      setErr(
        "Connect your wallet first (wallet address is the World ID signal).",
      );
      return;
    }
    if (!orbMode && hasDeviceOrHigher) {
      setErr(
        "You're already verified at Device level. Select Orb to upgrade with Orb.",
      );
      return;
    }
    if (orbMode && hasOrb) {
      setErr("You're already verified with Orb.");
      return;
    }
    if (!appId) {
      setErr("Set NEXT_PUBLIC_WORLD_ID_APP_ID in frontend/.env.local");
      return;
    }
    const ctx = await loadRp();
    if (!ctx) return;
    try {
      setBoundSignal(getAddress(wallet));
    } catch {
      setErr("Invalid EVM wallet address for World ID signal.");
      return;
    }
    setOpen(true);
  }, [
    appId,
    hasDeviceOrHigher,
    hasOrb,
    loadRp,
    orbMode,
    wallet,
  ]);

  const handleVerify = useCallback(
    async (result: IDKitResult) => {
      const raw = boundSignal ?? wallet;
      if (!raw) return;
      let normalized: string;
      try {
        normalized = getAddress(raw);
      } catch {
        setErr("Invalid wallet address for World ID signal.");
        return;
      }
      if (verifyInFlightRef.current) {
        return;
      }
      verifyInFlightRef.current = true;
      setErr(null);
      setOk(null);
      try {
        await postWorldIdVerify({ wallet: normalized, idkit_result: result });
        setOk(
          "Verified — you can accept tasks (Orb required for high bounties).",
        );
        setOpen(false);
        setBoundSignal(null);
        if (normalizedWallet) {
          await queryClient.invalidateQueries({
            queryKey: ["world-id-status", normalizedWallet],
          });
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const lower = msg.toLowerCase();
        if (lower.includes("nullifier") && lower.includes("another")) {
          setErr(
            "This World ID is already linked to a different wallet in our records. Connect the wallet you used when you first verified on this app, then try again.",
          );
        } else {
          setErr(msg);
        }
        setOpen(false);
      } finally {
        verifyInFlightRef.current = false;
      }
    },
    [boundSignal, normalizedWallet, queryClient, wallet],
  );

  if (!authenticated) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-az-muted-2">
          Sign in with Privy to link a wallet before World ID verification.
        </p>
        <BtnPrimary type="button" onClick={() => login()}>
          Connect wallet to register
        </BtnPrimary>
      </div>
    );
  }

  const verifyDisabled =
    (!orbMode && hasDeviceOrHigher) || (orbMode && hasOrb);

  const deviceCompleted = hasDeviceOrHigher;
  const orbCompleted = hasOrb;
  const deviceActiveNext = !deviceCompleted && !orbMode;
  const orbActiveNext = !orbCompleted && orbMode;

  return (
    <div className="space-y-6" id="world-id-verify">
      {hasDeviceOrHigher && (
        <div className="rounded-[14px] border border-sky-500/35 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">
          {hasOrb
            ? "You're verified with Orb (includes Device). You can accept tasks, including high-bounty Orb-gated work."
            : "You're already verified at Device level. Select Orb above if you need to qualify for high-bounty tasks."}
        </div>
      )}

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-az-muted">
          Signing address
        </p>
        <div className="rounded-[14px] border border-az-stroke-2 bg-white/[0.03] px-4 py-3">
          <p className="az-mono text-sm text-az-text" title={wallet}>
            {wallet ? wallet : "-"}
          </p>
        </div>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-az-muted">
          Verification level
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={deviceCompleted}
            className={levelChipClass(deviceCompleted, deviceActiveNext)}
            onClick={() => {
              if (!deviceCompleted) setOrbMode(false);
            }}
          >
            {deviceCompleted ? "Device · done" : "Device"}
          </button>
          <button
            type="button"
            disabled={orbCompleted}
            className={levelChipClass(orbCompleted, orbActiveNext)}
            onClick={() => {
              if (!orbCompleted) setOrbMode(true);
            }}
          >
            {orbCompleted
              ? "Orb · done"
              : level === "device"
                ? "Orb (upgrade)"
                : "Orb (high-bounty tasks)"}
          </button>
        </div>
      </div>

      <BtnPrimary
        type="button"
        disabled={verifyDisabled}
        onClick={() => void startVerify()}
      >
        Verify with World ID
      </BtnPrimary>

      {err && (
        <div className="rounded-[14px] border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {err}
        </div>
      )}
      {ok && (
        <div className="rounded-[14px] border border-emerald-500/35 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          {ok}
        </div>
      )}

      {appId && rp && (
        <IDKitRequestWidget
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (!o) setBoundSignal(null);
          }}
          app_id={appId}
          action={action}
          rp_context={rp}
          allow_legacy_proofs
          preset={
            orbMode
              ? orbLegacy({ signal: (boundSignal ?? wallet)! })
              : deviceLegacy({ signal: (boundSignal ?? wallet)! })
          }
          onSuccess={() => {}}
          handleVerify={(res) => void handleVerify(res)}
          onError={(code) => setErr(`World ID error: ${code}`)}
        />
      )}
    </div>
  );
}

export function RegisterFlow() {
  const configured = usePrivyConfigured();
  if (!configured) {
    return (
      <div className="space-y-3 rounded-[14px] border border-amber-500/25 bg-amber-500/5 px-4 py-4 text-sm text-az-muted-2">
        <p className="font-medium text-amber-200/90">
          Wallet UI is not configured
        </p>
        <p>
          Set{" "}
          <code className="az-mono rounded bg-white/10 px-1.5 py-0.5 text-[13px]">
            NEXT_PUBLIC_PRIVY_APP_ID
          </code>{" "}
          in{" "}
          <code className="az-mono rounded bg-white/10 px-1 py-0.5">
            frontend/.env.local
          </code>
          , then reload and connect your wallet to complete World ID below.
        </p>
      </div>
    );
  }
  return <RegisterFlowInner />;
}
