"use client";

import Link from "next/link";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useCallback, useEffect, useMemo, useState } from "react";
import { type Address, getAddress, type Hex } from "viem";
import { useAccount, useSignTypedData, useSwitchChain } from "wagmi";

import { usePrivyConfigured } from "@/app/providers";
import { createTask, getEscrowFeeBps, type TaskCreateBody } from "@/lib/api";
import { ESCROW_FEE_BPS } from "@/lib/constants";
import { ensureOpBNBForX402Publish } from "@/lib/ensure-opbnb-chain";
import { wagmiConfig } from "@/lib/wagmi-config";
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

/** Editorial inputs — match Market / TasksMarket tokens inside `.dashboard-editorial`. */
const inputClass =
  "w-full rounded-[14px] border border-[color:var(--line)] bg-[color:var(--card)] px-4 py-3 text-sm outline-none transition-[border-color,box-shadow] " +
  "text-[color:var(--ink)] placeholder:text-[color:var(--mute)] " +
  "focus:border-[color:var(--accent)] focus:ring-1 focus:ring-[color:color-mix(in_oklab,var(--accent)_35%,transparent)]";

function fieldLabelClass() {
  return "az-mono block text-[10px] font-semibold uppercase tracking-[0.14em]";
}

function primaryBtnClass(disabled?: boolean) {
  return [
    "dashboard-btn inline-flex h-11 min-w-[140px] items-center justify-center gap-2 rounded-[14px] px-6 text-[13px] font-semibold transition disabled:opacity-50",
    disabled ? "" : "hover:-translate-y-px",
  ].join(" ");
}

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className={fieldLabelClass()} style={{ color: "var(--mute)" }}>
      {children}
    </label>
  );
}

export function PostTaskForm() {
  const privyOk = usePrivyConfigured();
  const { authenticated, login } = usePrivy();
  const { address } = useAccount();
  const { wallets } = useWallets();
  const { signTypedDataAsync } = useSignTypedData();
  const { switchChainAsync } = useSwitchChain();

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
  const [escrowFeeBps, setEscrowFeeBps] = useState<number>(ESCROW_FEE_BPS);

  useEffect(() => {
    getEscrowFeeBps().then(setEscrowFeeBps).catch(() => {});
  }, []);

  const bountyMicros = useMemo(() => {
    const n = parseFloat(bountyUsdc);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return Math.round(n * 1_000_000);
  }, [bountyUsdc]);

  const feeMicros = useMemo(
    () => Math.floor((bountyMicros * escrowFeeBps) / 10_000),
    [bountyMicros, escrowFeeBps],
  );
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
          await ensureOpBNBForX402Publish({ config: wagmiConfig, switchChainAsync });
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
      switchChainAsync,
    ],
  );

  const panelStyle = {
    border: "1px solid var(--line)",
    background: "var(--card)",
    boxShadow: "var(--shadow-soft)",
  } as const;

  if (!privyOk) {
    return (
      <p className="text-sm leading-relaxed [text-wrap:pretty]" style={{ color: "var(--ink-2)" }}>
        Set{" "}
        <code
          className="rounded-md px-1.5 py-0.5 az-mono text-[12px]"
          style={{ border: "1px solid var(--line)", background: "var(--bg-2)", color: "var(--ink)" }}
        >
          NEXT_PUBLIC_PRIVY_APP_ID
        </code>{" "}
        to use wallet actions.
      </p>
    );
  }

  if (!authenticated) {
    return (
      <div className="space-y-4">
        <p className="text-sm leading-relaxed" style={{ color: "var(--ink-2)" }}>
          Connect your wallet to publish a task.
        </p>
        <button
          type="button"
          onClick={() => login()}
          className={primaryBtnClass()}
          style={{ background: "var(--accent)", color: "var(--bg)", border: "1px solid var(--accent)" }}
        >
          Connect wallet
        </button>
      </div>
    );
  }

  if (result) {
    return (
      <div className="space-y-4">
        <p className="text-sm font-medium" style={{ color: "var(--accent)" }}>
          Task published:{" "}
          <code className="break-all font-mono text-[13px]" style={{ color: "var(--ink)" }}>
            {result.task_id}
          </code>
        </p>
        {result.tx ? (
          <p className="text-xs" style={{ color: "var(--mute)" }}>
            Tx:{" "}
            <code className="break-all font-mono" style={{ color: "var(--ink-2)" }}>
              {result.tx}
            </code>
          </p>
        ) : null}
        <Link
          href={`/tasks/${result.task_id}`}
          className="inline-block text-sm font-semibold underline underline-offset-2"
          style={{ color: "var(--accent)" }}
        >
          View task
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="w-full rounded-[14px] px-4 py-4" style={panelStyle}>
        <p className={fieldLabelClass()} style={{ color: "var(--mute)" }}>
          Signing address
        </p>
        <p className="mt-2 w-full break-all font-mono text-sm" style={{ color: "var(--ink)" }}>
          {normalizedWallet ? shortAddr(normalizedWallet) : "—"}
        </p>
      </div>

      <div className="space-y-2">
        <FieldLabel htmlFor="pt-title">Title</FieldLabel>
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
        <FieldLabel htmlFor="pt-instructions">Instructions</FieldLabel>
        <textarea
          id="pt-instructions"
          className={`${inputClass} min-h-[120px] resize-y`}
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="What the executor should do"
        />
      </div>

      <div className="space-y-2">
        <FieldLabel htmlFor="pt-category">Category</FieldLabel>
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

      <div className="grid w-full gap-4 sm:grid-cols-2">
        <div className="min-w-0 space-y-2">
          <FieldLabel htmlFor="pt-bounty">Bounty (USDC)</FieldLabel>
          <input
            id="pt-bounty"
            className={inputClass}
            inputMode="decimal"
            value={bountyUsdc}
            onChange={(e) => setBountyUsdc(e.target.value)}
            placeholder="e.g. 10"
          />
        </div>
        <div className="min-w-0 space-y-2">
          <FieldLabel htmlFor="pt-deadline">Deadline (local)</FieldLabel>
          <input
            id="pt-deadline"
            type="datetime-local"
            className={inputClass}
            value={deadlineLocal}
            onChange={(e) => setDeadlineLocal(e.target.value)}
          />
        </div>
      </div>

      <div className="rounded-[14px] px-4 py-4 text-sm" style={panelStyle}>
        <p style={{ color: "var(--ink-2)" }}>
          Escrow fee ({(escrowFeeBps / 100).toFixed(2)}% of bounty):{" "}
          <span className="font-mono" style={{ color: "var(--ink)" }}>
            {(feeMicros / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 6 })} USDC
          </span>
        </p>
        <p className="mt-2" style={{ color: "var(--ink-2)" }}>
          Total authorization (bounty + fee):{" "}
          <span className="font-mono font-medium" style={{ color: "var(--accent)" }}>
            {(totalMicros / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 6 })} USDC
          </span>{" "}
          <span style={{ color: "var(--mute)" }}>({totalMicros.toLocaleString()} µUSDC)</span>
        </p>
        {!mockUsdc || !escrow ? (
          <p
            className="mt-3 rounded-[10px] border px-3 py-2 text-xs leading-relaxed [text-wrap:pretty]"
            style={{
              borderColor: "color-mix(in oklab, var(--accent-2) 45%, var(--line))",
              background: "color-mix(in oklab, var(--accent-2) 8%, var(--card))",
              color: "var(--ink-2)",
            }}
          >
            Set{" "}
            <code
              className="rounded px-1 py-0.5 az-mono text-[11px]"
              style={{ border: "1px solid var(--line)", background: "var(--bg-2)", color: "var(--ink)" }}
            >
              NEXT_PUBLIC_MOCK_USDC_ADDRESS
            </code>{" "}
            and{" "}
            <code
              className="rounded px-1 py-0.5 az-mono text-[11px]"
              style={{ border: "1px solid var(--line)", background: "var(--bg-2)", color: "var(--ink)" }}
            >
              NEXT_PUBLIC_EM_ESCROW_ADDRESS
            </code>{" "}
            to sign x402 payments in the browser. Without them, publish only works if the API has x402 enforcement off.
          </p>
        ) : null}
      </div>

      {devSkipAllowed ? (
        <label className="flex cursor-pointer items-start gap-3 text-sm" style={{ color: "var(--ink-2)" }}>
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 rounded border align-top"
            style={{ borderColor: "var(--line)", accentColor: "var(--accent)" }}
            checked={skipPayment}
            onChange={(e) => setSkipPayment(e.target.checked)}
          />
          <span className="[text-wrap:pretty]">
            Skip x402 payment (local dev only). Sends{" "}
            <code
              className="rounded px-1 py-0.5 az-mono text-[12px]"
              style={{ border: "1px solid var(--line)", background: "var(--bg-2)", color: "var(--ink)" }}
            >
              X-PAYMENT-SKIP: 1
            </code>{" "}
            — requires API{" "}
            <code
              className="rounded px-1 py-0.5 az-mono text-[12px]"
              style={{ border: "1px solid var(--line)", background: "var(--bg-2)", color: "var(--ink)" }}
            >
              ENVIRONMENT=development
            </code>
            .
          </span>
        </label>
      ) : null}

      {err ? (
        <p
          className="rounded-[10px] border px-3 py-2 text-sm [text-wrap:pretty] whitespace-pre-wrap"
          style={{
            borderColor: "color-mix(in oklab, var(--danger) 45%, var(--line))",
            background: "color-mix(in oklab, var(--danger) 8%, var(--card))",
            color: "var(--ink-2)",
          }}
        >
          {err}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={busy}
        className={primaryBtnClass(busy)}
        style={{ background: "var(--accent)", color: "var(--bg)", border: "1px solid var(--accent)" }}
      >
        {busy ? "Publishing…" : "Publish task"}
      </button>
    </form>
  );
}
