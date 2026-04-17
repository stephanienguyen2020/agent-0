/** Must match `ESCROW_FEE_BPS` in `backend/em_api/constants.py`. */
export const ESCROW_FEE_BPS = 1300 as const;

export function feeMicrosFromBounty(bountyMicros: number): number {
  return Math.floor((bountyMicros * ESCROW_FEE_BPS) / 10_000);
}
