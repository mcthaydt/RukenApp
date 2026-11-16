import { expect, test } from "@playwright/test";
import { payAsNewMember, SITE_URL } from "./support/account.ts";
import { beatsOf, sessionsOf, userIdOf } from "./support/database.ts";
import { addGame } from "./support/game.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

// Play time (design 5.7, 8): while a game is played its page tells the server, every 15 seconds, whether the person
// was there the whole stretch: the tab showing, the game on screen and the game being the thing they last touched. The
// server stamps each beat with its own clock, so these journeys check that a beat arrived and what it said, never how
// many seconds counted. The page's timers are moved with Playwright's clock; nothing sleeps.

test.beforeEach(forgetRateLimits);

const BEAT_MS = 15_000;

test("a member's play time is recorded against that game", async ({ page, browser }) => {
  // design 8. Its own game, so no other journey's beats are counted with it.
  test.setTimeout(90_000);
  const game = await addGame(browser);
  const member = await payAsNewMember(page);
  await page.clock.install();
  await page.goto(`/g/${game.slug}/play`);
  // Touching the game puts it in focus: from now on the stretch is attentive.
  await page.frameLocator("iframe.frame").getByRole("button", { name: "Tap" }).click();
  await page.clock.runFor(BEAT_MS + 1_000);
  await expect.poll(async () => (await beatsOf(game.slug)).length).toBe(1);
  expect((await beatsOf(game.slug)).at(-1)?.attentive).toBe(true);
  expect(await sessionsOf(game.slug)).toMatchObject([
    { basis: "member", gameId: game.id, userId: await userIdOf(member.email) },
  ]);
});

test("no time counts while the person has not touched the game, and free play by nobody is recorded", async ({
  page,
  browser,
}) => {
  test.setTimeout(90_000);
  const game = await addGame(browser, { free: true });
  await page.clock.install();
  await page.goto(`/g/${game.slug}/play`);
  await expect(page.frameLocator("iframe.frame").locator("body")).toHaveAttribute("data-loaded", "yes");
  await page.clock.runFor(BEAT_MS + 1_000);
  await expect.poll(async () => (await beatsOf(game.slug)).length).toBe(1);
  expect((await beatsOf(game.slug)).at(-1)?.attentive).toBe(false);
  expect(await sessionsOf(game.slug)).toMatchObject([{ basis: "free_game", userId: null }]);
});

test("a beat with a made-up session is not taken", async ({ request }) => {
  const answer = await request.post(`${SITE_URL}/g/any-game/play/beat`, {
    data: JSON.stringify({ session: crypto.randomUUID(), token: "made-up", attentive: true }),
    headers: { "content-type": "text/plain", origin: SITE_URL },
  });
  expect(answer.status()).toBe(404);
});

test("a beat of the wrong shape is refused", async ({ request }) => {
  const send = (body: string) =>
    request.post(`${SITE_URL}/g/any-game/play/beat`, {
      data: body,
      headers: { "content-type": "text/plain", origin: SITE_URL },
    });
  expect((await send(JSON.stringify({ session: 1 }))).status()).toBe(400);
  expect((await send("not json")).status()).toBe(400);
  expect(
    (
      await send(JSON.stringify({ session: "a", token: "b", attentive: true, pad: "x".repeat(2_000) }))
    ).status(),
  ).toBe(400);
});
