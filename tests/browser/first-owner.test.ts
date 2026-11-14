import { expect, test } from "@playwright/test";
import { signUpInItsOwnContext } from "./support/account.ts";
import { staffRolesOfEmail } from "./support/database.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

test.beforeEach(forgetRateLimits);

// The command that makes the Owner's account the first staff account (G4). Its address is public, so it must look
// like any address the site does not have to anyone without the secret (playwright.config.ts gives the Worker this
// fake one). The journeys share one database and run every file twice (a phone and a computer), so whether a staff
// account exists already depends on what ran before: each case below holds whichever way it falls. Who becomes
// staff is proved, in both orders, by tests/features/accounts/staff.pg.test.ts.
const SECRET = "test-only-jobs-secret";
const JSON_BODY = { "content-type": "application/json" };
const WITH_SECRET = { ...JSON_BODY, authorization: `Bearer ${SECRET}` };

test("answers 404 to anyone without the secret, and makes nobody staff", async ({ request, browser }) => {
  const { email } = await signUpInItsOwnContext(browser);
  const data = JSON.stringify({ email });

  expect((await request.post("/jobs/first-owner", { headers: JSON_BODY, data })).status()).toBe(404);
  const wrong = await request.post("/jobs/first-owner", {
    headers: { ...JSON_BODY, authorization: "Bearer wrong" },
    data,
  });
  expect(wrong.status()).toBe(404);

  expect(await staffRolesOfEmail(email)).toEqual([]);
});

test("only a POST asks for it", async ({ request }) => {
  expect([404, 405]).toContain((await request.get("/jobs/first-owner")).status());
});

test("makes the first staff account the owner, and says plainly when there is one already", async ({
  request,
  browser,
}) => {
  const { email } = await signUpInItsOwnContext(browser);

  const answer = await request.post("/jobs/first-owner", {
    headers: WITH_SECRET,
    data: JSON.stringify({ email }),
  });

  expect([200, 409]).toContain(answer.status());
  if (answer.status() === 200) {
    expect(await answer.json()).toEqual({ granted: true });
    expect(await staffRolesOfEmail(email)).toEqual(["owner"]);
  } else {
    expect(await answer.json()).toEqual({ problem: "There is already a staff account." });
    expect(await staffRolesOfEmail(email)).toEqual([]);
  }
});

test("asks for an email address when none came", async ({ request }) => {
  const answer = await request.post("/jobs/first-owner", { headers: WITH_SECRET, data: JSON.stringify({}) });

  expect(answer.status()).toBe(400);
  expect(await answer.json()).toEqual({ problem: "Send the email address of the account." });
});
