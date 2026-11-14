// The numbers of the money rules (stub: red step).

/** Stands in for a value that is not written yet; reading it fails the test that needs it. */
function notBuilt<T>(name: string): T {
  throw new Error(`not built yet: ${name}`);
}

export const BRINGING_MONTHS: number = notBuilt("BRINGING_MONTHS");
export const DAILY_PLAY_CAP_SECONDS: number = notBuilt("DAILY_PLAY_CAP_SECONDS");
export const PAYOUT_MINIMUM_CENTS: bigint = notBuilt("PAYOUT_MINIMUM_CENTS");
export const CLOSE_DAY_OF_MONTH: number = notBuilt("CLOSE_DAY_OF_MONTH");
export const FINAL_DAY_OF_MONTH: number = notBuilt("FINAL_DAY_OF_MONTH");
export const PAYOUT_DAY_OF_MONTH: number = notBuilt("PAYOUT_DAY_OF_MONTH");
export const CHARGEBACK_COST_MAKERS_SHARE_BPS: number = notBuilt("CHARGEBACK_COST_MAKERS_SHARE_BPS");
export const POOL_WEIGHT_SCALE: bigint = notBuilt("POOL_WEIGHT_SCALE");
export const QUESTION_WINDOW_DAYS: number = notBuilt("QUESTION_WINDOW_DAYS");
export const ANSWER_BUSINESS_DAYS: number = notBuilt("ANSWER_BUSINESS_DAYS");
