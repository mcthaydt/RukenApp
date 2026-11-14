import { expect, test } from "@playwright/test";

// The daily job that finishes deleted accounts. Its address is public, so it must look like any address the
// site does not have to anyone without the secret (playwright.config.ts gives the Worker this fake one).
const SECRET = "test-only-jobs-secret";

test("the job's address answers 404 to anyone without the secret", async ({ request }) => {
  expect((await request.post("/jobs/purge-accounts")).status()).toBe(404);
  const wrong = await request.post("/jobs/purge-accounts", { headers: { authorization: "Bearer wrong" } });
  expect(wrong.status()).toBe(404);
  const notBearer = await request.post("/jobs/purge-accounts", { headers: { authorization: SECRET } });
  expect(notBearer.status()).toBe(404);
});

test("the job runs for the secret and says how many accounts it finished", async ({ request }) => {
  const answer = await request.post("/jobs/purge-accounts", {
    headers: { authorization: `Bearer ${SECRET}` },
  });
  expect(answer.status()).toBe(200);
  const body = (await answer.json()) as { purged: unknown };
  expect(typeof body.purged).toBe("number");
});

test("only a POST starts it", async ({ request }) => {
  expect([404, 405]).toContain((await request.get("/jobs/purge-accounts")).status());
});

// The daily trigger's own wiring, in the Workers runtime: `wrangler dev --test-scheduled` runs the scheduled
// handler when this address is fetched. The handler knocks on the job with the secret and throws unless it
// gets a 200, so a 200 here means the whole chain worked.
test("the daily trigger runs the job", async ({ request }) => {
  expect((await request.get("/cdn-cgi/local/scheduled")).status()).toBe(200);
});
