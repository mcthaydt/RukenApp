import type Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import { bindMoneyStripe, NotAtStripeYet } from "../../../src/features/money/stripe-port.ts";

// What money reads from Stripe, from answers in the shapes of the current API (SDK 22). Each test hands the port a
// Stripe that answers as Stripe would, so these test what Ruken reads out of the answers.

/** An invoice whose paid payment is the one given (`payment_intent` or `charge`). */
function invoice(payment: Record<string, unknown>) {
  return { id: "in_1", payments: { data: [{ status: "paid", payment }] } };
}

const CHARGED = { id: "ch_1", balance_transaction: { id: "txn_1" } };

function fakeStripe(answers: { invoice?: unknown; intent?: unknown; charge?: unknown } = {}) {
  const fake = {
    invoices: {
      retrieve: vi.fn(
        (): Promise<unknown> => Promise.resolve(answers.invoice ?? invoice({ payment_intent: "pi_1" })),
      ),
    },
    paymentIntents: {
      retrieve: vi.fn(
        (): Promise<unknown> =>
          Promise.resolve(
            answers.intent ?? { id: "pi_1", latest_charge: CHARGED },
          ),
      ),
    },
    charges: {
      retrieve: vi.fn(
        (): Promise<unknown> =>
          Promise.resolve(answers.charge ?? { id: "ch_2", balance_transaction: { id: "txn_2" } }),
      ),
    },
  };
  return { fake, stripe: fake as unknown as Stripe };
}

describe("paymentIds", () => {
  it("reads the three ids from an invoice paid through a payment intent", async () => {
    const { fake, stripe } = fakeStripe();
    await expect(bindMoneyStripe(stripe).paymentIds("in_1")).resolves.toEqual({
      chargeId: "ch_1",
      paymentIntentId: "pi_1",
      balanceTransactionId: "txn_1",
    });
    expect(fake.invoices.retrieve).toHaveBeenCalledWith("in_1", { expand: ["payments"] });
    expect(fake.paymentIntents.retrieve).toHaveBeenCalledWith("pi_1", {
      expand: ["latest_charge.balance_transaction"],
    });
  });

  it("reads them from an invoice paid by a bare charge, with no payment intent", async () => {
    const { fake, stripe } = fakeStripe({ invoice: invoice({ charge: "ch_2" }) });
    await expect(bindMoneyStripe(stripe).paymentIds("in_1")).resolves.toEqual({
      chargeId: "ch_2",
      paymentIntentId: null,
      balanceTransactionId: "txn_2",
    });
    expect(fake.charges.retrieve).toHaveBeenCalledWith("ch_2", { expand: ["balance_transaction"] });
    expect(fake.paymentIntents.retrieve).not.toHaveBeenCalled();
  });

  it("is not at Stripe yet while the charge has no balance transaction", async () => {
    const intent = { id: "pi_1", latest_charge: { id: "ch_1", balance_transaction: null } };
    const { stripe } = fakeStripe({ intent });
    await expect(bindMoneyStripe(stripe).paymentIds("in_1")).rejects.toBeInstanceOf(NotAtStripeYet);
  });

  it("is not at Stripe yet while the payment intent has no charge", async () => {
    const { stripe } = fakeStripe({ intent: { id: "pi_1", latest_charge: null } });
    await expect(bindMoneyStripe(stripe).paymentIds("in_1")).rejects.toBeInstanceOf(NotAtStripeYet);
  });

  it("is not at Stripe yet while the invoice has no paid payment", async () => {
    const { stripe } = fakeStripe({ invoice: { id: "in_1", payments: { data: [] } } });
    await expect(bindMoneyStripe(stripe).paymentIds("in_1")).rejects.toBeInstanceOf(NotAtStripeYet);
  });
});
