/**
 * The checkout's id in a payment page's address, or nothing when the address is not a payment page.
 */
export function checkoutIdOfPaymentUrl(url: string): string | undefined {
  return new URL(url).pathname.split("/").pop();
}
