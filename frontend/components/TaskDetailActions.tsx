"use client";

import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useCallback, useId, useState, type FormEvent } from "react";
import { useAccount } from "wagmi";

import { usePrivyConfigured } from "@/app/providers";
import { BtnPrimary } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { getApiBase } from "@/lib/api-base";

type TaskRow = {
  task_id: string;
  status: string;
  title?: string;
};

const outlineBtn =
  "inline-flex h-11 items-center justify-center rounded-[14px] border border-az-stroke-2 bg-white/[0.04] px-5 text-[13px] font-semibold text-az-text transition hover:border-white/[0.15] hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-45";

const TERMINAL_STATUSES = new Set([
  "completed",
  "disputed",
  "rejected",
  "expired",
  "cancelled",
  "refunded",
]);

function TaskDetailActionsInner({ task }: { task: TaskRow }) {
  const { authenticated, login } = usePrivy();
  const { address } = useAccount();
  const { wallets } = useWallets();
  const fileInputId = useId();
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [chosenFileName, setChosenFileName] = useState<string | null>(null);

  const wallet =
    (address as string | undefined) ||
    (wallets[0]?.address as string | undefined) ||
    undefined;

  const api = getApiBase();

  const run = useCallback(async (fn: () => Promise<void>) => {
    setMsg(null);
    setBusy(true);
    try {
      await fn();
      setMsg("OK");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }, []);

  const onAccept = () =>
    run(async () => {
      if (!wallet) throw new Error("Connect a wallet first");
      const r = await fetch(`${api}/api/v1/tasks/${task.task_id}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ executor_wallet: wallet, executor_erc8004_id: 0 }),
      });
      if (!r.ok) {
        const t = await r.text();
        throw new Error(t || r.statusText);
      }
    });

  const onSubmit = (ev: FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    const fd = new FormData(ev.currentTarget);
    const file = fd.get("file") as File | null;
    if (!file?.size) {
      setMsg("Choose a file");
      return;
    }
    run(async () => {
      const body = new FormData();
      body.append("file", file);
      const r = await fetch(`${api}/api/v1/tasks/${task.task_id}/submit`, {
        method: "POST",
        body,
      });
      if (!r.ok) {
        const t = await r.text();
        throw new Error(t || r.statusText);
      }
      (ev.target as HTMLFormElement).reset();
      setChosenFileName(null);
    });
  };

  const onVerify = () =>
    run(async () => {
      const r = await fetch(`${api}/api/v1/tasks/${task.task_id}/verify`, { method: "POST" });
      if (!r.ok) {
        const t = await r.text();
        throw new Error(t || r.statusText);
      }
    });

  if (!authenticated) {
    return (
      <Card className="mt-8 p-5">
        <p className="text-sm text-az-muted-2">Connect your wallet to accept or submit evidence.</p>
        <BtnPrimary type="button" className="mt-4" onClick={() => login()}>
          Connect wallet
        </BtnPrimary>
      </Card>
    );
  }

  const disabledEvidence = busy || task.status !== "accepted";

  return (
    <Card className="mt-8 space-y-5 p-5">
      <p className="text-xs text-az-muted-2">
        API:{" "}
        <code className="rounded-lg border border-az-stroke-2 bg-white/[0.04] px-2 py-0.5 font-mono text-[11px] text-[#cdf56a]">
          {api}
        </code>
      </p>
      {msg && (
        <p className={`text-sm ${msg === "OK" ? "text-emerald-400" : "text-amber-300"}`}>{msg}</p>
      )}
      <div className="flex flex-wrap gap-2.5">
        <BtnPrimary type="button" disabled={busy || task.status !== "published"} onClick={onAccept}>
          Accept task
        </BtnPrimary>
        <button type="button" disabled={busy || task.status !== "submitted"} onClick={onVerify} className={outlineBtn}>
          Verify &amp; release
        </button>
      </div>
      <form onSubmit={onSubmit} className="space-y-4 border-t border-az-stroke pt-5">
        <label htmlFor={fileInputId} className="block text-sm font-medium text-az-muted-2">
          Upload evidence (photo / file)
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <input
            id={fileInputId}
            name="file"
            type="file"
            accept="image/*,application/pdf"
            disabled={disabledEvidence}
            className="sr-only"
            onChange={(e) => setChosenFileName(e.target.files?.[0]?.name ?? null)}
          />
          <label
            htmlFor={fileInputId}
            className={`inline-flex h-11 cursor-pointer items-center rounded-[14px] border border-az-stroke-2 bg-white/[0.06] px-4 text-[13px] font-semibold text-az-text transition hover:border-[rgba(182,242,74,0.25)] hover:bg-white/[0.09] ${disabledEvidence ? "pointer-events-none opacity-45" : ""}`}
          >
            Choose file
          </label>
          <span className="min-w-0 truncate text-xs text-az-muted">
            {chosenFileName ?? "No file chosen"}
          </span>
        </div>
        <BtnPrimary type="submit" disabled={disabledEvidence}>
          Submit evidence
        </BtnPrimary>
      </form>
    </Card>
  );
}

export function TaskDetailActions({ task }: { task: TaskRow }) {
  const terminal = TERMINAL_STATUSES.has(task.status.toLowerCase());
  if (terminal) {
    return (
      <Card className="mt-8 p-5">
        <p className="text-sm text-az-muted-2">
          No further lifecycle actions — status is{" "}
          <span className="font-semibold capitalize text-az-text">{task.status.replace(/_/g, " ")}</span>.
          Use the settlement section above for amounts, timestamps, and opBNBScan transaction links.
        </p>
      </Card>
    );
  }

  const configured = usePrivyConfigured();
  if (!configured) {
    return (
      <Card className="mt-8 p-5">
        <p className="text-sm text-az-muted-2">Configure Privy to enable accept / submit from the browser.</p>
      </Card>
    );
  }
  return <TaskDetailActionsInner task={task} />;
}
