"use client";

import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { useCallback, useId, useState, type FormEvent } from "react";

import type { TaskEvidenceItem } from "@/lib/task-types";
import { getAddress } from "viem";
import { useAccount } from "wagmi";

import { usePrivyConfigured } from "@/app/providers";
import { Card } from "@/components/ui/Card";
import { parseFastApiDetail } from "@/lib/api";
import { getApiBase } from "@/lib/api-base";

type TaskRow = {
  task_id: string;
  status: string;
  title?: string;
  requester_wallet?: string;
  executor_wallet?: string;
  requester_approval_before_verify?: boolean;
  evidence_items?: TaskEvidenceItem[];
};

const primaryBtn =
  "hero-primary-cta dashboard-btn shine relative z-[1] inline-flex h-11 items-center justify-center gap-2 rounded-full border border-[color:var(--accent)] bg-[color:var(--accent)] px-[22px] text-[13px] font-semibold text-[color:var(--ed-on-accent)] [transition-timing-function:cubic-bezier(0.2,0.9,0.2,1)] disabled:pointer-events-none disabled:opacity-45";

const outlineBtn =
  "dashboard-btn inline-flex h-11 items-center justify-center rounded-full border border-[color:var(--line)] bg-transparent px-[22px] text-[13px] font-semibold text-[color:var(--ink)] transition hover:bg-[color:var(--bg-2)] disabled:pointer-events-none disabled:opacity-45";

const fileLabelBase =
  "inline-flex h-11 cursor-pointer items-center rounded-full border border-[color:var(--line)] bg-[color:var(--bg-2)] px-[22px] text-[13px] font-semibold text-[color:var(--ink)] transition hover:border-[color:color-mix(in_oklab,var(--accent)_40%,var(--line))] hover:bg-[color:color-mix(in_oklab,var(--accent)_6%,var(--bg-2))]";

const TERMINAL_STATUSES = new Set([
  "completed",
  "disputed",
  "rejected",
  "expired",
  "cancelled",
  "refunded",
]);

function walletsEqual(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false;
  try {
    return getAddress(a) === getAddress(b);
  } catch {
    return a.toLowerCase() === b.toLowerCase();
  }
}

function submittedEvidenceCaption(item: TaskEvidenceItem): string | null {
  const parts: string[] = [];
  if (item.exif_gps_lat != null && item.exif_gps_lng != null) {
    parts.push(`${Number(item.exif_gps_lat).toFixed(5)}, ${Number(item.exif_gps_lng).toFixed(5)}`);
  }
  if (item.exif_timestamp) {
    parts.push(String(item.exif_timestamp));
  }
  return parts.length ? parts.join(" · ") : null;
}

function EvidenceItemCard({ item }: { item: TaskEvidenceItem }) {
  const [imgErr, setImgErr] = useState(false);
  const ct = (item.content_type || "").toLowerCase();
  const fn = item.filename || "evidence";
  const isPdf = ct.includes("pdf") || fn.toLowerCase().endsWith(".pdf");
  const isImg =
    !isPdf &&
    (ct.startsWith("image/") ||
      /\.(jpe?g|png|gif|webp|bmp|svg)(\?|$)/i.test(item.greenfield_url));

  const cap = submittedEvidenceCaption(item);
  const linkCls =
    "text-[13px] font-semibold text-[color:var(--accent)] underline underline-offset-2 hover:text-[color:var(--ink)]";

  const shell = "rounded-xl border border-[color:var(--line)] bg-[color:var(--bg-2)] p-4";

  if (isPdf) {
    return (
      <div className={shell}>
        <p className="truncate text-sm font-medium text-[color:var(--ink)]">{fn}</p>
        {cap ? <p className="mt-1 text-xs text-[color:var(--mute)]">{cap}</p> : null}
        <a
          href={item.greenfield_url}
          target="_blank"
          rel="noopener noreferrer"
          className={`${linkCls} mt-2 inline-block`}
        >
          Open PDF
        </a>
      </div>
    );
  }

  if (isImg && !imgErr) {
    return (
      <div className={`${shell} overflow-hidden p-0`}>
        <a
          href={item.greenfield_url}
          target="_blank"
          rel="noopener noreferrer"
          className="block bg-black/10"
        >
          {/* External storage URL (Greenfield / dev placeholder); not bundled assets. */}
          {/* eslint-disable-next-line @next/next/no-img-element -- remote signed URLs; domains not in next.config */}
          <img
            src={item.greenfield_url}
            alt=""
            className="max-h-64 w-full object-contain"
            loading="lazy"
            onError={() => setImgErr(true)}
          />
        </a>
        <div className="px-4 py-3">
          <p className="truncate text-xs text-[color:var(--mute)]">{fn}</p>
          {cap ? <p className="mt-1 text-xs text-[color:var(--mute)]">{cap}</p> : null}
          <a
            href={item.greenfield_url}
            target="_blank"
            rel="noopener noreferrer"
            className={`${linkCls} mt-1 inline-block`}
          >
            Open full size
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className={shell}>
      <p className="truncate text-sm font-medium text-[color:var(--ink)]">{fn}</p>
      {cap ? <p className="mt-1 text-xs text-[color:var(--mute)]">{cap}</p> : null}
      <a
        href={item.greenfield_url}
        target="_blank"
        rel="noopener noreferrer"
        className={`${linkCls} mt-2 inline-block`}
      >
        Open file
      </a>
    </div>
  );
}

function SubmittedEvidenceSection({ items }: { items: TaskEvidenceItem[] }) {
  return (
    <div className="space-y-3">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--mute)]">
        Submitted evidence
      </h3>
      <div className="grid gap-4 sm:grid-cols-2">
        {items.map((item, i) => (
          <EvidenceItemCard key={`${item.greenfield_url}-${item.item_index}-${i}`} item={item} />
        ))}
      </div>
    </div>
  );
}

function TaskDetailActionsInner({ task }: { task: TaskRow }) {
  const router = useRouter();
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
        throw new Error(parseFastApiDetail(t) || t || r.statusText);
      }
      router.refresh();
    });

  const onApproveEvidence = () =>
    run(async () => {
      if (!wallet) throw new Error("Connect a wallet first");
      const r = await fetch(`${api}/api/v1/tasks/${task.task_id}/approve-evidence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet }),
      });
      const t = await r.text();
      if (!r.ok) throw new Error(parseFastApiDetail(t) || t || r.statusText);
      router.refresh();
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
        const text = await r.text();
        throw new Error(parseFastApiDetail(text) || text || r.statusText);
      }
      (ev.target as HTMLFormElement).reset();
      setChosenFileName(null);
      router.refresh();
    });
  };

  const onVerify = () =>
    run(async () => {
      const r = await fetch(`${api}/api/v1/tasks/${task.task_id}/verify`, { method: "POST" });
      if (!r.ok) {
        const t = await r.text();
        throw new Error(parseFastApiDetail(t) || t || r.statusText);
      }
      router.refresh();
    });

  if (!authenticated) {
    return (
      <Card className="dashboard-reveal dashboard-reveal-d4 mt-8 p-5">
        <p className="text-sm text-[color:var(--ink-2)]">Connect your wallet to accept or submit evidence.</p>
        <button type="button" className={`${primaryBtn} mt-4`} onClick={() => login()}>
          Connect wallet
        </button>
      </Card>
    );
  }

  const st = task.status.toLowerCase();
  const approvalGate = task.requester_approval_before_verify !== false;
  const isRequester = walletsEqual(wallet, task.requester_wallet);
  const isExecutor = walletsEqual(wallet, task.executor_wallet);
  const awaitingReview = approvalGate && st === "awaiting_requester_review" && Boolean(task.requester_wallet);

  const disabledEvidence = busy || st !== "accepted";

  return (
    <Card className="dashboard-reveal dashboard-reveal-d4 mt-8 space-y-5 p-5">
      <p className="text-xs text-[color:var(--mute)]">
        API:{" "}
        <code className="rounded-lg border border-[color:var(--line)] bg-[color:var(--bg-2)] px-2 py-0.5 font-mono text-[11px] text-[color:var(--accent)]">
          {api}
        </code>
      </p>
      {msg ? (
        <p
          className={`text-sm ${
            msg === "OK"
              ? "text-[color:var(--accent)]"
              : "text-[color:color-mix(in_oklab,var(--danger)_85%,var(--ink))]"
          }`}
        >
          {msg}
        </p>
      ) : null}

      {task.evidence_items && task.evidence_items.length > 0 ? (
        <SubmittedEvidenceSection items={task.evidence_items} />
      ) : null}

      {awaitingReview ? (
        <div className="rounded-xl border border-[color:var(--line)] bg-[color:var(--bg-2)] px-4 py-3 text-sm leading-relaxed text-[color:var(--ink-2)]">
          {isRequester ? (
            <p>
              Evidence was submitted. Approve it to send the task to verification (your wallet must match the publisher).
            </p>
          ) : isExecutor ? (
            <p>Evidence was submitted and is awaiting approval from the task publisher before verification can run.</p>
          ) : (
            <p>
              Evidence is awaiting approval from the task publisher. Connect the publisher wallet to approve, or open this page
              as the publisher.
            </p>
          )}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2.5">
        {awaitingReview && isRequester ? (
          <button type="button" disabled={busy || !wallet} onClick={onApproveEvidence} className={primaryBtn}>
            Approve evidence
          </button>
        ) : null}
        <button type="button" disabled={busy || st !== "published"} onClick={onAccept} className={primaryBtn}>
          Accept task
        </button>
        <button type="button" disabled={busy || st !== "submitted"} onClick={onVerify} className={outlineBtn}>
          Verify &amp; release
        </button>
      </div>
      <form onSubmit={onSubmit} className="space-y-4 border-t border-[color:var(--line)] pt-5">
        <label htmlFor={fileInputId} className="block text-sm font-medium text-[color:var(--mute)]">
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
            className={`${fileLabelBase} ${disabledEvidence ? "pointer-events-none opacity-45" : ""}`}
          >
            Choose file
          </label>
          <span className="min-w-0 truncate text-xs text-[color:var(--mute)]">
            {chosenFileName ?? "No file chosen"}
          </span>
        </div>
        <button type="submit" disabled={disabledEvidence} className={primaryBtn}>
          Submit evidence
        </button>
      </form>
    </Card>
  );
}

export function TaskDetailActions({ task }: { task: TaskRow }) {
  const configured = usePrivyConfigured();
  const terminal = TERMINAL_STATUSES.has(task.status.toLowerCase());
  if (terminal) {
    return (
      <Card className="dashboard-reveal dashboard-reveal-d4 mt-8 p-5">
        <p className="text-sm text-[color:var(--ink-2)]">
          No further lifecycle actions — status is{" "}
          <span className="font-semibold capitalize text-[color:var(--ink)]">{task.status.replace(/_/g, " ")}</span>.
          Use the settlement section above for amounts, timestamps, and opBNBScan transaction links.
        </p>
      </Card>
    );
  }

  if (!configured) {
    return (
      <Card className="dashboard-reveal dashboard-reveal-d4 mt-8 p-5">
        <p className="text-sm text-[color:var(--ink-2)]">Configure Privy to enable accept / submit from the browser.</p>
      </Card>
    );
  }
  return <TaskDetailActionsInner task={task} />;
}
