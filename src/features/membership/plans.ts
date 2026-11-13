/**
 * What a member pays (design 6; Owner, 2026-11-13). These are rules: they change only by a decision of
 * the Owner. Prices are before tax; Stripe Tax adds tax where it applies. Stripe's catalog is made from
 * these values by code and never typed into Stripe by hand.
 */
export const PREMIUM_PRICES_CENTS = { monthly: 999n, annual: 9900n } as const;

/** The two ways to pay for the one membership. */
export type PremiumPlan = keyof typeof PREMIUM_PRICES_CENTS;

/** No trials. Kept as a named value so a checkout cannot quietly add one. */
export const PREMIUM_TRIAL_DAYS = 0;
