import { expect, test } from "@playwright/test";

// /api/auth is better-auth's own address. Nothing in the site's pages links to it; these check that
// it answers, and that it refuses the one thing the sign-up form exists to guard.
test("the sign-in service answers on our own address", async ({ request }) => {
  const response = await request.get("/api/auth/ok");
  expect(response.status()).toBe(200);
});

// This one already passes before the route exists (SvelteKit's own 404), so it is not the red test:
// it guards the route once it forwards to better-auth, which would otherwise make the account.
test("an account cannot be made around the sign-up form", async ({ request }) => {
  const response = await request.post("/api/auth/sign-up/email", {
    data: { name: "x", email: "around@ruken.test", password: "a long enough password" },
  });
  expect(response.status()).toBe(404);
});
