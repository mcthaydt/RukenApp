/**
 * Posting: turns one money fact into the lines of one journal entry. The functions that do it are pure. The service
 * around them records the fact and writes the entry in the same transaction.
 *
 * Signs follow double-entry: a debit is positive, a credit negative, and an entry's lines always add up to zero (the
 * database checks this too).
 */
export interface PostingLine {
  readonly account: string;
  readonly amount: bigint;
  /** Set on a maker's lines only: the maker the line belongs to. */
  readonly makerUserId?: string;
}

/** A zero line says nothing, so an entry leaves it out (a small payment can round a share to 0). */
export function withoutZeroLines(lines: readonly PostingLine[]): PostingLine[] {
  return lines.filter((line) => line.amount !== 0n);
}

/** Money facts are never negative: a refund is its own fact, posted by reversing the original lines. */
export function requireNonNegative(...amounts: readonly bigint[]): void {
  if (amounts.some((amount) => amount < 0n)) throw new RangeError("Money fact amounts must not be negative");
}
