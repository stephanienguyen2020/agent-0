"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAccount, useBalance, useReadContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";

import { usePrivyConfigured } from "@/app/providers";
import { Card } from "@/components/ui/Card";
import { fetchWalletActivity, fetchWalletEscrowLocked, type WalletActivityItem } from "@/lib/api";
import { explorerTxUrl, shortTxHash } from "@/lib/explorer";
import { getFaucetMintAmount, mockUsdcAbi } from "@/lib/mock-usdc-abi";
import { getMockUsdcAddressEnv } from "@/lib/x402-eip3009";

function fmtEth(wei: bigint | undefined, decimals: number) {
  if (wei == null) return "—";
  const v = Number(wei) / 10 ** decimals;
  if (v < 0.0001 && v > 0) return v.toExponential(2);
  return v.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

function fmtUsdcMicros(micros: bigint | undefined) {
  if (micros == null) return "—";
  const v = Number(micros) / 1_000_000;
  return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function fmtMicrosDecimalString(s: string): string {
  try {
    return fmtUsdcMicros(BigInt(s));
  } catch {
    return "—";
  }
}

type ActivityFilter = "all" | "earned" | "spent" | "escrow";

const ACTIVITY_FILTERS: { key: ActivityFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "earned", label: "Earned" },
  { key: "spent", label: "Spent" },
  { key: "escrow", label: "Escrow" },
];

function kindLabel(kind: string): string {
  const m: Record<string, string> = {
    publish: "Publish task",
    x402_settle: "x402 settle",
    accept: "Accept",
    submit: "Submit",
    verify: "Verify",
    release: "Release / payout",
    refund: "Refund",
  };
  return m[kind] ?? kind;
}

function fmtActivityWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
  } catch {
    return "—";
  }
}

function IconCoin() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden className="text-[color:var(--accent)]">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 7v10M9 10h4.5a2 2 0 010 4H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
    </svg>
  );
}

function IconLock() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden className="text-[color:var(--accent-2)]">
      <rect x="5" y="10" width="14" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 10V7a4 4 0 018 0v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
    </svg>
  );
}

function IconLedger() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden className="text-[color:var(--ink-2)]">
      <path d="M4 7h16M4 12h10M4 17h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
    </svg>
  );
}

export function WalletDashboard() {
  const configured = usePrivyConfigured();
  const { address, isConnected } = useAccount();
  const { data, isLoading } = useBalance({ address });

  const mockUsdc = useMemo(() => getMockUsdcAddressEnv(), []);
  const faucetMint = useMemo(() => getFaucetMintAmount(), []);
  const faucetLabelUsdc = useMemo(() => Number(faucetMint) / 1_000_000, [faucetMint]);

  const usdcQueryEnabled = Boolean(configured && isConnected && address && mockUsdc);

  const {
    data: usdcBalance,
    refetch: refetchUsdc,
    isFetching: usdcBalLoading,
  } = useReadContract({
    address: mockUsdc ?? undefined,
    abi: mockUsdcAbi,
    functionName: "balanceOf",
    args: address && mockUsdc ? [address] : undefined,
    query: { enabled: usdcQueryEnabled },
  });

  const { writeContractAsync, isPending: isWritePending } = useWriteContract();
  const [mintTxHash, setMintTxHash] = useState<`0x${string}` | undefined>();
  const [mintErr, setMintErr] = useState<string | null>(null);

  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("all");
  const [activityItems, setActivityItems] = useState<WalletActivityItem[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState<string | null>(null);

  const [escrowLockedMicros, setEscrowLockedMicros] = useState<string | null>(null);
  const [escrowTaskCount, setEscrowTaskCount] = useState(0);
  const [escrowLoading, setEscrowLoading] = useState(false);
  const [escrowError, setEscrowError] = useState<string | null>(null);

  const { isLoading: isConfirming, isSuccess: mintConfirmed } = useWaitForTransactionReceipt({
    hash: mintTxHash,
  });

  useEffect(() => {
    if (!mintConfirmed || !mintTxHash) return;
    void refetchUsdc();
    setMintTxHash(undefined);
    setMintErr(null);
  }, [mintConfirmed, mintTxHash, refetchUsdc]);

  useEffect(() => {
    if (!address) {
      setActivityItems([]);
      setActivityError(null);
      return;
    }
    let cancelled = false;
    setActivityLoading(true);
    setActivityError(null);
    void fetchWalletActivity(address, { limit: 50 })
      .then((res) => {
        if (!cancelled) setActivityItems(res.items);
      })
      .catch((e: unknown) => {
        if (!cancelled) setActivityError(e instanceof Error ? e.message : "Failed to load activity");
      })
      .finally(() => {
        if (!cancelled) setActivityLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [address]);

  useEffect(() => {
    if (!address) {
      setEscrowLockedMicros(null);
      setEscrowTaskCount(0);
      setEscrowError(null);
      return;
    }
    let cancelled = false;
    setEscrowLoading(true);
    setEscrowError(null);
    void fetchWalletEscrowLocked(address)
      .then((res) => {
        if (!cancelled) {
          setEscrowLockedMicros(res.locked_micros);
          setEscrowTaskCount(res.task_count);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setEscrowError(e instanceof Error ? e.message : "Failed to load escrow total");
      })
      .finally(() => {
        if (!cancelled) setEscrowLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [address]);

  const filteredActivity = useMemo(() => {
    if (activityFilter === "all") return activityItems;
    return activityItems.filter((it) => it.bucket === activityFilter);
  }, [activityItems, activityFilter]);

  const onMint = useCallback(async () => {
    if (!mockUsdc || !address) return;
    setMintErr(null);
    try {
      const h = await writeContractAsync({
        address: mockUsdc,
        abi: mockUsdcAbi,
        functionName: "mint",
        args: [faucetMint],
      });
      setMintTxHash(h);
    } catch (e) {
      setMintErr(e instanceof Error ? e.message : "Mint failed");
    }
  }, [address, mockUsdc, faucetMint, writeContractAsync]);

  const mutedProse = "text-sm leading-relaxed text-[color:var(--ink-2)]";

  if (!configured) {
    return (
      <p className={mutedProse}>
        Connect a wallet (configure{" "}
        <code className="az-mono rounded-md border border-[color:var(--line)] bg-[color:var(--bg-2)] px-1.5 py-0.5 text-[12px] text-[color:var(--ink)]">
          NEXT_PUBLIC_PRIVY_APP_ID
        </code>
        ) to see balances.
      </p>
    );
  }

  if (!isConnected || !address) {
    return <p className={mutedProse}>Use Connect in the header to view your wallet.</p>;
  }

  const mintBusy = isWritePending || isConfirming;

  return (
    <>
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="dashboard-reveal relative overflow-hidden p-6 shadow-[var(--shadow-soft)]">
          <div className="absolute right-5 top-5 flex h-11 w-11 items-center justify-center rounded-[10px] border border-[color:var(--line)] bg-[color:var(--bg-2)]">
            <IconCoin />
          </div>
          <div className="az-mono mb-1.5 text-[10.5px] font-medium uppercase tracking-[0.12em] text-[color:var(--mute)]">
            Native balance
          </div>
          <div
            className="text-[clamp(28px,4vw,40px)] font-normal tabular-nums leading-none tracking-[-0.02em] text-[color:var(--ink)]"
            style={{ fontFamily: "var(--font-instrument-serif), ui-serif, Georgia, serif" }}
          >
            {isLoading ? "…" : fmtEth(data?.value, data?.decimals ?? 18)}
          </div>
          <div className="mt-1 text-[13px] text-[color:var(--ink-2)]">
            {data?.symbol ?? "tBNB"} · opBNB testnet
          </div>
          <span className="az-mono mt-2 inline-flex items-center gap-1 rounded-full border border-[color:var(--line)] bg-[color:var(--bg-2)] px-2 py-0.5 text-[11px] font-semibold text-[color:var(--accent)]">
            <span className="live-dot h-1.5 w-1.5 rounded-full bg-[color:var(--accent)]" aria-hidden />
            Connected
          </span>
        </Card>

        <Card className="dashboard-reveal dashboard-reveal-d2 relative overflow-hidden p-6 shadow-[var(--shadow-soft)]">
          <div className="absolute right-5 top-5 flex h-11 w-11 items-center justify-center rounded-[10px] border border-[color:var(--line)] bg-[color:var(--bg-2)]">
            <IconLock />
          </div>
          <div className="az-mono mb-1.5 text-[10.5px] font-medium uppercase tracking-[0.12em] text-[color:var(--mute)]">
            Locked in escrow
          </div>
          <div
            className="text-[clamp(28px,4vw,40px)] font-normal tabular-nums leading-none tracking-[-0.02em] text-[color:var(--ink)]"
            style={{ fontFamily: "var(--font-instrument-serif), ui-serif, Georgia, serif" }}
          >
            {escrowLoading ? "…" : escrowError ? "—" : `${fmtMicrosDecimalString(escrowLockedMicros ?? "0")} USDC`}
          </div>
          <div className="mt-1 text-[13px] text-[color:var(--ink-2)]">
            {!escrowLoading && !escrowError
              ? `Requester totals · ${escrowTaskCount} task${escrowTaskCount === 1 ? "" : "s"} · DB snapshot`
              : "Tasks you publish as requester (bounty + fee)"}
          </div>
          {escrowError ? (
            <p className="mt-2 text-[11px] leading-snug text-[color:var(--danger)] [text-wrap:pretty]">{escrowError}</p>
          ) : null}
          {!escrowLoading && !escrowError ? (
            <span className="az-mono mt-2 inline-flex rounded-full border border-[color:var(--line)] bg-[color:var(--bg-2)] px-2 py-0.5 text-[11px] font-semibold text-[color:var(--accent)]">
              Live
            </span>
          ) : null}
        </Card>

        <Card className="dashboard-reveal dashboard-reveal-d3 relative overflow-hidden p-6 shadow-[var(--shadow-soft)]">
          <div className="absolute right-5 top-5 flex h-11 w-11 items-center justify-center rounded-[10px] border border-[color:var(--line)] bg-[color:var(--bg-2)]">
            <IconLedger />
          </div>
          <div className="mb-1.5 flex items-start justify-between gap-2 pr-14">
            <div className="az-mono text-[10.5px] font-medium uppercase tracking-[0.12em] text-[color:var(--mute)]">
              USDC (mock)
            </div>
            <span className="az-mono shrink-0 rounded-full border border-[color:var(--line)] bg-[color:var(--bg-2)] px-2 py-0.5 text-[11px] font-semibold text-[color:var(--accent)]">
              {mockUsdc ? "Faucet" : "Demo UI"}
            </span>
          </div>
          <div
            className="text-[clamp(28px,4vw,40px)] font-normal tabular-nums leading-none tracking-[-0.02em] text-[color:var(--ink)]"
            style={{ fontFamily: "var(--font-instrument-serif), ui-serif, Georgia, serif" }}
          >
            {mockUsdc ? (usdcBalLoading && usdcBalance == null ? "…" : `${fmtUsdcMicros(usdcBalance)} USDC`) : "—"}
          </div>
          <div className="mt-1 text-[13px] text-[color:var(--ink-2)]">
            {mockUsdc ? "opBNB testnet · 6 decimals" : "Set NEXT_PUBLIC_MOCK_USDC_ADDRESS for balance + faucet"}
          </div>
          {mockUsdc ? (
            <>
              <p className="mt-2 text-[11px] leading-snug text-[color:var(--mute)]">
                Mint test tokens for x402 / publish flows. Requires tBNB for gas.
              </p>
              <button
                type="button"
                disabled={mintBusy}
                onClick={() => void onMint()}
                className="dashboard-btn mt-3 inline-flex w-full items-center justify-center rounded-full border border-[color:var(--ink)] bg-[color:var(--ink)] py-2.5 text-[12px] font-semibold text-[color:var(--bg)] disabled:opacity-50"
              >
                {mintBusy ? "Confirming…" : `Mint ${faucetLabelUsdc.toLocaleString()} test USDC`}
              </button>
              {mintErr ? (
                <p className="mt-2 text-[11px] leading-snug text-[color:var(--danger)] [text-wrap:pretty]">{mintErr}</p>
              ) : null}
            </>
          ) : null}
        </Card>
      </div>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          className="dashboard-btn flex min-h-[48px] w-full min-w-0 flex-1 items-center justify-center gap-2 rounded-full border border-[color:var(--ink)] bg-[color:var(--ink)] py-3.5 text-[13px] font-semibold text-[color:var(--bg)] sm:min-w-[140px]"
        >
          <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" />
          </svg>
          Deposit USDC
        </button>
        <button
          type="button"
          className="dashboard-btn flex min-h-[48px] w-full min-w-0 flex-1 items-center justify-center gap-2 rounded-full border border-[color:var(--line)] bg-transparent py-3.5 text-[13px] font-semibold text-[color:var(--ink)] hover:bg-[color:var(--bg-2)] sm:min-w-[140px]"
        >
          <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M7 17L17 7M9 7h8v8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
          </svg>
          Withdraw
        </button>
        <button
          type="button"
          className="dashboard-btn flex min-h-[48px] w-full min-w-0 flex-1 items-center justify-center gap-2 rounded-full border border-[color:var(--line)] bg-[color:var(--bg-2)] py-3.5 text-[13px] font-semibold text-[color:var(--ink)] sm:min-w-[140px]"
        >
          <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M7 4v16M7 20l-3-3M7 4l3 3M17 20V4M17 4l3 3M17 20l-3-3"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="square"
            />
          </svg>
          Swap
        </button>
      </div>

      <Card className="overflow-hidden p-0 shadow-[var(--shadow-soft)]">
        <div className="flex flex-col gap-3 border-b border-[color:var(--line)] px-4 py-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-5">
          <h3
            className="text-[17px] font-normal text-[color:var(--ink)]"
            style={{ fontFamily: "var(--font-instrument-serif), ui-serif, Georgia, serif" }}
          >
            Transaction history
          </h3>
          <div className="flex max-w-full gap-0.5 overflow-x-auto rounded-full border border-[color:var(--line)] bg-[color:var(--bg-2)] p-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {ACTIVITY_FILTERS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setActivityFilter(key)}
                className={`rounded-full px-3 py-1.5 text-[11px] font-semibold ${
                  activityFilter === key
                    ? "bg-[color:var(--card)] text-[color:var(--ink)] shadow-[0_1px_2px_color-mix(in_oklab,var(--ink)_12%,transparent)]"
                    : "text-[color:var(--mute)] hover:text-[color:var(--ink)]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="px-5 pb-5 pt-3">
          {activityLoading ? (
            <p className="text-sm leading-relaxed text-[color:var(--ink-2)]">Loading activity…</p>
          ) : activityError ? (
            <p className="text-sm leading-relaxed text-[color:var(--danger)] [text-wrap:pretty]">{activityError}</p>
          ) : filteredActivity.length === 0 ? (
            <p className="text-sm leading-relaxed text-[color:var(--ink-2)] [text-wrap:pretty]">
              {activityItems.length === 0
                ? "No on-chain task activity yet. Publish or accept tasks to see escrow and settlement txs here."
                : "Nothing in this filter. Try All or another tab."}
            </p>
          ) : (
            <div className="max-h-[min(420px,50vh)] overflow-auto rounded-xl border border-[color:var(--line)] bg-[color:var(--bg-2)]">
              <table className="w-full border-collapse text-left text-[13px]">
                <thead className="sticky top-0 z-[1] border-b border-[color:var(--line)] bg-[color:var(--card)]">
                  <tr className="az-mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[color:var(--mute)]">
                    <th className="px-3 py-2.5 font-semibold">Type</th>
                    <th className="px-3 py-2.5 font-semibold">Task</th>
                    <th className="hidden sm:table-cell px-3 py-2.5 font-semibold">When</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Tx</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredActivity.map((row) => (
                    <tr key={row.id} className="border-b border-[color:var(--line-2)] last:border-0">
                      <td className="px-3 py-2.5 align-top text-[color:var(--ink)]">
                        <span className="font-medium">{kindLabel(row.kind)}</span>
                        <span className="mt-0.5 block text-[11px] capitalize text-[color:var(--mute)]">
                          {row.role} · {row.bucket}
                        </span>
                      </td>
                      <td className="max-w-[200px] px-3 py-2.5 align-top text-[color:var(--ink-2)]">
                        <span className="line-clamp-2" title={row.title}>
                          {row.title || row.task_id}
                        </span>
                      </td>
                      <td className="hidden whitespace-nowrap px-3 py-2.5 align-top text-[color:var(--mute)] sm:table-cell">
                        {fmtActivityWhen(row.occurred_at)}
                      </td>
                      <td className="px-3 py-2.5 text-right align-top">
                        <a
                          href={explorerTxUrl(row.tx_hash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="az-mono text-[12px] font-medium text-[color:var(--accent)] underline-offset-2 hover:underline"
                        >
                          {shortTxHash(row.tx_hash)}
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>
    </>
  );
}
