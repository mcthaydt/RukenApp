import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import Stripe from "stripe";

// A stand-in Stripe for the journeys. It runs in Node on the runner, beside `wrangler dev`, and answers in
// Stripe's JSON shapes exactly the calls the membership makes (src/features/membership/stripe-port.ts), so a
// journey can sign up, pay and cancel with no network and no Stripe account. It keeps its state in memory and
// exists only under tests/: nothing here can be reached by the real site, whose Stripe address is the stand-in's
// only when STRIPE_API_BASE is set, which the site refuses while STRIPE_LIVE is true.
//
// Besides the API it serves two small pages of its own, standing in for Stripe's hosted pages:
// - /pay/<session>: one "Pay" button. Pressing it makes the subscription active and a paid invoice, tells the
//   site about it with three signed events, and sends the browser to the checkout's success address.
//   /pay/<session>?events=later redirects first and sends the events three seconds afterwards, as Stripe
//   sometimes does.
// - /portal/<session>: one "Cancel membership" button, which sets the subscription to end with its period, tells
//   the site with a signed event, and sends the browser back.
// And /state/<checkout session> answers the subscription's status, for a journey that asks what Stripe thinks.

const PORT = 12111;
const PUBLIC_URL = `http://127.0.0.1:${String(PORT)}`;
const SITE_URL = "http://localhost:4173";
const WEBHOOK_SECRET = "whsec_test_fake";
/** How long `?events=later` waits before the events go out. */
const LATE_EVENTS_MS = 3000;

type Json = Record<string, unknown>;

interface Price {
  id: string;
  lookupKey: string;
  unitAmount: number;
  interval: "month" | "year";
}

interface Session {
  id: string;
  customerId: string;
  priceId: string;
  successUrl: string;
  metadata: Record<string, string>;
  status: "open" | "complete" | "expired";
  subscriptionId: string | null;
}

interface Subscription {
  id: string;
  customerId: string;
  priceId: string;
  status: "active" | "canceled";
  cancelAtPeriodEnd: boolean;
  cancelAt: number | null;
  endedAt: number | null;
  periodEnd: number;
  metadata: Record<string, string>;
}

interface Invoice {
  id: string;
  subscriptionId: string;
  paidAt: number;
  periodStart: number;
  priceId: string;
  /** Before tax, in cents. */
  net: number;
  tax: number;
  fee: number;
  metadata: Record<string, string>;
}

const products = new Map<string, Json>();
const prices = new Map<string, Price>();
const customers = new Map<string, Json>();
const sessions = new Map<string, Session>();
const subscriptions = new Map<string, Subscription>();
const invoices = new Map<string, Invoice>();
const portals = new Map<string, { customerId: string; returnUrl: string }>();
let counter = 0;

/** A new id in Stripe's style. One counter for every kind, so two kinds never share a number. */
function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}_${String(counter)}`;
}

const stripe = new Stripe("sk_test_fake");

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

// ---- Reading what the Stripe SDK sends: form fields with brackets (`a[b][0]=c`), in the body or the query ----

/** Turns `a[b][0]=c&d=e` into nested objects. Every value is a string; a list is an object keyed "0", "1", ... */
function parseForm(text: string): Json {
  const result: Json = {};
  for (const [key, value] of new URLSearchParams(text)) {
    const path = key.split(/[[\]]+/).filter((part) => part !== "");
    let at = result;
    for (const part of path.slice(0, -1)) {
      const next = at[part];
      if (typeof next === "object" && next !== null) {
        at = next as Json;
      } else {
        const made: Json = {};
        at[part] = made;
        at = made;
      }
    }
    const last = path.at(-1);
    if (last !== undefined) at[last] = value;
  }
  return result;
}

function child(object: Json, key: string): Json {
  const value = object[key];
  return typeof value === "object" && value !== null ? (value as Json) : {};
}

function text(object: Json, key: string): string | undefined {
  const value = object[key];
  return typeof value === "string" ? value : undefined;
}

function strings(object: Json): Record<string, string> {
  return Object.fromEntries(
    Object.entries(object).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
}

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      resolve(Buffer.concat(chunks).toString("utf8"));
    });
    request.on("error", reject);
  });
}

// ---- Stripe's JSON shapes ----

function stripeError(response: ServerResponse, status: number, code: string, message: string): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify({ error: { type: "invalid_request_error", code, message } }));
}

function send(response: ServerResponse, body: unknown): void {
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

function plain(response: ServerResponse, status: number, body: string): void {
  response.writeHead(status, { "content-type": "text/plain" });
  response.end(body);
}

function list(data: unknown[], url: string): Json {
  return { object: "list", data, has_more: false, url };
}

function priceJson(price: Price): Json {
  return {
    id: price.id,
    object: "price",
    active: true,
    currency: "usd",
    lookup_key: price.lookupKey,
    tax_behavior: "exclusive",
    unit_amount: price.unitAmount,
    recurring: { interval: price.interval, interval_count: 1 },
  };
}

function requirePrice(id: string): Price {
  const price = prices.get(id);
  if (price === undefined) throw new Error(`the stand-in has no price ${id}`);
  return price;
}

function sessionJson(session: Session): Json {
  return {
    id: session.id,
    object: "checkout.session",
    status: session.status,
    payment_status: session.status === "complete" ? "paid" : "unpaid",
    mode: "subscription",
    customer: session.customerId,
    subscription: session.subscriptionId,
    metadata: session.metadata,
    url: session.status === "open" ? `${PUBLIC_URL}/pay/${session.id}` : null,
  };
}

function subscriptionJson(subscription: Subscription): Json {
  return {
    id: subscription.id,
    object: "subscription",
    status: subscription.status,
    customer: subscription.customerId,
    cancel_at_period_end: subscription.cancelAtPeriodEnd,
    cancel_at: subscription.cancelAt,
    ended_at: subscription.endedAt,
    metadata: subscription.metadata,
    items: list(
      [
        {
          id: `si_${subscription.id}`,
          object: "subscription_item",
          current_period_end: subscription.periodEnd,
          price: priceJson(requirePrice(subscription.priceId)),
        },
      ],
      "/v1/subscription_items",
    ),
  };
}

function invoiceJson(invoice: Invoice): Json {
  const price = requirePrice(invoice.priceId);
  return {
    id: invoice.id,
    object: "invoice",
    status: "paid",
    currency: "usd",
    total: invoice.net + invoice.tax,
    amount_paid: invoice.net + invoice.tax,
    total_taxes: [{ amount: invoice.tax }],
    status_transitions: { paid_at: invoice.paidAt },
    parent: { subscription_details: { subscription: invoice.subscriptionId, metadata: invoice.metadata } },
    payments: list(
      [{ status: "paid", payment: { type: "payment_intent", payment_intent: `pi_${invoice.id}` } }],
      "/v1/invoice_payments",
    ),
    lines: list(
      [
        {
          amount: invoice.net,
          period: { start: invoice.periodStart, end: invoice.periodStart },
          pricing: { price_details: { price: priceJson(price) } },
        },
      ],
      "/v1/invoice_lines",
    ),
  };
}

// ---- The signed events the site gets ----

async function sendEvent(type: string, object: Json): Promise<void> {
  const payload = JSON.stringify({
    id: nextId("evt"),
    object: "event",
    created: nowSeconds(),
    livemode: false,
    type,
    data: { object },
  });
  const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });
  const answer = await fetch(`${SITE_URL}/webhooks/stripe`, {
    method: "POST",
    headers: { "content-type": "application/json", "stripe-signature": signature },
    body: payload,
  });
  if (!answer.ok) throw new Error(`the site answered ${String(answer.status)} to ${type}`);
}

// ---- What the hosted pages do ----

/** Made-up money, used only here: tax is a little over 8% and the card fee about 5.6% of the total. */
const MADE_UP: Record<"month" | "year", { tax: number; fee: number }> = {
  month: { tax: 82, fee: 61 },
  year: { tax: 818, fee: 335 },
};

/** Makes the subscription active and a paid invoice for it, as Stripe does once a card is accepted. */
function pay(session: Session): { events: [string, Json][] } {
  const price = requirePrice(session.priceId);
  const paidAt = nowSeconds();
  const months = price.interval === "year" ? 12 : 1;
  const periodEnd = new Date(paidAt * 1000);
  periodEnd.setUTCMonth(periodEnd.getUTCMonth() + months);
  const subscription: Subscription = {
    id: nextId("sub"),
    customerId: session.customerId,
    priceId: session.priceId,
    status: "active",
    cancelAtPeriodEnd: false,
    cancelAt: null,
    endedAt: null,
    periodEnd: Math.floor(periodEnd.getTime() / 1000),
    metadata: session.metadata,
  };
  subscriptions.set(subscription.id, subscription);
  const money = MADE_UP[price.interval];
  const invoice: Invoice = {
    id: nextId("in"),
    subscriptionId: subscription.id,
    paidAt,
    periodStart: paidAt,
    priceId: price.id,
    net: price.unitAmount,
    tax: money.tax,
    fee: money.fee,
    metadata: session.metadata,
  };
  invoices.set(invoice.id, invoice);
  session.status = "complete";
  session.subscriptionId = subscription.id;
  return {
    events: [
      ["checkout.session.completed", sessionJson(session)],
      ["customer.subscription.created", subscriptionJson(subscription)],
      ["invoice.paid", invoiceJson(invoice)],
    ],
  };
}

async function sendAll(events: [string, Json][]): Promise<void> {
  for (const [type, object] of events) await sendEvent(type, object);
}

function page(response: ServerResponse, title: string, button: string): void {
  response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  response.end(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title></head>` +
      `<body><h1>${title}</h1><form method="POST"><button>${button}</button></form></body></html>`,
  );
}

function redirect(response: ServerResponse, to: string): void {
  response.writeHead(303, { location: to });
  response.end();
}

// ---- The router ----

async function handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const url = new URL(request.url ?? "/", PUBLIC_URL);
  const method = request.method ?? "GET";
  const path = url.pathname;
  // The SDK sends a GET's and a DELETE's fields in the query and a POST's in the body; both are read the same way.
  const fields = { ...parseForm(url.search.slice(1)), ...parseForm(await readBody(request)) };

  if (method === "GET" && path === "/ready") {
    send(response, { ready: true });
    return;
  }

  // ---- The API ----
  const product = /^\/v1\/products(?:\/([^/]+))?$/.exec(path);
  if (product !== null) {
    if (method === "POST") {
      const id = text(fields, "id") ?? nextId("prod");
      products.set(id, {
        id,
        object: "product",
        name: text(fields, "name"),
        tax_code: text(fields, "tax_code"),
      });
      send(response, products.get(id));
      return;
    }
    const found = products.get(product[1] ?? "");
    if (found === undefined) {
      stripeError(response, 404, "resource_missing", "No such product");
      return;
    }
    send(response, found);
    return;
  }

  if (path === "/v1/prices" && method === "GET") {
    const keys = Object.values(child(fields, "lookup_keys"));
    send(
      response,
      list([...prices.values()].filter((price) => keys.includes(price.lookupKey)).map(priceJson), path),
    );
    return;
  }
  if (path === "/v1/prices" && method === "POST") {
    const interval = text(child(fields, "recurring"), "interval") === "year" ? "year" : "month";
    const price: Price = {
      id: nextId("price"),
      lookupKey: text(fields, "lookup_key") ?? "",
      unitAmount: Number(text(fields, "unit_amount")),
      interval,
    };
    prices.set(price.id, price);
    send(response, priceJson(price));
    return;
  }

  if (path === "/v1/customers" && method === "POST") {
    const customer = { id: nextId("cus"), object: "customer", email: text(fields, "email") };
    customers.set(customer.id, customer);
    send(response, customer);
    return;
  }

  if (path === "/v1/checkout/sessions" && method === "POST") {
    const line = child(child(fields, "line_items"), "0");
    const session: Session = {
      id: nextId("cs_test"),
      customerId: text(fields, "customer") ?? "",
      priceId: text(line, "price") ?? "",
      successUrl: text(fields, "success_url") ?? SITE_URL,
      // The subscription gets the same metadata, as the real call asks (`subscription_data[metadata]`).
      metadata: strings(child(fields, "metadata")),
      status: "open",
      subscriptionId: null,
    };
    sessions.set(session.id, session);
    send(response, sessionJson(session));
    return;
  }
  const checkout = /^\/v1\/checkout\/sessions\/([^/]+)(\/expire)?$/.exec(path);
  if (checkout !== null) {
    const session = sessions.get(checkout[1] ?? "");
    if (session === undefined) stripeError(response, 404, "resource_missing", "No such checkout session");
    return;
    if (checkout[2] !== undefined) {
      if (session.status !== "open") {
        stripeError(
          response,
          400,
          "checkout_session_not_open",
          "Only an open Checkout Session can be expired",
        );
        return;
      }
      session.status = "expired";
    }
    send(response, sessionJson(session));
    return;
  }

  const subscriptionPath = /^\/v1\/subscriptions\/([^/]+)$/.exec(path);
  if (subscriptionPath !== null) {
    const subscription = subscriptions.get(subscriptionPath[1] ?? "");
    if (subscription === undefined) stripeError(response, 404, "resource_missing", "No such subscription");
    return;
    if (method === "DELETE") {
      subscription.status = "canceled";
      subscription.endedAt = nowSeconds();
    }
    send(response, subscriptionJson(subscription));
    return;
  }

  // The membership only lists unpaid invoices of a subscription it is ending; the stand-in never makes one.
  if (path === "/v1/invoices" && method === "GET") {
    send(response, list([], path));
    return;
  }
  const invoicePath = /^\/v1\/invoices\/([^/]+)$/.exec(path);
  if (invoicePath !== null) {
    const invoice = invoices.get(invoicePath[1] ?? "");
    if (invoice === undefined) {
      stripeError(response, 404, "resource_missing", "No such invoice");
      return;
    }
    send(response, invoiceJson(invoice));
    return;
  }

  const intent = /^\/v1\/payment_intents\/pi_([^/]+)$/.exec(path);
  if (intent !== null) {
    const invoice = invoices.get(intent[1] ?? "");
    if (invoice === undefined) {
      stripeError(response, 404, "resource_missing", "No such payment");
      return;
    }
    send(response, {
      id: `pi_${invoice.id}`,
      object: "payment_intent",
      latest_charge: {
        id: `ch_${invoice.id}`,
        object: "charge",
        balance_transaction: { object: "balance_transaction", fee: invoice.fee },
      },
    });
    return;
  }

  if (path === "/v1/billing_portal/sessions" && method === "POST") {
    const id = nextId("bps");
    portals.set(id, {
      customerId: text(fields, "customer") ?? "",
      returnUrl: text(fields, "return_url") ?? SITE_URL,
    });
    send(response, { id, object: "billing_portal.session", url: `${PUBLIC_URL}/portal/${id}` });
    return;
  }

  // ---- The hosted pages ----
  const payPage = /^\/pay\/([^/]+)$/.exec(path);
  if (payPage !== null) {
    const session = sessions.get(payPage[1] ?? "");
    if (session?.status !== "open") {
      plain(response, 404, "No open payment page here.");
      return;
    }
    if (method === "GET") {
      page(response, "Stand-in payment page", "Pay");
      return;
    }
    const { events } = pay(session);
    if (url.searchParams.get("events") === "later") {
      // Stripe's news is late: the browser is sent back first, and the site hears three seconds later.
      setTimeout(() => {
        sendAll(events).catch((error: unknown) => {
          console.error(`stand-in: late events failed: ${String(error)}`);
        });
      }, LATE_EVENTS_MS);
    } else {
      await sendAll(events);
    }
    redirect(response, session.successUrl);
    return;
  }

  const portalPage = /^\/portal\/([^/]+)$/.exec(path);
  if (portalPage !== null) {
    const portal = portals.get(portalPage[1] ?? "");
    if (portal === undefined) {
      plain(response, 404, "No portal here.");
      return;
    }
    if (method === "GET") {
      page(response, "Stand-in billing portal", "Cancel membership");
      return;
    }
    const subscription = [...subscriptions.values()].find(
      (candidate) => candidate.customerId === portal.customerId && candidate.status === "active",
    );
    if (subscription !== undefined) {
      subscription.cancelAtPeriodEnd = true;
      subscription.cancelAt = subscription.periodEnd;
      await sendEvent("customer.subscription.updated", subscriptionJson(subscription));
    }
    redirect(response, portal.returnUrl);
    return;
  }

  // What the journeys ask: the status of the subscription a checkout session made.
  const state = /^\/state\/([^/]+)$/.exec(path);
  if (state !== null) {
    const subscriptionId = sessions.get(state[1] ?? "")?.subscriptionId ?? "";
    plain(response, 200, subscriptions.get(subscriptionId)?.status ?? "none");
    return;
  }

  plain(response, 404, `the stand-in does not answer ${method} ${path}`);
  return;
}

createServer((request, response) => {
  handle(request, response).catch((error: unknown) => {
    console.error(`stand-in: ${String(error)}`);
    if (!response.headersSent) response.writeHead(500, { "content-type": "text/plain" });
    response.end(String(error));
  });
}).listen(PORT, "127.0.0.1", () => {
  console.log(`stand-in Stripe on ${PUBLIC_URL}`);
});
