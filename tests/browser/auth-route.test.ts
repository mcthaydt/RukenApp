import { expect, test } from "@playwright/test";
import { freshNumber } from "./support/account.ts";
import { countCodesTo } from "./support/texts.ts";

// /api/auth is better-auth's own address. Nothing in the site's pages links to it; these check that
// it answers, and that it refuses the one thing the sign-up form exists to guard.
test("the sign-in service answers on our own address", async ({ request }) => {
  const response = await request.get("/api/auth/ok");
  expect(response.status()).toBe(200);
});

// Only /ok, /get-session and /sign-out are reachable from outside. Every other address better-auth has answers 404, so
// nobody can make an account, ask for a code, sign in or reset a password around the forms, which hold the rules
// (the age, the number's pause, the sign-up kept for the browser that started it).
test("an account cannot be made, signed in to or reset around the forms", async ({ request }) => {
  const number = freshNumber();
  const paths = [
    "/api/auth/sign-up/email",
    "/api/auth/sign-in/email",
    "/api/auth/sign-in/phone-number",
    "/api/auth/phone-number/send-otp",
    "/api/auth/phone-number/verify",
    "/api/auth/phone-number/request-password-reset",
    "/api/auth/phone-number/reset-password",
    "/api/auth/request-password-reset",
  ];
  for (const path of paths) {
    const response = await request.post(path, {
      data: {
        phoneNumber: number,
        email: "around@ruken.test",
        password: "a long enough password",
        code: "123456",
      },
    });
    expect(response.status(), path).toBe(404);
  }
  // Nothing was texted for any of them.
  expect(await countCodesTo(number)).toBe(0);
});
