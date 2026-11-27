import { expect, test } from "@playwright/test";
import { forgetRateLimits } from "./support/rate-limits.ts";

test.beforeEach(forgetRateLimits);

// The first proof that the built Worker reaches a database: /healthz runs one query through it.
test("/healthz answers ok once the database has answered", async ({ request }) => {
  const answer = await request.get("/healthz");
  expect(answer.status()).toBe(200);
  expect(await answer.text()).toBe("ok");
});

// A copy of the app (and the journeys) has no private Worker bound, so the open order answers the feed, and says so.
test("/healthz/feed says the open order answers the feed when no private Worker is bound", async ({
  request,
}) => {
  const answer = await request.get("/healthz/feed");
  expect(answer.status()).toBe(200);
  expect(answer.headers()["cache-control"]).toBe("no-store");
  expect(await answer.json()).toEqual({ ranker: "open", health: "defaults" });
});
