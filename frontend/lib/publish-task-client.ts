import type { Address, Hex } from "viem";
import { getAddress } from "viem";

import {
  createTask,
  getEscrowFeeBps,
  type CreateTaskResponse,
  type TaskCreateBody,
  type TaskDraftFromApi,
} from "@/lib/api";
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

const devSkipAllowed =
  process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_ALLOW_X402_SKIP === "true";

/** Wagmi `signTypedDataAsync` (typed loosely for cross-version compatibility). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SignTypedDataAsync = (args: any) => Promise<Hex>;
type SwitchChainAsync = (args: { chainId: number }) => Promise<unknown>;

/** Build create payload from API-validated draft + requester wallet. */
export function taskCreateBodyFromDraft(
  draft: TaskDraftFromApi,
  requester_wallet: string,
): TaskCreateBody {
  const w = getAddress(requester_wallet);
  const body: TaskCreateBody = {
    requester_wallet: w,
    requester_erc8004_id: 0,
    title: draft.title,
    instructions: draft.instructions,
    category: draft.category,
    bounty_micros: draft.bounty_micros,
    deadline_at: draft.deadline_at,
  };
  if (draft.evidence_schema && typeof draft.evidence_schema === "object") {
    body.evidence_schema = draft.evidence_schema;
  }
  if (draft.executor_requirements && typeof draft.executor_requirements === "object") {
    body.executor_requirements = draft.executor_requirements;
  }
  if (draft.location_lat != null) body.location_lat = draft.location_lat;
  if (draft.location_lng != null) body.location_lng = draft.location_lng;
  if (draft.location_radius_m != null) body.location_radius_m = draft.location_radius_m;
  return body;
}

/**
 * Publish task with same x402 / dev-skip path as PostTaskForm.
 */
export async function publishTaskFromDraft(opts: {
  draft: TaskDraftFromApi;
  normalizedWallet: string;
  signTypedDataAsync: SignTypedDataAsync;
  switchChainAsync: SwitchChainAsync;
  skipPayment: boolean;
}): Promise<CreateTaskResponse> {
  const { draft, normalizedWallet, signTypedDataAsync, switchChainAsync, skipPayment } = opts;

  const body = taskCreateBodyFromDraft(draft, normalizedWallet);

  let escrowFeeBps: number = ESCROW_FEE_BPS;
  try {
    escrowFeeBps = await getEscrowFeeBps();
  } catch {
    /* keep default */
  }
  const bountyMicros = draft.bounty_micros;
  const feeMicros = Math.floor((bountyMicros * escrowFeeBps) / 10_000);
  const totalMicros = bountyMicros + feeMicros;

  const mockUsdc = getMockUsdcAddressEnv();
  const escrow = getEscrowAddressEnv();

  if (devSkipAllowed && skipPayment) {
    return createTask(body, { xPaymentSkip: true });
  }
  if (mockUsdc && escrow) {
    await ensureOpBNBForX402Publish({ config: wagmiConfig, switchChainAsync });
    const validAfter = 0;
    const validBefore = Math.floor(Date.now() / 1000) + 600;
    const nonce = randomNonceHex32();
    const wallet = getAddress(normalizedWallet) as Address;
    const args = buildTransferWithAuthorizationSignArgs({
      mockUsdc,
      escrow,
      from: wallet,
      totalMicros,
      validAfter,
      validBefore,
      nonce,
    });
    const sig = await signTypedDataAsync({
      ...args,
      account: wallet,
    });
    const auth = authorizationFromSignature({
      from: wallet,
      to: escrow,
      totalMicros,
      validAfter,
      validBefore,
      nonce: nonce as Hex,
      signature: sig,
    });
    const xPayment = encodeXPaymentHeader(auth);
    return createTask(body, { xPayment });
  }
  return createTask(body);
}
