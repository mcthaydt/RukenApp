import { expect, test } from "@playwright/test";
import { forgetRateLimits } from "./support/rate-limits.ts";

test.beforeEach(forgetRateLimits);

// The first proof that the built Worker reaches a database: /healthz runs one query through it.
test("/healthz answers ok once the database has answered", async ({ request }) => {
  const answer = await request.get("/healthz");
  expect(answer.status()).toBe(200);
  expect(await answer.text()).toBe("ok");
});
