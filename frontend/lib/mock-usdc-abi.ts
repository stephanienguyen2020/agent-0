/** Minimal ABI for MockUSDC balance + permissionless `mint` (see `contracts/src/MockUSDC.sol`). */

export const mockUsdcAbi = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "mint",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
] as const;

/** Default 1000 USDC (6 decimals). Override with `NEXT_PUBLIC_FAUCET_MINT_MICROS` (integer µUSDC). */
const DEFAULT_FAUCET_MINT_MICROS = BigInt(1_000_000_000);

export function getFaucetMintAmount(): bigint {
  const raw = process.env.NEXT_PUBLIC_FAUCET_MINT_MICROS?.trim();
  if (!raw) return DEFAULT_FAUCET_MINT_MICROS;
  try {
    const n = BigInt(raw);
    return n > BigInt(0) ? n : DEFAULT_FAUCET_MINT_MICROS;
  } catch {
    return DEFAULT_FAUCET_MINT_MICROS;
  }
}
