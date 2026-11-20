import { expect, test } from "@playwright/test";

// Decision day's job address. It is a missing page without the secret, and with decision day off (as the journeys run it)
// there is nothing to send out, so a run changes nothing.
const SECRET = "test-only-jobs-secret";
const HEADERS = { "content-type": "application/json" };

test("is a missing page without the secret", async ({ request }) => {
  for (const headers of [HEADERS, { ...HEADERS, authorization: "Bearer wrong" }])
    expect((await request.post("/jobs/decision-day", { headers })).status()).toBe(404);
});

test("says there is nothing to send out when nothing is due", async ({ request }) => {
  const response = await request.post("/jobs/decision-day", {
    headers: { ...HEADERS, authorization: `Bearer ${SECRET}` },
  });
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ says: "Nothing to send out." });
});
