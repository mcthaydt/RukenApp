import { expect, test } from "@playwright/test";
import { pageHasSettled, payAsNewMember } from "./support/account.ts";
import { playOf } from "./support/database.ts";
import { addGame } from "./support/game.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

// Play time (spec 4.2): the page says "still here" every 15 seconds, and the server counts from its own clock.

let game: Awaited<ReturnType<typeof addGame>>;
let free: Awaited<ReturnType<typeof addGame>>;

test.beforeAll(async ({ browser, request }) => {
  test.setTimeout(120_000);
  game = await addGame(browser, request);
  free = await addGame(browser, request, { free: true });
});
test.beforeEach(forgetRateLimits);

test("a member's play time is recorded against that game", async ({ page }) => {
  await payAsNewMember(page);
  await page.clock.install();
  await page.goto(`/g/${game.slug}/play`);
  await pageHasSettled(page);
  await page.frameLocator("iframe.frame").getByRole("button", { name: "Tap" }).click();
  await page.clock.runFor(16_000);
  await expect.poll(async () => (await playOf(game.slug)).sessions.at(-1)?.beats).toEqual([true]);
  expect((await playOf(game.slug)).sessions.at(-1)).toMatchObject({ basis: "member" });
});

test("no time counts while the person has not touched the game", async ({ page }) => {
  await page.clock.install();
  await page.goto(`/g/${free.slug}/play`);
  await pageHasSettled(page);
  await page.clock.runFor(16_000);
  await expect.poll(async () => (await playOf(free.slug)).sessions.at(-1)?.beats).toEqual([false]);
});

test("free play by nobody is recorded, as free", async ({ page }) => {
  await page.goto(`/g/${free.slug}/play`);
  await expect
    .poll(async () => (await playOf(free.slug)).sessions.at(-1))
    .toMatchObject({ basis: "free_game", userId: null });
});

test("a beat with a wrong token is not taken", async ({ page, request }) => {
  await page.goto(`/g/${free.slug}/play`);
  await expect.poll(async () => (await playOf(free.slug)).sessions.at(-1)).toBeDefined();
  const real = (await playOf(free.slug)).sessions.at(-1);
  const answer = await request.post(`/g/${free.slug}/play/beat`, {
    data: JSON.stringify({ session: real?.id, token: "made-up", attentive: true }),
    failOnStatusCode: false,
  });
  expect(answer.status()).toBe(404);
  expect((await playOf(free.slug)).sessions.find((one) => one.id === real?.id)?.beats).toEqual([]);
});

test("a beat of the wrong shape is refused", async ({ request }) => {
  const wrong = await request.post(`/g/${free.slug}/play/beat`, {
    data: JSON.stringify({ session: 1 }),
    failOnStatusCode: false,
  });
  expect(wrong.status()).toBe(400);
  const big = await request.post(`/g/${free.slug}/play/beat`, {
    data: JSON.stringify({ session: "x".repeat(2000), token: "t", attentive: true }),
    failOnStatusCode: false,
  });
  expect(big.status()).toBe(400);
});
