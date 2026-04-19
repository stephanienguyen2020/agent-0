/**
 * EIP-3009 MockUSDC.transferWithAuthorization + x402 header encoding.
 * Align with `backend/em_api/services/x402_signer.py` and facilitator `Authorization` model.
 */

import { type Address, type Hex, getAddress } from "viem";

import { opBNBTestnet } from "@/lib/chains";

export const X402_NETWORK = "opbnb-testnet" as const;

export const MOCK_USDC_EIP712 = {
  name: "MockUSDC",
  version: "1",
} as const;

export const transferWithAuthorizationTypes = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
} as const;

export function randomNonceHex32(): Hex {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `0x${hex}`;
}

export function getMockUsdcAddressEnv(): Address | null {
  const raw = process.env.NEXT_PUBLIC_MOCK_USDC_ADDRESS?.trim();
  if (!raw) return null;
  try {
    return getAddress(raw);
  } catch {
    return null;
  }
}

export function getEscrowAddressEnv(): Address | null {
  const raw = process.env.NEXT_PUBLIC_EM_ESCROW_ADDRESS?.trim();
  if (!raw) return null;
  try {
    return getAddress(raw);
  } catch {
    return null;
  }
}

export function buildTransferWithAuthorizationSignArgs(params: {
  mockUsdc: Address;
  escrow: Address;
  from: Address;
  totalMicros: number;
  validAfter: number;
  validBefore: number;
  nonce: Hex;
}) {
  const {
    mockUsdc,
    escrow,
    from,
    totalMicros,
    validAfter,
    validBefore,
    nonce,
  } = params;
  return {
    domain: {
      name: MOCK_USDC_EIP712.name,
      version: MOCK_USDC_EIP712.version,
      chainId: BigInt(opBNBTestnet.id),
      verifyingContract: mockUsdc,
    },
    types: transferWithAuthorizationTypes,
    primaryType: "TransferWithAuthorization" as const,
    message: {
      from,
      to: escrow,
      value: BigInt(totalMicros),
      validAfter: BigInt(validAfter),
      validBefore: BigInt(validBefore),
      nonce,
    },
  };
}

export type X402Authorization = {
  x402Version: 1;
  scheme: "exact";
  network: typeof X402_NETWORK;
  payload: {
    from: string;
    to: string;
    value: string;
    validAfter: string;
    validBefore: string;
    nonce: string;
    signature: string;
  };
};

export function authorizationFromSignature(params: {
  from: Address;
  to: Address;
  totalMicros: number;
  validAfter: number;
  validBefore: number;
  nonce: Hex;
  signature: Hex;
}): X402Authorization {
  const { from, to, totalMicros, validAfter, validBefore, nonce, signature } = params;
  return {
    x402Version: 1,
    scheme: "exact",
    network: X402_NETWORK,
    payload: {
      from: getAddress(from),
      to: getAddress(to),
      value: String(totalMicros),
      validAfter: String(validAfter),
      validBefore: String(validBefore),
      nonce,
      signature,
    },
  };
}

/** Standard base64 (matches Python `base64.standard_b64encode`). */
export function encodeXPaymentHeader(auth: X402Authorization): string {
  const json = JSON.stringify(auth);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
}
