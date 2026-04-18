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

  if (!configured) {
    return (
      <p className="text-sm text-az-muted-2">
        Connect a wallet (configure <code className="az-mono rounded bg-white/10 px-1">NEXT_PUBLIC_PRIVY_APP_ID</code>) to
        see balances.
      </p>
    );
  }

  if (!isConnected || !address) {
    return <p className="text-sm text-az-muted-2">Use Connect in the header to view your wallet.</p>;
  }

  const mintBusy = isWritePending || isConfirming;

  return (
    <>
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="relative overflow-hidden border-[rgba(182,242,74,0.15)] bg-[linear-gradient(135deg,rgba(182,242,74,0.08),rgba(20,32,26,0.7))] p-6 az-animate-fade-up">
          <div className="absolute right-5 top-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--green-dim)] text-xl">
            💰
          </div>
          <div className="mb-1.5 text-xs font-medium text-az-muted-2">Native balance</div>
          <div className="text-4xl font-extrabold tracking-tight text-[#cdf56a] [font-variant-numeric:tabular-nums]">
            {isLoading ? "…" : fmtEth(data?.value, data?.decimals ?? 18)}
          </div>
          <div className="mt-1 text-sm text-az-muted-2">
            {data?.symbol ?? "tBNB"} · opBNB Testnet
          </div>
          <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-[rgba(182,242,74,0.15)] px-2 py-0.5 text-[11px] font-semibold text-[#cdf56a]">
            Connected
          </span>
        </Card>

        <Card className="relative overflow-hidden p-6 az-animate-fade-up" style={{ animationDelay: "0.05s" }}>
          <div className="absolute right-5 top-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgba(91,156,245,0.12)] text-xl">
            🔒
          </div>
          <div className="mb-1.5 text-xs font-medium text-az-muted-2">Locked in Escrow</div>
          <div className="text-4xl font-extrabold tracking-tight text-az-text [font-variant-numeric:tabular-nums]">
            {escrowLoading ? (
              "…"
            ) : escrowError ? (
              "—"
            ) : (
              `${fmtMicrosDecimalString(escrowLockedMicros ?? "0")} USDC`
            )}
          </div>
          <div className="mt-1 text-sm text-az-muted-2">
            {!escrowLoading && !escrowError
              ? `Requester totals · ${escrowTaskCount} task${escrowTaskCount === 1 ? "" : "s"} · DB snapshot`
              : "Tasks you publish as requester (bounty + fee)"}
          </div>
          {escrowError ? (
            <p className="mt-2 text-[11px] text-amber-300/90 [text-wrap:pretty]">{escrowError}</p>
          ) : null}
          {!escrowLoading && !escrowError ? (
            <span className="mt-2 inline-flex rounded-full bg-[rgba(91,156,245,0.12)] px-2 py-0.5 text-[11px] font-semibold text-az-blue">
              Live
            </span>
          ) : null}
        </Card>

        <Card className="relative overflow-hidden p-6 az-animate-fade-up" style={{ animationDelay: "0.1s" }}>
          <div className="absolute right-5 top-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgba(167,139,250,0.12)] text-xl">
            📊
          </div>
          <div className="mb-1.5 flex items-start justify-between gap-2 pr-14">
            <div className="text-xs font-medium text-az-muted-2">USDC (Mock)</div>
            <span className="shrink-0 rounded-full bg-[rgba(182,242,74,0.15)] px-2 py-0.5 text-[11px] font-semibold text-[#cdf56a]">
              {mockUsdc ? "Faucet" : "Demo UI"}
            </span>
          </div>
          <div className="text-4xl font-extrabold tracking-tight text-az-text [font-variant-numeric:tabular-nums]">
            {mockUsdc ? (usdcBalLoading && usdcBalance == null ? "…" : `${fmtUsdcMicros(usdcBalance)} USDC`) : "—"}
          </div>
          <div className="mt-1 text-sm text-az-muted-2">
            {mockUsdc ? "opBNB Testnet · 6 decimals" : "Set NEXT_PUBLIC_MOCK_USDC_ADDRESS for balance + faucet"}
          </div>
          {mockUsdc ? (
            <>
              <p className="mt-2 text-[11px] leading-snug text-az-muted">
                Mint test tokens for x402 / publish flows. Requires tBNB for gas.
              </p>
              <button
                type="button"
                disabled={mintBusy}
                onClick={() => void onMint()}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-transparent bg-az-btn-green py-2.5 text-[12px] font-bold text-[#0d1a0f] shadow-az-btn-green transition hover:-translate-y-px disabled:opacity-50"
              >
                {mintBusy ? "Confirming…" : `Mint ${faucetLabelUsdc.toLocaleString()} test USDC`}
              </button>
              {mintErr ? (
                <p className="mt-2 text-[11px] text-amber-300/90 [text-wrap:pretty]">{mintErr}</p>
              ) : null}
            </>
          ) : null}
        </Card>
      </div>

      <div className="mb-6 flex flex-wrap gap-3">
        <button
          type="button"
          className="flex flex-1 min-w-[140px] items-center justify-center gap-2.5 rounded-2xl border border-transparent bg-az-btn-green py-3.5 text-[13px] font-bold text-[#0d1a0f] shadow-az-btn-green transition hover:-translate-y-px"
        >
          <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
          Deposit USDC
        </button>
        <button
          type="button"
          className="flex flex-1 min-w-[140px] items-center justify-center gap-2.5 rounded-2xl border border-az-stroke-2 bg-white/[0.04] py-3.5 text-[13px] font-bold text-az-text transition hover:bg-white/[0.08]"
        >
          <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M7 17L17 7M9 7h8v8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          Withdraw
        </button>
        <button
          type="button"
          className="flex flex-1 min-w-[140px] items-center justify-center gap-2.5 rounded-2xl border border-[rgba(167,139,250,0.2)] bg-[rgba(167,139,250,0.08)] py-3.5 text-[13px] font-bold text-az-purple transition hover:bg-[rgba(167,139,250,0.12)]"
        >
          <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M7 4v16M7 20l-3-3M7 4l3 3M17 20V4M17 4l3 3M17 20l-3-3"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
          Swap
        </button>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-az-stroke px-5 py-4">
          <h3 className="text-base font-bold text-az-text">Transaction History</h3>
          <div className="flex gap-0.5 rounded-full border border-az-stroke bg-white/[0.04] p-1">
            {ACTIVITY_FILTERS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setActivityFilter(key)}
                className={`rounded-full px-3 py-1.5 text-[11px] font-semibold ${
                  activityFilter === key ? "bg-white/[0.08] text-white" : "text-az-muted-2 hover:text-az-text"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="px-5 pb-5 pt-3">
          {activityLoading ? (
            <p className="text-sm text-az-muted-2">Loading activity…</p>
          ) : activityError ? (
            <p className="text-sm text-amber-300/90 [text-wrap:pretty]">{activityError}</p>
          ) : filteredActivity.length === 0 ? (
            <p className="text-sm text-az-muted-2 [text-wrap:pretty]">
              {activityItems.length === 0
                ? "No on-chain task activity yet. Publish or accept tasks to see escrow and settlement txs here."
                : "Nothing in this filter. Try All or another tab."}
            </p>
          ) : (
            <div className="max-h-[min(420px,50vh)] overflow-auto rounded-xl border border-az-stroke bg-white/[0.02]">
              <table className="w-full border-collapse text-left text-[13px]">
                <thead className="sticky top-0 z-[1] border-b border-az-stroke bg-[rgba(14,22,18,0.95)] backdrop-blur-sm">
                  <tr className="text-[11px] font-semibold uppercase tracking-wide text-az-muted-2">
                    <th className="px-3 py-2.5 font-semibold">Type</th>
                    <th className="px-3 py-2.5 font-semibold">Task</th>
                    <th className="hidden sm:table-cell px-3 py-2.5 font-semibold">When</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Tx</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredActivity.map((row) => (
                    <tr key={row.id} className="border-b border-az-stroke/80 last:border-0">
                      <td className="px-3 py-2.5 align-top text-az-text">
                        <span className="font-medium">{kindLabel(row.kind)}</span>
                        <span className="mt-0.5 block text-[11px] capitalize text-az-muted-2">
                          {row.role} · {row.bucket}
                        </span>
                      </td>
                      <td className="max-w-[200px] px-3 py-2.5 align-top text-az-muted">
                        <span className="line-clamp-2" title={row.title}>
                          {row.title || row.task_id}
                        </span>
                      </td>
                      <td className="hidden sm:table-cell whitespace-nowrap px-3 py-2.5 align-top text-az-muted-2">
                        {fmtActivityWhen(row.occurred_at)}
                      </td>
                      <td className="px-3 py-2.5 text-right align-top">
                        <a
                          href={explorerTxUrl(row.tx_hash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="az-mono text-[12px] font-medium text-[#cdf56a] underline-offset-2 hover:underline"
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
