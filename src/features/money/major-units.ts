// Stripe's decimal dollars as whole numbers (stub: red step).

/** Millionths of a cent in one cent. */
export const MICRO_PER_CENT = 1_000_000n;

export function microCentsOf(text: string): bigint | null {
  throw new Error(`not built yet: microCentsOf ${text}`);
}

export function centsRoundedUp(microCents: bigint): bigint {
  throw new Error(`not built yet: centsRoundedUp ${String(microCents)}`);
}
