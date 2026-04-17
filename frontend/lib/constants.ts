/** Default; publish form uses `getEscrowFeeBps()` from the API (on-chain `EMEscrow.feeBps()`). */
export const ESCROW_FEE_BPS = 1300 as const;

export function feeMicrosFromBounty(bountyMicros: number): number {
  return Math.floor((bountyMicros * ESCROW_FEE_BPS) / 10_000);
}
