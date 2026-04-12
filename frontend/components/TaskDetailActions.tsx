"use client";

import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useCallback, useState, type FormEvent } from "react";
import { useAccount } from "wagmi";

import { usePrivyConfigured } from "@/app/providers";
import { getApiBase } from "@/lib/api-base";

type TaskRow = {
  task_id: string;
  status: string;
  title?: string;
};

function TaskDetailActionsInner({ task }: { task: TaskRow }) {
  const { authenticated, login } = usePrivy();
  const { address } = useAccount();
  const { wallets } = useWallets();
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const wallet =
    (address as string | undefined) ||
    (wallets[0]?.address as string | undefined) ||
    undefined;

  const api = getApiBase();

  const run = useCallback(
    async (fn: () => Promise<void>) => {
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
    },
    [],
  );

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
      <div className="mt-8 rounded-xl border border-white/10 p-4">
        <p className="text-sm text-[var(--muted)]">Connect your wallet to accept or submit evidence.</p>
        <button
          type="button"
          onClick={() => login()}
          className="mt-3 rounded-lg border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-4 py-2 text-sm font-medium text-[var(--accent)]"
        >
          Connect wallet
        </button>
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-6 rounded-xl border border-white/10 p-4">
      <p className="text-xs text-[var(--muted)]">
        API: <code className="rounded bg-white/5 px-1">{api}</code>
      </p>
      {msg && (
        <p className={`text-sm ${msg === "OK" ? "text-emerald-400" : "text-amber-300"}`}>{msg}</p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || task.status !== "published"}
          onClick={onAccept}
          className="rounded-lg bg-[var(--accent)]/90 px-4 py-2 text-sm font-medium text-black disabled:opacity-40"
        >
          Accept task
        </button>
        <button
          type="button"
          disabled={busy || task.status !== "submitted"}
          onClick={onVerify}
          className="rounded-lg border border-white/20 px-4 py-2 text-sm disabled:opacity-40"
        >
          Verify &amp; release
        </button>
      </div>
      <form onSubmit={onSubmit} className="space-y-2">
        <label className="block text-sm text-[var(--muted)]">Upload evidence (photo / file)</label>
        <input
          name="file"
          type="file"
          accept="image/*,application/pdf"
          disabled={busy || task.status !== "accepted"}
          className="block w-full text-sm"
        />
        <button
          type="submit"
          disabled={busy || task.status !== "accepted"}
          className="rounded-lg border border-white/20 px-4 py-2 text-sm disabled:opacity-40"
        >
          Submit evidence
        </button>
      </form>
    </div>
  );
}

export function TaskDetailActions({ task }: { task: TaskRow }) {
  const configured = usePrivyConfigured();
  if (!configured) {
    return (
      <p className="mt-8 text-sm text-[var(--muted)]">
        Configure Privy to enable accept / submit from the browser.
      </p>
    );
  }
  return <TaskDetailActionsInner task={task} />;
}
