import { expect, test } from "@playwright/test";
import { rgb, token } from "../support/look-tokens.ts";
import { pageHasSettled, signUp } from "./support/account.ts";
import { fillAnswers, putGameWhereStaffLeaveIt, type SentBackPart } from "./support/database.ts";
import {
  addDraft,
  answerEveryQuestion,
  answerName,
  chooseVideo,
  freshName,
  gameWhere,
  holdAnswersTo,
  MAKER_ADDRESSES,
  nextButton,
  startDraft,
  videoFile,
} from "./support/game.ts";
import { filledButtons, pipRed, showTheOwner } from "./support/look.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

// What a maker sees once a game has been sent: Waiting, Sent back and Live (spec 5, 5b "Sent back, now", 5c). Each is two
// halves: the name, the heading, one line and the buttons on one side, the game on the other. The sizes and colours are in
// make-look.test.ts; these journeys are the words, the links and what each button does.

test.beforeEach(forgetRateLimits);

const SIDEWAYS: SentBackPart = { part: "upright_video", reason: "sideways" };

// ---- Sent back ----------------------------------------------------------------------------------------------------

test("sent back for one thing: the screen leads with it, the blue button names it, and Send it again is not there", async ({
  page,
}, testInfo) => {
  const { slug } = await gameWhere(page, { state: "sent_back", toFix: [SIDEWAYS] });

  await page.goto(`/make/${slug}`);

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sent back");
  await expect(page.getByText("One thing to fix. Then send it again.")).toBeVisible();
  const card = page.locator("a.fix");
  await expect(card).toHaveCount(1);
  await expect(card).toHaveAttribute("href", `/make/${slug}/upright?again=1`);
  await expect(card).toContainText("Needs fixing");
  await expect(card).toContainText("Upright video");
  await expect(card).toContainText("It's sideways. Turn it the right way up.");
  await expect(card.locator("video")).toHaveCount(1);
  const fix = page.getByRole("link", { name: "Fix the upright video" });
  await expect(fix).toHaveCSS("background-color", rgb(token("--pay")));
  await expect(page.getByRole("button", { name: "Send it again" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Send it again" })).toHaveCount(0);
  // What passed is folded away: six of the seven parts.
  await expect(page.getByText("6 accepted")).toBeVisible();
  await expect(page.locator("details.accepted")).not.toHaveAttribute("open", "");
  await showTheOwner(page, testInfo, "Sent back, for one thing");
});

// A game staff sent back for where it plays, before games stopped being asked where they play: that is met by every game playing on both, so the
// screen opens (it used to throw), asks for nothing that is gone, and the game can be sent again.
test("an old send back for where the game plays opens, asks for nothing, and can be sent again", async ({
  page,
}) => {
  const { slug } = await gameWhere(page, {
    state: "sent_back",
    toFix: [{ part: "plays_on", reason: "needs_keyboard" }],
  });

  const response = await page.goto(`/make/${slug}`);
  await pageHasSettled(page);

  expect(response?.status()).toBe(200);
  await expect(page.getByText("Fixed. Send it again when you're ready.")).toBeVisible();
  await expect(page.locator("a.fix")).toHaveCount(0);
  await expect(page.getByText("Choose Computers only.")).toHaveCount(0);
  await page.getByRole("button", { name: "Send it again" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Waiting for review");
});

test("staff's own line shows under the reason", async ({ page }, testInfo) => {
  const { slug } = await gameWhere(page, {
    state: "sent_back",
    toFix: [{ part: "upright_video", reason: "too_dark", note: "The second level is hard to see." }],
  });

  await page.goto(`/make/${slug}`);

  const card = page.locator("a.fix");
  await expect(card).toContainText("It's too dark to see. Record it again, brighter.");
  await expect(card).toContainText("The second level is hard to see.");
  // Staff's line is once on the card, under the reason, and not again as the words.
  await expect(card.getByText("The second level is hard to see.")).toHaveCount(1);
  await showTheOwner(page, testInfo, "Sent back, with staff's own line");
});

// Staff's own line for "Something else" is the words of the card; it is not printed a second time under them.
test("staff's line for Something else shows once", async ({ page }) => {
  const { slug } = await gameWhere(page, {
    state: "sent_back",
    toFix: [{ part: "one_line", reason: "something_else", note: "Say what the game is." }],
  });

  await page.goto(`/make/${slug}`);

  await expect(page.locator("a.fix").getByText("Say what the game is.")).toHaveCount(1);
});

test("fixing the one thing brings back Send it again, and sending makes it wait", async ({
  page,
}, testInfo) => {
  const { slug } = await gameWhere(page, { state: "sent_back", toFix: [SIDEWAYS] });
  await page.goto(`/make/${slug}`);
  await pageHasSettled(page);

  await page.locator("a.fix").click();
  await expect(page).toHaveURL(`/make/${slug}/upright?again=1`);
  await pageHasSettled(page);
  await chooseVideo(page, videoFile("fixed.mp4"));
  await expect(page.locator('[data-frame="upright"] video')).toBeAttached();
  await nextButton(page).click();

  await expect(page).toHaveURL(`/make/${slug}`);
  await expect(page.getByText("Fixed. Send it again when you're ready.")).toBeVisible();
  await expect(page.getByText("All ready to send")).toBeVisible();
  await expect(page.locator("a.fix")).toHaveCount(0);
  await showTheOwner(page, testInfo, "Sent back, fixed");
  const held = await holdAnswersTo(page, /\?\/send/);
  await page.getByRole("button", { name: "Send it again" }).click();
  await expect(page.getByRole("button", { name: "Sending your game…" })).toBeDisabled();
  held.release();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Waiting for review");
});

test("sent back for two things, one fixed: still no Send it again, and a send posted by hand is refused", async ({
  page,
  baseURL,
}) => {
  const { slug } = await gameWhere(page, {
    state: "sent_back",
    toFix: [SIDEWAYS, { part: "name", reason: "rude" }],
  });
  await page.goto(`/make/${slug}`);
  await expect(page.getByText("2 things to fix. Then send it again.")).toBeVisible();
  await page.goto(`/make/${slug}/upright?again=1`);
  await pageHasSettled(page);
  await chooseVideo(page, videoFile("fixed.mp4"));
  await expect(page.locator('[data-frame="upright"] video')).toBeAttached();
  await nextButton(page).click();
  await expect(page).toHaveURL(`/make/${slug}`);

  await expect(page.getByText("One thing to fix. Then send it again.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Fix the name" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Send it again" })).toHaveCount(0);
  const site = baseURL ?? "http://localhost:4173";
  const posted = await page.request.post(`${site}/make/${slug}?/send`, {
    form: {},
    headers: { origin: site, accept: "text/html" },
  });
  expect(posted.status()).toBe(400);
  expect(await posted.text()).toContain("Fix what was sent back first.");
});

test("a rude name is fixed on the name question, and the address follows the new name", async ({ page }) => {
  const { slug, name } = await gameWhere(page, {
    state: "sent_back",
    toFix: [{ part: "name", reason: "rude" }],
  });
  await page.goto(`/make/${slug}`);
  await expect(page.locator("a.fix")).toContainText(`Name: ${name}`);
  await expect(page.locator("a.fix")).toContainText(
    "We can't show this name on Ruken. It's rude. Pick another.",
  );

  await page.getByRole("link", { name: "Fix the name" }).click();
  await expect(page).toHaveURL(`/make/${slug}/name`);
  await pageHasSettled(page);
  const renamed = freshName("Floor Fifty");
  await page.getByLabel("What's your game called?").fill(renamed);
  await nextButton(page).click();

  // Not live yet, so the address follows the name (Review Focus 3), and the screen follows the address.
  await expect(page).toHaveURL(/\/make\/floor-fifty-[a-z0-9]+$/);
  await expect(page.getByText("Fixed. Send it again when you're ready.")).toBeVisible();
  await expect(page.locator("p.count")).toHaveText(renamed);
});

// ---- Waiting ------------------------------------------------------------------------------------------------------

test("a waiting game can still be changed, through Check and send", async ({ page }) => {
  const { slug } = await gameWhere(page, { state: "waiting" }, { agreed: true });
  await page.goto(`/make/${slug}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Waiting for review");

  await page.getByRole("link", { name: "Change something" }).click();

  await expect(page).toHaveURL(`/make/${slug}/check`);
});

// ---- Live ---------------------------------------------------------------------------------------------------------

test("a live game: Send a new version is the blue button, and a new version goes for review on one press", async ({
  page,
}, testInfo) => {
  // The game is made through the real screens, so its GitHub is the stand-in's and a new version can be copied.
  const { slug } = await answerEveryQuestion(page);
  await putGameWhereStaffLeaveIt(slug, { state: "live" });
  await page.goto(`/make/${slug}`);
  await pageHasSettled(page);

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Live");
  await expect(page.getByText("Players can find it on Ruken.")).toBeVisible();
  const again = page.getByRole("button", { name: "Send a new version" });
  // A send waiting on the maker is what to do next, so it is the blue button, as on Sent back (the design pass, S8).
  await expect(again).toHaveCSS("background-color", rgb(token("--pay")));
  // The rating chip is the rating staff set, and it has no Change.
  await expect(page.locator(".chip", { hasText: "12+" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Change who it's for" })).toHaveCount(0);
  await showTheOwner(page, testInfo, "Live");

  await again.click();

  // The press copies the game's newest files before it sends them, which takes a few seconds in Safari's engine.
  await expect(page.getByText("Your update is waiting for review.")).toBeVisible({ timeout: 20_000 });
  await showTheOwner(page, testInfo, "Live, an update waiting for review");
});

// Spec 5c: beside the headline sit the game's one video (the shape of this window), its name and line, and where it plays;
// the rating is added. The files and the websites are not drawn on Live, and neither is the other video.
test("Live shows the one video for this window, the name, the line and two chips", async ({ page }) => {
  const { slug, name } = await gameWhere(page, { state: "live" });
  await page.goto(`/make/${slug}`);
  await pageHasSettled(page);

  const viewport = page.viewportSize() ?? { width: 0, height: 0 };
  const laid = page.locator(".laid");
  await expect(laid.locator("video")).toHaveCount(1);
  await expect(laid.locator("video")).toHaveAttribute(
    "data-shape",
    viewport.width > viewport.height ? "wide" : "upright",
  );
  await expect(laid.getByRole("heading", { level: 2 })).toHaveText(name);
  await expect(laid.locator(".tagline")).toHaveText("A tiny game about tapping.");
  await expect(laid.locator(".chip")).toHaveText(["12+"]);
});

// A live game's maker mends the files on GitHub, and a new version copies them. Its files question is a 404 for her, so
// the card that says what is wrong is words only, and the copy that passes is what clears it.
test("a live game's update sent back for its files: the card is not a link, and a new version clears it", async ({
  page,
}) => {
  const { slug } = await answerEveryQuestion(page);
  await putGameWhereStaffLeaveIt(slug, { state: "live", toFix: [{ part: "files", reason: "breaks" }] });
  await page.goto(`/make/${slug}`);
  await pageHasSettled(page);

  await expect(page.getByText("Fix it, then send a new version.")).toBeVisible();
  const card = page.locator(".fix");
  await expect(card).toHaveCount(1);
  await expect(card).toContainText("Game files");
  await expect(page.locator("a.fix")).toHaveCount(0);
  await expect(card.getByText("Fix this")).toHaveCount(0);

  await page.getByRole("button", { name: "Send a new version" }).click();

  await expect(page.getByText("Your update is waiting for review.")).toBeVisible({ timeout: 20_000 });
  await expect(page.locator(".fix")).toHaveCount(0);
});

test("a live game's name changes and its address stays", async ({ page }, testInfo) => {
  const { slug } = await gameWhere(page, { state: "live" });
  await page.goto(`/make/${slug}`);

  await page.getByRole("link", { name: "Change the name" }).click();
  await expect(page).toHaveURL(`/make/${slug}/name`);
  await pageHasSettled(page);
  await expect(page.getByText("Its link on Ruken stays the same")).toBeVisible();
  await showTheOwner(page, testInfo, "question 1, a live game's name being changed (Save)");
  const renamed = freshName("Floor Fifty");
  await page.getByLabel("What's your game called?").fill(renamed);
  await page.getByRole("button", { name: "Save" }).click();

  await expect(page).toHaveURL(`/make/${slug}`);
  // Live says the name once, as the title of the game laid out.
  await expect(page.locator(".laid .title")).toHaveText(renamed);
});

test("a live game offers no Change on its videos or its files, and posting one by hand is refused", async ({
  page,
  baseURL,
}) => {
  const { slug } = await gameWhere(page, { state: "live" });
  await page.goto(`/make/${slug}`);
  await pageHasSettled(page);

  for (const part of ["the upright video", "the wide video", "the game's files", "who it's for"]) {
    await expect(page.getByRole("link", { name: `Change ${part}` })).toHaveCount(0);
  }
  await expect(page.getByRole("link", { name: "Change the name" })).toBeVisible();
  const site = baseURL ?? "http://localhost:4173";
  expect((await page.request.get(`${site}/make/${slug}/upright`)).status()).toBe(404);
  const posted = await page.request.post(`${site}/make/${slug}/age?/answer`, {
    form: { ageRating: "age_3" },
    headers: { origin: site },
  });
  expect(posted.status()).toBe(404);
});

test("a live game's update that was sent back says what to fix", async ({ page }, testInfo) => {
  // A live game's videos and files are not changed by its maker (slice 4), so what is sent back here is a line.
  const { slug } = await gameWhere(page, {
    state: "live",
    toFix: [{ part: "one_line", reason: "not_this_game" }],
  });
  await page.goto(`/make/${slug}`);

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Live");
  // The line is not a file, so nothing is copied from GitHub: it is mended, then sent again as it is.
  await expect(page.getByText("Fix it, then send it again.")).toBeVisible();
  await expect(page.locator("a.fix")).toHaveCount(1);
  await expect(page.locator("a.fix")).toContainText("This line isn't about your game.");
  // Nothing can be sent until it is mended, and a copy from GitHub would not mend a line.
  await expect(page.getByRole("button", { name: "Send a new version" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Send it again" })).toHaveCount(0);
  await showTheOwner(page, testInfo, "Live, an update sent back");
});

// Its GitHub is not connected (the game is not made through the real screens), so a copy of its files would fail: the
// press can only work if it sends the copy Ruken already holds.
test("a live game's update that was sent back and mended is sent again from the copy Ruken holds", async ({
  page,
}, testInfo) => {
  const { slug } = await gameWhere(page, {
    state: "live",
    fixed: [{ part: "one_line", reason: "not_this_game" }],
  });
  await page.goto(`/make/${slug}`);
  await pageHasSettled(page);

  await expect(page.getByText("Fixed. Send it again when you're ready.")).toBeVisible();
  await expect(page.locator(".fix")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Send a new version" })).toHaveCount(0);
  const again = page.getByRole("button", { name: "Send it again" });
  // It is the one forward action there is (Live has no "See it on Ruken" until a game has a page), so it is the blue button.
  await expect(again).toHaveCSS("background-color", rgb(token("--pay")));
  await expect(
    page.getByText("Sends your update for review again. Players can still play it while you wait."),
  ).toBeVisible();
  await showTheOwner(page, testInfo, "Live, an update mended, Send it again");

  await again.click();

  // The press still sends the game to staff, which took over five seconds in Safari's engine on the tablet screens
  // (the button was still "Sending your update…"); it waits as long as the other Send tests on this screen do.
  await expect(page.getByText("Your update is waiting for review.")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("button", { name: "Send it again" })).toHaveCount(0);
  await showTheOwner(page, testInfo, "Live, an update sent again");
});

test("Send it again is not on a live game that was never sent back, and posting it by hand is refused", async ({
  page,
  baseURL,
}) => {
  const { slug } = await gameWhere(page, { state: "live" });
  await page.goto(`/make/${slug}`);
  await pageHasSettled(page);
  await expect(page.getByRole("button", { name: "Send a new version" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Send it again" })).toHaveCount(0);

  const site = baseURL ?? "http://localhost:4173";
  const posted = await page.request.post(`${site}/make/${slug}?/sendAgain`, {
    form: {},
    headers: { origin: site },
  });

  expect(posted.status()).toBe(400);
  await page.reload();
  await expect(page.getByText("Players can find it on Ruken.")).toBeVisible();
});

// ---- Everyone else ------------------------------------------------------------------------------------------------

test("another maker cannot open any of these", async ({ page, browser, baseURL }) => {
  const { slug } = await gameWhere(page, { state: "sent_back", toFix: [SIDEWAYS] });
  const site = baseURL ?? "http://localhost:4173";
  const stranger = await browser.newContext({ baseURL: site });
  try {
    const other = await stranger.newPage();
    await signUp(other);

    for (const { path, form } of MAKER_ADDRESSES(slug)) {
      expect((await other.goto(path))?.status(), `GET ${path}`).toBe(404);
      if (form !== undefined) {
        const posted = await stranger.request.post(path, { form, headers: { origin: site } });
        expect(posted.status(), `POST ${path}`).toBe(404);
      }
    }
    const sent = await stranger.request.post(`${site}/make/${slug}?/send`, {
      form: {},
      headers: { origin: site },
    });
    expect(sent.status(), "POST the send of a game's page").toBe(404);
    // Throwing away answers every post with Your games (a reload, a game already gone), so it is not a 404: what is
    // proved is that the game, which is the kind that may be thrown away, is still its maker's afterwards.
    await stranger.request.post(`${site}/make?/throwAway`, {
      form: { game: slug },
      headers: { origin: site },
    });
    await page.goto(`/make/${slug}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sent back");
  } finally {
    await stranger.close();
  }
});

// ---- Throwing a game away -----------------------------------------------------------------------------------------

test("a draft is thrown away: green keeps, red deletes, nothing is blue, and Your games says so once", async ({
  page,
}, testInfo) => {
  const { slug, name } = await startDraft(page);
  await page.goto(`/make/${slug}/throw-away`);
  await pageHasSettled(page);

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Throw ${name} away?`);
  await expect(
    page.getByText("Its files and videos are deleted from Ruken. Nothing changes on GitHub."),
  ).toBeVisible();
  await expect(page.getByText("You can't undo this.")).toBeVisible();
  const keep = page.getByRole("link", { name: "Keep it" });
  await expect(keep).toHaveCSS("background-color", rgb(token("--felt-raised")));
  // Enter on this screen must not throw anything away, so the first thing in reach is the safe choice.
  await expect(keep).toBeFocused();
  await expect(page.getByRole("button", { name: "Throw it away" })).toHaveCSS(
    "background-color",
    rgb(token("--pip")),
  );
  await expect(filledButtons(page)).toHaveCount(0);
  expect(await pipRed(page)).toEqual(["Throw it away"]);
  await showTheOwner(page, testInfo, "Throw a game away?");

  await page.getByRole("button", { name: "Throw it away" }).click();

  await expect(page).toHaveURL("/make");
  await expect(page.getByText(`${name} was thrown away.`)).toBeVisible();
  await expect(page.locator(`a[href="/make/${slug}"]`)).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your games");
  await expect(page.getByText("was thrown away.")).toHaveCount(0);
});

test("Keep it changes nothing", async ({ page }) => {
  const { slug } = await startDraft(page);
  await page.goto(`/make/${slug}/throw-away`);

  await page.getByRole("link", { name: "Keep it" }).click();

  // A draft leads on to the question it was at.
  await expect(page).toHaveURL(`/make/${slug}/line`);
  await page.goto("/make");
  await expect(page.locator(`a[href="/make/${slug}"]`)).toHaveCount(1);
});

test("a thrown-away game's name can be used again, with the plain address", async ({ page }) => {
  const first = await startDraft(page);
  await page.goto(`/make/${first.slug}/throw-away`);
  await page.getByRole("button", { name: "Throw it away" }).click();
  await expect(page).toHaveURL("/make");
  // The page is waited for, so the next address is not asked for while the redirect is still being taken in.
  await pageHasSettled(page);

  await page.goto("/make/new");
  await pageHasSettled(page);
  await answerName(page, first.name);

  // Review Focus 8: the address the name made before is free again, not a "-2".
  await expect(page).toHaveURL(`/make/${first.slug}/line`);
});

test("a game that is waiting or live has no way to be thrown away", async ({ page, baseURL }) => {
  const waiting = await gameWhere(page, { state: "waiting" });
  const live = await addDraft(page);
  await fillAnswers(live.slug, { files: true, videos: true, age: "age_12" });
  await putGameWhereStaffLeaveIt(live.slug, { state: "live" });
  const site = baseURL ?? "http://localhost:4173";

  for (const { slug } of [waiting, live]) {
    await page.goto(`/make/${slug}`);
    await expect(page.getByRole("link", { name: "Throw this game away" })).toHaveCount(0);
    expect((await page.request.get(`${site}/make/${slug}/throw-away`)).status(), slug).toBe(404);
    // A post by hand is answered with Your games, and the game is still there.
    const posted = await page.request.post(`${site}/make?/throwAway`, {
      form: { game: slug },
      headers: { origin: site },
    });
    expect(posted.ok(), slug).toBe(true);
    await page.goto("/make");
    await expect(page.locator(`a[href="/make/${slug}"]`), slug).toHaveCount(1);
  }
  // The questions a live game may still answer have no such link either.
  await page.goto(`/make/${live.slug}/line`);
  await expect(page.getByRole("link", { name: "Throw this game away" })).toHaveCount(0);
});

test("a sent-back game can be thrown away", async ({ page }) => {
  const { slug, name } = await gameWhere(page, { state: "sent_back", toFix: [SIDEWAYS] });
  await page.goto(`/make/${slug}`);

  await page.getByRole("link", { name: "Throw this game away" }).click();
  await expect(page).toHaveURL(`/make/${slug}/throw-away`);
  await page.getByRole("button", { name: "Throw it away" }).click();

  await expect(page).toHaveURL("/make");
  await expect(page.getByText(`${name} was thrown away.`)).toBeVisible();
});
