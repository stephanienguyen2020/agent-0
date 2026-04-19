"use client";

import { useCallback, useState } from "react";

import { explorerOrigin, explorerTxUrl, shortTxHash } from "@/lib/explorer";
import type { TaskApiRecord } from "@/lib/task-types";

function microsToUsdc(m: string | number | undefined): string {
  if (m == null) return "—";
  const n = typeof m === "string" ? Number(m) : m;
  if (Number.isNaN(n)) return String(m);
  return (n / 1_000_000).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function TxRow({ label, hash }: { label: string; hash: string }) {
  const [copied, setCopied] = useState(false);
  const url = explorerTxUrl(hash);

  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(hash.startsWith("0x") ? hash : `0x${hash}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }, [hash]);

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-[color:var(--line)] py-2.5 last:border-0">
      <span className="min-w-[140px] text-[11px] font-semibold uppercase tracking-wide text-[color:var(--mute)]">
        {label}
      </span>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="min-w-0 flex-1 truncate font-mono text-[12px] text-[color:var(--accent)] underline-offset-2 hover:underline"
        title={hash}
      >
        {shortTxHash(hash)}
      </a>
      <button
        type="button"
        onClick={() => void onCopy()}
        className="shrink-0 rounded-lg border border-[color:var(--line)] bg-[color:var(--bg-2)] px-2 py-1 text-[11px] font-semibold text-[color:var(--ink-2)] transition hover:border-[color:color-mix(in_oklab,var(--accent)_35%,var(--line))] hover:text-[color:var(--ink)]"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

export function TaskSettlementDetails({ task }: { task: TaskApiRecord }) {
  const rows: { label: string; hash: string | null | undefined }[] = [
    { label: "Publish", hash: task.on_chain_tx_publish ?? undefined },
    { label: "x402 settle", hash: task.on_chain_tx_x402_settle ?? undefined },
    { label: "Accept", hash: task.on_chain_tx_accept ?? undefined },
    { label: "Submit evidence", hash: task.on_chain_tx_submit ?? undefined },
    { label: "Verify (markVerified)", hash: task.on_chain_tx_verify ?? undefined },
    { label: "Release", hash: task.on_chain_tx_release ?? undefined },
    { label: "Refund", hash: task.on_chain_tx_refund ?? undefined },
  ];

  const filled = rows.filter((r) => r.hash && String(r.hash).length > 2);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-[color:var(--line)] bg-[color:var(--bg-2)] px-4 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--mute)]">Bounty</div>
          <div className="mt-1 text-lg font-bold tabular-nums text-[color:var(--accent)]">
            ${microsToUsdc(task.bounty_micros)}{" "}
            <span className="text-xs font-medium text-[color:var(--mute)]">{task.token ?? "USDC"}</span>
          </div>
        </div>
        <div className="rounded-xl border border-[color:var(--line)] bg-[color:var(--bg-2)] px-4 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--mute)]">Escrow fee</div>
          <div className="mt-1 text-lg font-bold tabular-nums text-[color:var(--ink)]">
            ${microsToUsdc(task.fee_micros)}{" "}
            <span className="text-xs font-medium text-[color:var(--mute)]">{task.token ?? "USDC"}</span>
          </div>
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--mute)]">Timeline</h3>
        <ul className="space-y-1.5 text-sm text-[color:var(--ink)]">
          <li>
            <span className="text-[color:var(--mute)]">Created:</span> {formatWhen(task.created_at)}
          </li>
          <li>
            <span className="text-[color:var(--mute)]">Deadline:</span> {formatWhen(task.deadline_at)}
          </li>
          <li>
            <span className="text-[color:var(--mute)]">Accepted:</span> {formatWhen(task.accepted_at)}
          </li>
          <li>
            <span className="text-[color:var(--mute)]">Submitted:</span> {formatWhen(task.submitted_at)}
          </li>
          <li>
            <span className="text-[color:var(--mute)]">Verified:</span> {formatWhen(task.verified_at)}
          </li>
          <li>
            <span className="text-[color:var(--mute)]">Settled:</span> {formatWhen(task.settled_at)}
          </li>
          <li>
            <span className="text-[color:var(--mute)]">Updated:</span> {formatWhen(task.updated_at)}
          </li>
        </ul>
      </div>

      {filled.length > 0 ? (
        <div>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--mute)]">
            On-chain transactions
          </h3>
          <div className="rounded-xl border border-[color:var(--line)] bg-[color:var(--bg-2)] px-3">
            {filled.map((r) => (
              <TxRow key={r.label} label={r.label} hash={r.hash!} />
            ))}
          </div>
          <p className="mt-2 text-[11px] text-[color:var(--mute)]">
            Explorer: opBNB Testnet ·{" "}
            <a
              href={explorerOrigin()}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[color:var(--accent)] underline-offset-2 hover:underline"
            >
              testnet.opbnbscan.com
            </a>
          </p>
        </div>
      ) : (
        <p className="text-sm text-[color:var(--mute)]">No transaction hashes recorded yet.</p>
      )}
    </div>
  );
}
