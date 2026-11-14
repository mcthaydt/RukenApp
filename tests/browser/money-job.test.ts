import { expect, test, type APIRequestContext } from "@playwright/test";
import { payAsNewMember } from "./support/account.ts";
import { paymentPostingOf } from "./support/database.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

test.beforeEach(forgetRateLimits);

// The daily money job. Its address is public, so it looks like any address the site does not have to anyone without the
// secret. The stand-in Stripe answers its calls, so the whole chain runs with no network: a member pays, the job posts
// the payment, asks Stripe for its fee report and reads it. Other journeys knock on the same job at their own times, so
// each check here holds whichever knock did the work.
const SECRET = "test-only-jobs-secret";
const JSON_BODY = { "content-type": "application/json" };
const STAND_IN_URL = "http://127.0.0.1:12111";

interface Report {
  payments: number;
  feeReport: { collected: string; requested: string; skipped?: string };
  fees: { product: string; featureName: string; kind: string; rows: number }[];
  reversals: number;
  released: number;
  playDays: string[];
  closed: string[];
  problems: { step: string; message: string }[];
}

async function knock(request: APIRequestContext): Promise<Report> {
  const answer = await request.post("/jobs/money", {
    headers: { ...JSON_BODY, authorization: `Bearer ${SECRET}` },
  });
  // Always 200, so a person who runs it reads the report even when a step failed.
  expect(answer.status()).toBe(200);
  return (await answer.json()) as Report;
}

test("the job's address answers 404 to anyone without the secret", async ({ request }) => {
  expect((await request.post("/jobs/money", { headers: JSON_BODY })).status()).toBe(404);
  const wrong = await request.post("/jobs/money", {
    headers: { ...JSON_BODY, authorization: "Bearer wrong" },
  });
  expect(wrong.status()).toBe(404);
});

test("only a POST starts it", async ({ request }) => {
  expect([404, 405]).toContain((await request.get("/jobs/money")).status());
});

test("the job runs for the secret, and nothing fails", async ({ request }) => {
  const report = await knock(request);
  expect(report.problems).toEqual([]);
  expect(typeof report.payments).toBe("number");
});

test("a member who paid is posted, and Stripe's fees are asked for and then read", async ({
  page,
  request,
}) => {
  const { email } = await payAsNewMember(page);
  const first = await knock(request);
  expect(first.problems).toEqual([]);
  expect(await paymentPostingOf(email)).not.toBeNull();

  // What the stand-in's next fee report holds: a Billing fee for the newest payment it knows.
  const said = await request.post(`${STAND_IN_URL}/test/fees`, {
    data: { rows: [{ product: "billing", featureName: "subscriptions", amount: "0.05" }] },
  });
  expect(said.ok()).toBe(true);

  // The first knock asked Stripe for its report (or another journey's did); a later one reads it.
  const reports = [first];
  for (let knocks = 0; knocks < 3; knocks += 1) reports.push(await knock(request));
  expect(reports.map((report) => report.feeReport.requested)).toContain("requested");
  expect(reports.map((report) => report.feeReport.collected)).toContain("stored");
  expect(reports.flatMap((report) => report.fees).some((fee) => fee.product === "billing")).toBe(true);
  for (const report of reports) expect(report.problems).toEqual([]);
});
