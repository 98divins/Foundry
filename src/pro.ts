/**
 * Paid features ("Foundry Pro"). There is no subscription yet: during the beta every Pro feature is
 * open, and screens only show a Pro badge. When billing arrives, hasPro() will read the user's
 * entitlement and the badges become locks.
 */
export const PRO_FREE_DURING_BETA = true;

export function hasPro(): boolean {
  return PRO_FREE_DURING_BETA;
}
