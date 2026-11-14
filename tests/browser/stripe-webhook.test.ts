import { expect, test, type APIRequestContext } from "@playwright/test";
import Stripe from "stripe";

// What Stripe sends to the site, and what the site does with a delivery that is not Stripe's (Review Focus 4).
// The stand-in Stripe signs with this secret, and so does the site's check.
const SECRET = "whsec_test_fake";
const stripe = new Stripe("sk_test_fake");

function event(type: string, id = `evt_${crypto.randomUUID()}`): string {
  return JSON.stringify({
    id,
    object: "event",
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    type,
    data: { object: { id: "dp_test_1" } },
  });
}

function post(request: APIRequestContext, body: string, signature?: string) {
  return request.post("/webhooks/stripe", {
    data: body,
    headers: {
      "content-type": "application/json",
      ...(signature === undefined ? {} : { "stripe-signature": signature }),
    },
  });
}

test("a delivery with no signature is refused", async ({ request }) => {
  expect((await post(request, event("invoice.paid"))).status()).toBe(400);
});

test("a delivery signed with the wrong secret is refused", async ({ request }) => {
  const body = event("invoice.paid");
  const signature = stripe.webhooks.generateTestHeaderString({ payload: body, secret: "whsec_wrong" });
  expect((await post(request, body, signature)).status()).toBe(400);
});

test("a body changed after signing is refused", async ({ request }) => {
  const signature = stripe.webhooks.generateTestHeaderString({
    payload: event("invoice.paid", "evt_a"),
    secret: SECRET,
  });
  expect((await post(request, event("invoice.paid", "evt_b"), signature)).status()).toBe(400);
});

test("a signed event of a kind Ruken does not act on is kept and answered 200", async ({ request }) => {
  const body = event("charge.dispute.created");
  const signature = stripe.webhooks.generateTestHeaderString({ payload: body, secret: SECRET });
  expect((await post(request, body, signature)).status()).toBe(200);
});
