"use client";

import Link from "next/link";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useCallback, useMemo, useState } from "react";
import { type Address, getAddress, type Hex } from "viem";
import { useAccount, useSignTypedData } from "wagmi";

import { usePrivyConfigured } from "@/app/providers";
import { BtnPrimary } from "@/components/ui/Button";
import { createTask, type TaskCreateBody } from "@/lib/api";
import { ESCROW_FEE_BPS, feeMicrosFromBounty } from "@/lib/constants";
import {
  authorizationFromSignature,
  buildTransferWithAuthorizationSignArgs,
  encodeXPaymentHeader,
  getEscrowAddressEnv,
  getMockUsdcAddressEnv,
  randomNonceHex32,
} from "@/lib/x402-eip3009";

function shortAddr(a: string) {
  if (a.length < 14) return a;
  return `${a.slice(0, 8)}…${a.slice(-6)}`;
}

const CATEGORIES = [
  { value: "physical_presence", label: "Physical presence" },
  { value: "knowledge_access", label: "Knowledge access" },
  { value: "human_authority", label: "Human authority" },
  { value: "agent_to_agent", label: "Agent to agent" },
  { value: "simple_action", label: "Simple action" },
] as const;

const devSkipAllowed =
  process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_ALLOW_X402_SKIP === "true";

const inputClass =
  "w-full rounded-[14px] border border-az-stroke-2 bg-white/[0.04] px-4 py-3 text-sm text-az-text outline-none placeholder:text-az-muted focus:border-[rgba(182,242,74,0.35)]";

export function PostTaskForm() {
  const privyOk = usePrivyConfigured();
  const { authenticated, login } = usePrivy();
  const { address } = useAccount();
  const { wallets } = useWallets();
  const { signTypedDataAsync } = useSignTypedData();

  const wallet =
    (address as string | undefined) ||
    (wallets[0]?.address as string | undefined) ||
    undefined;

  const normalizedWallet = useMemo(() => {
    if (!wallet) return undefined;
    try {
      return getAddress(wallet);
    } catch {
      return undefined;
    }
  }, [wallet]);

  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [category, setCategory] = useState<string>(CATEGORIES[0].value);
  const [bountyUsdc, setBountyUsdc] = useState("");
  const [deadlineLocal, setDeadlineLocal] = useState("");
  const [skipPayment, setSkipPayment] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<{ task_id: string; tx?: string } | null>(null);

  const bountyMicros = useMemo(() => {
    const n = parseFloat(bountyUsdc);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return Math.round(n * 1_000_000);
  }, [bountyUsdc]);

  const feeMicros = useMemo(() => feeMicrosFromBounty(bountyMicros), [bountyMicros]);
  const totalMicros = bountyMicros + feeMicros;

  const mockUsdc = getMockUsdcAddressEnv();
  const escrow = getEscrowAddressEnv();

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setErr(null);
      setResult(null);
      if (!normalizedWallet) {
        setErr("Connect a wallet first.");
        return;
      }
      if (!title.trim() || !instructions.trim()) {
        setErr("Title and instructions are required.");
        return;
      }
      if (bountyMicros <= 0) {
        setErr("Enter a bounty greater than zero.");
        return;
      }
      if (!deadlineLocal) {
        setErr("Choose a deadline.");
        return;
      }
      const deadline_at = new Date(deadlineLocal).toISOString();

      const body: TaskCreateBody = {
        requester_wallet: normalizedWallet,
        requester_erc8004_id: 0,
        title: title.trim(),
        instructions: instructions.trim(),
        category,
        bounty_micros: bountyMicros,
        deadline_at,
      };

      setBusy(true);
      try {
        if (devSkipAllowed && skipPayment) {
          const res = await createTask(body, { xPaymentSkip: true });
          setResult({ task_id: res.task_id, tx: res.on_chain_tx_publish });
          return;
        }
        if (mockUsdc && escrow) {
          const validAfter = 0;
          const validBefore = Math.floor(Date.now() / 1000) + 600;
          const nonce = randomNonceHex32();
          const args = buildTransferWithAuthorizationSignArgs({
            mockUsdc,
            escrow,
            from: normalizedWallet as Address,
            totalMicros,
            validAfter,
            validBefore,
            nonce,
          });
          const sig = await signTypedDataAsync({
            ...args,
            account: normalizedWallet as Address,
          });
          const auth = authorizationFromSignature({
            from: normalizedWallet as Address,
            to: escrow,
            totalMicros,
            validAfter,
            validBefore,
            nonce: nonce as Hex,
            signature: sig,
          });
          const xPayment = encodeXPaymentHeader(auth);
          const res = await createTask(body, { xPayment });
          setResult({ task_id: res.task_id, tx: res.on_chain_tx_publish });
          return;
        }
        const res = await createTask(body);
        setResult({ task_id: res.task_id, tx: res.on_chain_tx_publish });
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Request failed");
      } finally {
        setBusy(false);
      }
    },
    [
      normalizedWallet,
      title,
      instructions,
      category,
      bountyMicros,
      totalMicros,
      deadlineLocal,
      skipPayment,
      mockUsdc,
      escrow,
      signTypedDataAsync,
    ],
  );

  if (!privyOk) {
    return (
      <p className="text-sm text-amber-200/90">
        Set <code className="rounded bg-black/30 px-1">NEXT_PUBLIC_PRIVY_APP_ID</code> to use wallet actions.
      </p>
    );
  }

  if (!authenticated) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-az-muted-2">Connect your wallet to publish a task.</p>
        <BtnPrimary type="button" onClick={() => login()}>
          Connect wallet
        </BtnPrimary>
      </div>
    );
  }

  if (result) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-[#cdf56a]">
          Task published: <code className="break-all text-az-text">{result.task_id}</code>
        </p>
        {result.tx ? (
          <p className="text-xs text-az-muted-2">
            Tx: <code className="break-all">{result.tx}</code>
          </p>
        ) : null}
        <Link
          href={`/tasks/${result.task_id}`}
          className="inline-block text-sm font-semibold text-[#cdf56a] underline underline-offset-2"
        >
          View task
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="rounded-[14px] border border-az-stroke-2 bg-white/[0.03] px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-az-muted">Signing address</p>
        <p className="mt-1 font-mono text-sm text-az-text">{normalizedWallet ? shortAddr(normalizedWallet) : "—"}</p>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold text-az-muted-2" htmlFor="pt-title">
          Title
        </label>
        <input
          id="pt-title"
          className={inputClass}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Short task title"
          autoComplete="off"
        />
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold text-az-muted-2" htmlFor="pt-instructions">
          Instructions
        </label>
        <textarea
          id="pt-instructions"
          className={`${inputClass} min-h-[120px] resize-y`}
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="What the executor should do"
        />
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold text-az-muted-2" htmlFor="pt-category">
          Category
        </label>
        <select
          id="pt-category"
          className={inputClass}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-xs font-semibold text-az-muted-2" htmlFor="pt-bounty">
            Bounty (USDC)
          </label>
          <input
            id="pt-bounty"
            className={inputClass}
            inputMode="decimal"
            value={bountyUsdc}
            onChange={(e) => setBountyUsdc(e.target.value)}
            placeholder="e.g. 10"
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-semibold text-az-muted-2" htmlFor="pt-deadline">
            Deadline (local)
          </label>
          <input
            id="pt-deadline"
            type="datetime-local"
            className={inputClass}
            value={deadlineLocal}
            onChange={(e) => setDeadlineLocal(e.target.value)}
          />
        </div>
      </div>

      <div className="rounded-[14px] border border-az-stroke-2 bg-white/[0.02] px-4 py-3 text-sm text-az-muted-2">
        <p>
          Escrow fee ({ESCROW_FEE_BPS / 100}% of bounty):{" "}
          <span className="font-mono text-az-text">
            {(feeMicros / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 6 })} USDC
          </span>
        </p>
        <p className="mt-1">
          Total authorization (bounty + fee):{" "}
          <span className="font-mono text-[#cdf56a]">
            {(totalMicros / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 6 })} USDC
          </span>{" "}
          <span className="text-az-muted">({totalMicros.toLocaleString()} µUSDC)</span>
        </p>
        {!mockUsdc || !escrow ? (
          <p className="mt-2 text-xs text-amber-200/80">
            Set <code className="rounded bg-black/30 px-1">NEXT_PUBLIC_MOCK_USDC_ADDRESS</code> and{" "}
            <code className="rounded bg-black/30 px-1">NEXT_PUBLIC_EM_ESCROW_ADDRESS</code> to sign x402 payments in the
            browser. Without them, publish only works if the API has x402 enforcement off.
          </p>
        ) : null}
      </div>

      {devSkipAllowed ? (
        <label className="flex cursor-pointer items-start gap-3 text-sm text-az-muted-2">
          <input
            type="checkbox"
            className="mt-1 rounded border-az-stroke-2"
            checked={skipPayment}
            onChange={(e) => setSkipPayment(e.target.checked)}
          />
          <span>
            Skip x402 payment (local dev only). Sends <code className="rounded bg-black/20 px-1">X-PAYMENT-SKIP: 1</code>{" "}
            — requires API <code className="rounded bg-black/20 px-1">ENVIRONMENT=development</code>.
          </span>
        </label>
      ) : null}

      {err ? <p className="text-sm text-amber-300/90 [text-wrap:pretty]">{err}</p> : null}

      <BtnPrimary type="submit" disabled={busy}>
        {busy ? "Publishing…" : "Publish task"}
      </BtnPrimary>
    </form>
  );
}
