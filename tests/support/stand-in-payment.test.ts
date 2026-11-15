import { describe, expect, it } from "vitest";
import { checkoutIdOfPaymentUrl } from "../browser/support/stand-in-payment.ts";

// A journey reads the checkout's id from the browser's address. A slow browser can still be on the card when it
// reads (WebKit, runs 43657290538, 43658030234 and 43659012481), and the card's own address must never pass for a
// payment page: the stand-in knows no checkout by that name.
describe("checkoutIdOfPaymentUrl", () => {
  it("reads the id from the stand-in's payment page", () => {
    expect(checkoutIdOfPaymentUrl("http://127.0.0.1:12111/pay/cs_test_12")).toBe("cs_test_12");
  });

  it("reads it from a payment page that holds Stripe's news back", () => {
    expect(checkoutIdOfPaymentUrl("http://127.0.0.1:12111/pay/cs_test_12?events=later")).toBe("cs_test_12");
  });

  it("finds no id on the card", () => {
    expect(checkoutIdOfPaymentUrl("http://localhost:4173/join")).toBeUndefined();
    expect(checkoutIdOfPaymentUrl("http://localhost:4173/join?next=/me")).toBeUndefined();
  });

  it("finds no id on the stand-in's other pages", () => {
    expect(checkoutIdOfPaymentUrl("http://127.0.0.1:12111/portal/bps_3")).toBeUndefined();
  });
});
