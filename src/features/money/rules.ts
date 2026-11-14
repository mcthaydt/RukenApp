// The numbers of the money rules. Each is a promise to makers or members, with the Owner's words beside it. A change
// here is the Owner's decision, applied from the next month and never retroactively; `rules.test.ts` makes it loud.

/** Design 6: "for a member's first 12 months", half of that member's makers' share goes to the maker who brought them. */
export const BRINGING_MONTHS = 12;

/** Design 6: "at most 180 minutes per member, per game, per day". */
export const DAILY_PLAY_CAP_SECONDS = 10_800;

/** Design 6: "The minimum is $25". A smaller amount carries to the next month. */
export const PAYOUT_MINIMUM_CENTS = 2500n;

/**
 * A month closes on this day of the next month, at midnight in Chicago. Stripe's fee report can run four days behind,
 * so the 8th is the first date by which a month's last fees are in. Later facts post into the month that is open.
 */
export const CLOSE_DAY_OF_MONTH = 8;

/** Design 6: "final on the 10th". Nothing about the month can change between the 8th and the 10th. */
export const FINAL_DAY_OF_MONTH = 10;

/** Design 6: "paid on the 15th", or the next business day when that is a weekend or a holiday. */
export const PAYOUT_DAY_OF_MONTH = 15;

/**
 * When a buyer charges a payment back, the payment is undone first, each side giving back what it got. What Stripe
 * keeps (its fees) is shared half and half between the makers' pool and Ruken: this is the makers' share, in basis points.
 */
export const CHARGEBACK_COST_MAKERS_SHARE_BPS = 5000;

/**
 * A pool is shared in billionths of a cent, so that splitting a member's part over the games they played loses almost
 * nothing before the one final rounding to whole cents.
 */
export const POOL_WEIGHT_SCALE = 1_000_000_000n;

/** A maker can question a line of a statement for this many days after the statement was made final. */
export const QUESTION_WINDOW_DAYS = 90;

/** Ruken answers a question within this many business days. */
export const ANSWER_BUSINESS_DAYS = 10;
