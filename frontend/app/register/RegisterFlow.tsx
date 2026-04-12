"use client";

import { IDKitRequestWidget } from "@worldcoin/idkit";
import { deviceLegacy, orbLegacy } from "@worldcoin/idkit-core";
import type { IDKitResult, RpContext } from "@worldcoin/idkit-core";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useCallback, useState } from "react";
import { useAccount } from "wagmi";

import { usePrivyConfigured } from "@/app/providers";
import { getApiBase } from "@/lib/api-base";

function RegisterFlowInner() {
  const { authenticated, login } = usePrivy();
  const { address } = useAccount();
  const { wallets } = useWallets();
  const [orbMode, setOrbMode] = useState(false);
  const [open, setOpen] = useState(false);
  const [rp, setRp] = useState<RpContext | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const appId = process.env.NEXT_PUBLIC_WORLD_ID_APP_ID as `app_${string}` | undefined;
  const action = process.env.NEXT_PUBLIC_WORLD_ID_ACTION || "register-executor";

  const wallet =
    (address as string | undefined) ||
    (wallets[0]?.address as string | undefined) ||
    undefined;

  const loadRp = useCallback(async () => {
    setErr(null);
    const r = await fetch("/api/world-id/rp-context", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setErr((j as { error?: string }).error || (await r.text()) || r.statusText);
      return null;
    }
    const ctx = (await r.json()) as RpContext;
    setRp(ctx);
    return ctx;
  }, [action]);

  const startVerify = useCallback(async () => {
    setOk(null);
    if (!wallet) {
      setErr("Connect your wallet first (wallet address is the World ID signal).");
      return;
    }
    if (!appId) {
      setErr("Set NEXT_PUBLIC_WORLD_ID_APP_ID in frontend/.env.local");
      return;
    }
    const ctx = await loadRp();
    if (!ctx) return;
    setOpen(true);
  }, [appId, loadRp, wallet]);

  const handleVerify = useCallback(
    async (result: IDKitResult) => {
      if (!wallet) return;
      const api = getApiBase();
      const r = await fetch(`${api}/api/v1/world-id/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet, idkit_result: result }),
      });
      if (!r.ok) {
        const t = await r.text();
        throw new Error(t || r.statusText);
      }
      setOk("Verified — you can accept tasks (Orb required for high bounties).");
      setOpen(false);
    },
    [wallet],
  );

  if (!authenticated) {
    return (
      <button
        type="button"
        onClick={() => login()}
        className="rounded-lg bg-[var(--accent)]/90 px-4 py-2 text-sm font-medium text-black"
      >
        Connect wallet to register
      </button>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--muted)]">
        Wallet: <code className="rounded bg-white/10 px-1">{wallet || "—"}</code>
      </p>
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input type="checkbox" checked={orbMode} onChange={(e) => setOrbMode(e.target.checked)} />
        Require Orb (for high-bounty tasks)
      </label>
      <button
        type="button"
        onClick={() => void startVerify()}
        className="rounded-lg border border-white/20 px-4 py-2 text-sm font-medium"
      >
        Verify with World ID
      </button>
      {err && <p className="text-sm text-amber-300">{err}</p>}
      {ok && <p className="text-sm text-emerald-400">{ok}</p>}

      {appId && rp && (
        <IDKitRequestWidget
          open={open}
          onOpenChange={setOpen}
          app_id={appId}
          action={action}
          rp_context={rp}
          allow_legacy_proofs
          preset={orbMode ? orbLegacy({ signal: wallet! }) : deviceLegacy({ signal: wallet! })}
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
      <p className="text-sm text-[var(--muted)]">
        Set <code className="rounded bg-white/10 px-1">NEXT_PUBLIC_PRIVY_APP_ID</code> then connect your wallet, then
        complete World ID below.
      </p>
    );
  }
  return <RegisterFlowInner />;
}
