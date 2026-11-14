/** Millionths of a cent in one cent. */
export const MICRO_PER_CENT = 1_000_000n;

/** Millionths of a cent in one dollar. */
const MICRO_PER_DOLLAR = 100n * MICRO_PER_CENT;

/** The most decimals Stripe's report is read with: eight decimals of a dollar are whole millionths of a cent. */
const MAX_DECIMALS = 8;

const DOLLARS_PATTERN = /^(-?)(\d+)(?:\.(\d{1,8}))?$/;

/**
 * Stripe's decimal dollars (`"0.06993"`, `"2"`, `"0.25"`) as whole millionths of a cent, read digit by digit and never
 * through a `number`, so a fraction of a cent is never rounded by a float. Null for anything that is not digits with at
 * most one point and at most eight decimals, with one optional minus sign in front (Stripe returning or crediting a
 * fee), and for an empty text. The caller never guesses at a null.
 */
export function microCentsOf(text: string): bigint | null {
  const match = DOLLARS_PATTERN.exec(text);
  if (match === null) return null;
  const [, sign, dollars, decimals] = match;
  const micro =
    BigInt(dollars ?? "0") * MICRO_PER_DOLLAR + BigInt((decimals ?? "").padEnd(MAX_DECIMALS, "0"));
  return sign === "-" ? -micro : micro;
}

/**
 * The least whole cents that cover an amount in millionths of a cent. What is taken is therefore never less than what
 * Stripe charged. It refuses a negative amount: a returned fee is kept apart and never rounded into the split.
 */
export function centsRoundedUp(microCents: bigint): bigint {
  if (microCents < 0n) throw new RangeError("A fee can't be rounded up to cents when it is below zero");
  return (microCents + MICRO_PER_CENT - 1n) / MICRO_PER_CENT;
}
