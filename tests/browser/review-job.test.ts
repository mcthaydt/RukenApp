import { expect, test } from "@playwright/test";
import { signInAs } from "./support/account.ts";
import { stateOf } from "./support/database.ts";
import { addDraft, gameWhere, reviewJob, submitGame } from "./support/game.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

test.beforeEach(forgetRateLimits);

// The Owner's review command (design 5.5): list what waits, look at a game before it is live, accept it, or send it back
// in the Owner's own words. Its address is public, so to anyone without the secret it is a page the site does not have.
const SECRET = "test-only-jobs-secret";
const JSON_BODY = { "content-type": "application/json" };
const asJson = async (response: Awaited<ReturnType<typeof reviewJob>>) => (await response.json()) as unknown;

test("is a missing page without the secret, and nothing changes", async ({ request, page }) => {
  const { slug } = await gameWhere(page, { state: "waiting" });

  for (const order of [{ do: "list" }, { do: "accept", game: slug }])
    for (const headers of [JSON_BODY, { ...JSON_BODY, authorization: "Bearer wrong" }])
      expect((await request.post("/jobs/review", { headers, data: JSON.stringify(order) })).status()).toBe(
        404,
      );

  expect(await stateOf(slug)).toBe("waiting");
});

test("only a POST asks for it", async ({ request }) => {
  const response = await request.get("/jobs/review", { headers: { authorization: `Bearer ${SECRET}` } });
  expect([404, 405]).toContain(response.status());
});

test("the Owner looks at a waiting game, accepts it, and its maker sees it Live", async ({
  request,
  page,
  browser,
}) => {
  test.setTimeout(90_000);
  const game = await submitGame(browser);

  const list = (await asJson(await reviewJob(request, { do: "list" }, browser))) as {
    waiting: unknown[];
  };
  expect(list.waiting).toContainEqual(
    expect.objectContaining({ game: game.slug, name: game.name, kind: "game" }),
  );

  const look = (await asJson(await reviewJob(request, { do: "look", game: game.slug }, browser))) as Record<
    string,
    string | number
  >;
  expect(look).toMatchObject({
    says: "Open the look link in a private window. It works for a day.",
    oneLine: "Climb. Fall. Climb again.",
    playsOn: "Plays on phones and computers",
    rating: "12+",
    playedSeconds: 0,
  });
  // The files that wait, before the game is live.
  await page.goto(String(look.look));
  await expect(page.locator("body")).toHaveAttribute("data-loaded", "yes");
  // The videos are on another address, which only the browser can reach (Node does not resolve `*.localhost`).
  const video = await page.goto(String(look.uprightVideo));
  expect(video?.headers()["content-type"]).toMatch(/^video\//);

  const yes = await reviewJob(request, { do: "accept", game: game.slug }, browser);
  expect(await asJson(yes)).toEqual({ says: `${game.name} is live.` });
  expect(await stateOf(game.slug)).toBe("live");

  await signInAs(page, game.maker);
  await page.goto(`/make/${game.slug}`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Live");
});

test("the Owner sends a game back, and its maker reads the Owner's words", async ({
  request,
  page,
  browser,
}) => {
  const { slug, name } = await gameWhere(page, { state: "waiting" });

  const sent = await reviewJob(
    request,
    {
      do: "send-back",
      game: slug,
      parts: [{ part: "upright_video", words: "It's sideways. Turn it the right way up." }],
    },
    browser,
  );

  expect(await asJson(sent)).toEqual({ says: `${name} went back to its maker.` });
  expect(await stateOf(slug)).toBe("sent_back");
  // The page is still the maker's own.
  await page.goto(`/make/${slug}`);
  await expect(page.getByText("It's sideways. Turn it the right way up.")).toBeVisible();
});

test("a live game's update can't be sent back for what its maker can't fix", async ({
  request,
  page,
  browser,
}) => {
  const { slug, name } = await gameWhere(page, { state: "live", updateWaiting: true });

  const list = (await asJson(await reviewJob(request, { do: "list" }, browser))) as {
    waiting: { game: string; kind: string }[];
  };
  expect(list.waiting.find((one) => one.game === slug)?.kind).toBe("update");

  const refused = await reviewJob(
    request,
    { do: "send-back", game: slug, parts: [{ part: "wide_video", words: "Too dark." }] },
    browser,
  );
  expect(refused.status()).toBe(400);
  expect(await asJson(refused)).toEqual({
    problem: "A live game can only be sent back for its name, its line, where it plays or its files.",
  });
  // The update still waits.
  const again = (await asJson(await reviewJob(request, { do: "list" }, browser))) as {
    waiting: { game: string }[];
  };
  expect(again.waiting.map((one) => one.game)).toContain(slug);

  const yes = await reviewJob(request, { do: "accept", game: slug }, browser);
  expect(await asJson(yes)).toEqual({ says: `${name}'s new version is live.` });
});

test("a mistake answers with what to type", async ({ request, page, browser }) => {
  const waiting = await gameWhere(page, { state: "waiting" });
  const draft = await addDraft(page);
  const post = async (order: object) => reviewJob(request, order, browser);

  const nothing = await post({});
  expect(nothing.status()).toBe(400);
  expect(await asJson(nothing)).toEqual({
    problem: 'Say what to do: "do" is "list", "look", "accept" or "send-back".',
  });

  const noParts = await post({ do: "send-back", game: waiting.slug, parts: [] });
  expect(noParts.status()).toBe(400);
  expect(await asJson(noParts)).toEqual({
    problem:
      'Say what\'s wrong: "parts" is a list like [{ "part": "files", "words": "It doesn\'t start." }].',
  });

  const notAPart = await post({
    do: "send-back",
    game: waiting.slug,
    parts: [{ part: "music", words: "Too loud." }],
  });
  expect(notAPart.status()).toBe(400);
  expect(await asJson(notAPart)).toEqual({
    problem:
      "That part isn't one of: name, one_line, files, plays_on, upright_video, wide_video, age_rating, other_websites.",
  });

  const noWords = await post({ do: "send-back", game: waiting.slug, parts: [{ part: "files", words: "" }] });
  expect(noWords.status()).toBe(400);
  expect(await asJson(noWords)).toEqual({ problem: "Say what's wrong in your own words." });
  expect(await stateOf(waiting.slug)).toBe("waiting");

  const nobody = await post({ do: "accept", game: "no-such-game" });
  expect(nobody.status()).toBe(404);
  expect(await asJson(nobody)).toEqual({ problem: "We can't find that game." });

  const notSent = await post({ do: "accept", game: draft.slug });
  expect(notSent.status()).toBe(409);
  expect(await asJson(notSent)).toEqual({ problem: "Nothing is waiting for review." });
});
