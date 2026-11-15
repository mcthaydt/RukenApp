/** Where the stand-in Stripe runs (tests/browser/support/fake-stripe-server.ts). */
export const STAND_IN_URL = "http://127.0.0.1:12111";

/**
 * The checkout's id in the stand-in's payment page address, or nothing when the address is not a payment page. A
 * browser can still show the card when a journey reads its address, and the card's own address must not pass for a
 * payment page: the stand-in knows no checkout by that name.
 */
export function checkoutIdOfPaymentUrl(url: string): string | undefined {
  const address = new URL(url);
  if (address.origin !== STAND_IN_URL) return undefined;
  return /^\/pay\/(cs_test_\d+)$/.exec(address.pathname)?.[1];
}
