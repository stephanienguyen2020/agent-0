"use client";

import Link from "next/link";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getAddress } from "viem";
import { useAccount, useChainId, useSignTypedData, useSwitchChain } from "wagmi";

import { usePrivyConfigured } from "@/app/providers";
import {
  postAssistantChat,
  postDraftChat,
  type AssistantChatResponse,
  type ChatMessage,
  type DraftChatResponse,
  type PendingAction,
  type TaskDraftFromApi,
} from "@/lib/api";
import { publishTaskFromDraft } from "@/lib/publish-task-client";

const devSkipAllowed =
  process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_ALLOW_X402_SKIP === "true";

const inputClass =
  "w-full rounded-[14px] border border-[color:var(--line)] bg-[color:var(--card)] px-4 py-3 text-sm outline-none transition-[border-color,box-shadow] " +
  "text-[color:var(--ink)] placeholder:text-[color:var(--mute)] " +
  "focus:border-[color:var(--accent)] focus:ring-1 focus:ring-[color:color-mix(in_oklab,var(--accent)_35%,transparent)]";

function shortAddr(a: string) {
  if (a.length < 14) return a;
  return `${a.slice(0, 8)}…${a.slice(-6)}`;
}

const CATEGORY_LABELS: Record<string, string> = {
  physical_presence: "Physical presence",
  knowledge_access: "Knowledge access",
  human_authority: "Human authority",
  agent_to_agent: "Agent to agent",
  simple_action: "Simple action",
};

function formatDeadline(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

function PendingActionsHint({ actions }: { actions: PendingAction[] }) {
  if (!actions?.length) return null;
  return (
    <div
      className="rounded-[14px] border px-4 py-3 text-sm"
      style={{
        borderColor: "var(--line)",
        background: "var(--bg-2)",
        color: "var(--ink-2)",
      }}
    >
      <p className="mb-2 font-semibold text-[color:var(--ink)]">Suggested next steps</p>
      <ul className="list-inside list-disc space-y-1">
        {actions.map((a, i) => {
          const tid = typeof a.task_id === "string" ? a.task_id : "";
          const href = tid.startsWith("tk_") ? `/tasks/${tid}` : "#";
          return (
            <li key={`${a.type}-${i}`}>
              <span className="capitalize">{String(a.type).replace(/_/g, " ")}</span>
              {tid ? (
                <>
                  {" · "}
                  {href !== "#" ? (
                    <Link href={href} className="font-mono underline underline-offset-2" style={{ color: "var(--accent)" }}>
                      {tid}
                    </Link>
                  ) : (
                    <span className="font-mono">{tid}</span>
                  )}
                </>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function ChatTaskPanel() {
  const privyOk = usePrivyConfigured();
  const { authenticated, login } = usePrivy();
  const { address } = useAccount();
  const wagmiChainId = useChainId();
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

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState<TaskDraftFromApi | null>(null);
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [chatErr, setChatErr] = useState<string | null>(null);

  const [publishBusy, setPublishBusy] = useState(false);
  const [publishErr, setPublishErr] = useState<string | null>(null);
  const [publishResult, setPublishResult] = useState<{ task_id: string; tx?: string } | null>(null);
  const [skipPayment, setSkipPayment] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const sendChat = useCallback(async () => {
    const text = input.trim();
    if (!text || busy) return;

    const nextUser: ChatMessage = { role: "user", content: text };
    const thread = [...messages, nextUser];
    setMessages(thread);
    setInput("");
    setChatErr(null);
    setBusy(true);
    setPendingActions([]);

    try {
      let data: DraftChatResponse | AssistantChatResponse;
      if (authenticated && normalizedWallet) {
        try {
          data = await postAssistantChat(thread, normalizedWallet);
        } catch {
          /* Supabase/Gemini may fail for assistant — draft-chat still works without wallet context server-side */
          data = await postDraftChat(thread);
        }
      } else {
        data = await postDraftChat(thread);
      }

      const assistantMsg =
        "assistant_message" in data && typeof data.assistant_message === "string"
          ? data.assistant_message
          : "No reply.";
      setMessages((m) => [...m, { role: "assistant", content: assistantMsg }]);

      const d = "draft" in data ? data.draft : null;
      setDraft(d && typeof d === "object" ? (d as TaskDraftFromApi) : null);

      const pa = "pending_actions" in data ? data.pending_actions : undefined;
      setPendingActions(Array.isArray(pa) ? (pa as PendingAction[]) : []);
    } catch (e) {
      setChatErr(e instanceof Error ? e.message : "Chat request failed");
      setMessages((m) => m.slice(0, -1));
      setInput(text);
    } finally {
      setBusy(false);
    }
  }, [messages, input, busy, authenticated, normalizedWallet]);

  const onPublish = useCallback(async () => {
    if (!draft || !normalizedWallet) return;
    setPublishErr(null);
    setPublishResult(null);
    setPublishBusy(true);
    try {
      const res = await publishTaskFromDraft({
        draft,
        normalizedWallet,
        signTypedDataAsync,
        switchChainAsync,
        wagmiChainId,
        skipPayment,
      });
      setPublishResult({ task_id: res.task_id, tx: res.on_chain_tx_publish });
    } catch (e) {
      setPublishErr(e instanceof Error ? e.message : "Publish failed");
    } finally {
      setPublishBusy(false);
    }
  }, [draft, normalizedWallet, signTypedDataAsync, switchChainAsync, wagmiChainId, skipPayment]);

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

  if (publishResult) {
    return (
      <div className="space-y-4">
        <p className="text-sm font-medium" style={{ color: "var(--accent)" }}>
          Task published:{" "}
          <code className="break-all font-mono text-[13px]" style={{ color: "var(--ink)" }}>
            {publishResult.task_id}
          </code>
        </p>
        {publishResult.tx ? (
          <p className="text-xs" style={{ color: "var(--mute)" }}>
            Tx:{" "}
            <code className="break-all font-mono" style={{ color: "var(--ink-2)" }}>
              {publishResult.tx}
            </code>
          </p>
        ) : null}
        <Link
          href={`/tasks/${publishResult.task_id}`}
          className="inline-block text-sm font-semibold underline underline-offset-2"
          style={{ color: "var(--accent)" }}
        >
          View task
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div
        ref={listRef}
        className="max-h-[min(420px,55vh)] space-y-3 overflow-y-auto rounded-[14px] px-4 py-4"
        style={panelStyle}
      >
        {messages.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--mute)" }}>
            Describe the task you want on the market — bounty in USDC, deadline, and what executors should do.
            {!authenticated ? " You can draft without a wallet; connect to publish." : null}
          </p>
        ) : null}
        {messages.map((m, i) => (
          <div
            key={`${i}-${m.role}`}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className="max-w-[92%] rounded-[14px] px-4 py-2.5 text-sm leading-relaxed [text-wrap:pretty]"
              style={{
                border: "1px solid var(--line)",
                background: m.role === "user" ? "color-mix(in oklab, var(--accent) 12%, var(--card))" : "var(--bg-2)",
                color: "var(--ink)",
              }}
            >
              {m.content}
            </div>
          </div>
        ))}
      </div>

      {chatErr ? (
        <p
          className="rounded-[10px] border px-3 py-2 text-sm [text-wrap:pretty] whitespace-pre-wrap"
          style={{
            borderColor: "color-mix(in oklab, var(--danger) 45%, var(--line))",
            background: "color-mix(in oklab, var(--danger) 8%, var(--card))",
            color: "var(--ink-2)",
          }}
        >
          {chatErr}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <textarea
          className={`${inputClass} min-h-[88px] flex-1 resize-y`}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message…"
          disabled={busy}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void sendChat();
            }
          }}
        />
        <button
          type="button"
          disabled={busy || !input.trim()}
          onClick={() => void sendChat()}
          className="dashboard-btn hero-primary-cta shine relative inline-flex h-11 shrink-0 items-center justify-center rounded-full border border-[color:var(--accent)] bg-[color:var(--accent)] px-6 text-[13px] font-semibold text-[color:var(--ed-on-accent)] disabled:opacity-45"
        >
          {busy ? "Sending…" : "Send"}
        </button>
      </div>

      {!authenticated ? (
        <p className="text-sm" style={{ color: "var(--ink-2)" }}>
          <button
            type="button"
            onClick={() => login()}
            className="font-semibold underline underline-offset-2"
            style={{ color: "var(--accent)" }}
          >
            Connect wallet
          </button>{" "}
          to publish with x402 when your draft is ready (same flow as Post a task).
        </p>
      ) : (
        <p className="font-mono text-xs" style={{ color: "var(--mute)" }}>
          Signing: {normalizedWallet ? shortAddr(normalizedWallet) : "—"}
        </p>
      )}

      {pendingActions.length > 0 ? <PendingActionsHint actions={pendingActions} /> : null}

      {draft ? (
        <div className="space-y-4 rounded-[14px] p-5" style={panelStyle}>
          <p className="az-mono text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--accent)" }}>
            Draft ready
          </p>
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <span style={{ color: "var(--mute)" }}>Title</span>
              <p className="mt-1 font-medium" style={{ color: "var(--ink)" }}>
                {draft.title}
              </p>
            </div>
            <div>
              <span style={{ color: "var(--mute)" }}>Category</span>
              <p className="mt-1 font-medium" style={{ color: "var(--ink)" }}>
                {CATEGORY_LABELS[draft.category] ?? draft.category}
              </p>
            </div>
            <div className="sm:col-span-2">
              <span style={{ color: "var(--mute)" }}>Instructions</span>
              <p className="mt-1 whitespace-pre-wrap [text-wrap:pretty]" style={{ color: "var(--ink)" }}>
                {draft.instructions}
              </p>
            </div>
            <div>
              <span style={{ color: "var(--mute)" }}>Bounty</span>
              <p className="mt-1 font-mono font-medium" style={{ color: "var(--accent)" }}>
                {(draft.bounty_micros / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 6 })} USDC
              </p>
            </div>
            <div>
              <span style={{ color: "var(--mute)" }}>Deadline</span>
              <p className="mt-1 font-mono text-[13px]" style={{ color: "var(--ink)" }}>
                {formatDeadline(draft.deadline_at)}
              </p>
            </div>
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
                Skip x402 payment (local dev only) — requires API development mode.
              </span>
            </label>
          ) : null}

          {publishErr ? (
            <p
              className="rounded-[10px] border px-3 py-2 text-sm whitespace-pre-wrap [text-wrap:pretty]"
              style={{
                borderColor: "color-mix(in oklab, var(--danger) 45%, var(--line))",
                background: "color-mix(in oklab, var(--danger) 8%, var(--card))",
                color: "var(--ink-2)",
              }}
            >
              {publishErr}
            </p>
          ) : null}

          <button
            type="button"
            disabled={publishBusy || !normalizedWallet}
            onClick={() => void onPublish()}
            className="dashboard-btn hero-primary-cta shine relative inline-flex h-11 items-center justify-center rounded-full border border-[color:var(--accent)] bg-[color:var(--accent)] px-[22px] text-[13px] font-semibold text-[color:var(--ed-on-accent)] disabled:opacity-45"
          >
            {publishBusy ? "Publishing…" : "Publish task"}
          </button>
          {!normalizedWallet ? (
            <p className="text-xs" style={{ color: "var(--mute)" }}>
              Connect a wallet to publish this draft.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
