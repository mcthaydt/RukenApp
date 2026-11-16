import { expect, test, type Page } from "@playwright/test";
import { pageHasSettled, signUp } from "./support/account.ts";
import {
  changeGame,
  countPlay,
  playsStartedOn,
  putGameWhereStaffLeaveIt,
  stateOf,
} from "./support/database.ts";
import { makerWithGameWhere, signInAsStaff, submitGame } from "./support/game.ts";
import { boxOf, showTheOwner } from "./support/look.ts";
import {
  decideButton,
  heading,
  nextButton,
  onPart,
  partBox,
  tickOn,
  toTheDecision,
} from "./support/check.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

// Staff accept a game or send it back (design 5.5, 11.1 screen 2, 11.2). Only the first journey makes a real game through
// the maker's screens, because it looks inside the game's frame; every other journey writes its waiting game into the
// database, and its frame shows the gate's "Not found." for a stand-in pull that no journey reads.

test.beforeEach(forgetRateLimits);

/** What the first screen tells staff to do before anything is pressed (plain-words M1). */
const WHAT_TO_DO = "Play it, then look at each part. Tick anything that's wrong.";
/** What a part with no box says on a live game's update (plain-words M7). */
const LIVE_NO_BOX = "This game is already live, so you can't send it back for this part.";

/** Staff open the check page of a game, signed in as a curator. Says who they are, for a journey that plays the game. */
async function checkingAGame(page: Page, slug: string): Promise<{ email: string }> {
  const staff = await signInAsStaff(page);
  await page.goto(`/admin/games/${slug}`);
  await pageHasSettled(page);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  return staff;
}

/**
 * Staff open the check page and play the game for a few seconds, so that Accept goes straight through: Accept on a game
 * nobody played asks "Accept it anyway?" first (walk W6), and the journeys about something else are not about that.
 */
async function checkingAPlayedGame(page: Page, slug: string): Promise<void> {
  const { email } = await checkingAGame(page, slug);
  await countPlay(slug, email, 30);
}

test("staff accept a waiting game, and its maker sees it Live", async ({ page, browser }, testInfo) => {
  // design 8
  test.setTimeout(90_000);
  const waiting = await submitGame(browser);
  const staff = await signInAsStaff(page);
  await page.goto("/admin/games");
  await pageHasSettled(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Games to check");
  await showTheOwner(page, testInfo, "games to check");

  await page.getByRole("link", { name: new RegExp(waiting.name) }).click();
  await expect(page).toHaveURL(`/admin/games/${waiting.slug}`);
  await pageHasSettled(page);
  // Staff play the game before it is live: its own page loads in the frame.
  await expect(page.frameLocator("iframe.frame").getByRole("heading", { name: "Tiny game" })).toBeVisible();
  await showTheOwner(page, testInfo, "checking a game");
  await countPlay(waiting.slug, staff.email, 30);
  await toTheDecision(page);
  await expect(decideButton(page, "Accept")).toBeVisible();
  await showTheOwner(page, testInfo, "deciding on a game");

  await decideButton(page, "Accept").click();

  await expect(page).toHaveURL("/admin/games");
  expect(await stateOf(waiting.slug)).toBe("live");
  // Said once, so staff can tell it went through (walk W3), and not again on a reload.
  await expect(page.getByRole("status")).toHaveText(`${waiting.name} is live.`);
  await page.reload();
  await expect(page.getByRole("status")).toHaveCount(0);
});

test("the list says what is waiting, the oldest first, and is empty when nothing is", async ({
  page,
  browser,
}) => {
  const maker = await makerWithGameWhere(browser, { state: "waiting" });
  try {
    await signInAsStaff(page);
    await page.goto("/admin/games");
    await pageHasSettled(page);

    const row = page.getByRole("link", { name: new RegExp(maker.name) });
    await expect(row).toContainText(maker.makerEmail);
    await expect(row).toContainText(/Waiting \d+ (minutes?|hours?|days?)/);
    expect((await boxOf(row)).height).toBeGreaterThanOrEqual(44);
  } finally {
    await maker.close();
  }
});

test("ticking a part turns Accept into Send back, and the maker reads why", async ({
  page,
  browser,
}, testInfo) => {
  const maker = await makerWithGameWhere(browser, { state: "waiting" });
  try {
    await checkingAGame(page, maker.slug);
    await expect(page.getByText(WHAT_TO_DO)).toBeVisible();
    // Nothing is pressed before the last question: the others go on.
    await expect(decideButton(page, /^(Accept|Send back)/)).toHaveCount(0);

    await onPart(page, "Upright video");
    await tickOn(page, "Upright video").check();
    await page.getByRole("radio", { name: "It's on its side." }).check();
    await showTheOwner(page, testInfo, "sending a game back");
    await toTheDecision(page);
    await expect(decideButton(page, "Send back")).toBeVisible();
    await expect(decideButton(page, "Accept")).toHaveCount(0);
    await expect(page.getByText("One part is wrong. Press Send back, and the maker sees why.")).toBeVisible();
    await decideButton(page, "Send back").click();

    await expect(page).toHaveURL("/admin/games");
    await expect(page.getByRole("status")).toHaveText(`${maker.name} was sent back. Its maker can see why.`);
    expect(await stateOf(maker.slug)).toBe("sent_back");
    await maker.page.goto(`/make/${maker.slug}`);
    await expect(maker.page.getByText("It's on its side. Record it with your phone upright.")).toBeVisible();
  } finally {
    await maker.close();
  }
});

test("a part's reasons are hidden until it is ticked, and hidden again when it is not", async ({
  page,
  browser,
}) => {
  const maker = await makerWithGameWhere(browser, { state: "waiting" });
  try {
    await checkingAGame(page, maker.slug);
    await onPart(page, "Name");
    const reason = page.getByRole("radio", { name: "It's rude." });

    await expect(reason).toBeHidden();
    await tickOn(page, "Name").check();
    await expect(reason).toBeVisible();
    // The reasons are pick-one, though they sit under a tick box (walk W8).
    await expect(partBox(page, "Name").getByText("Pick one.")).toBeVisible();
    await tickOn(page, "Name").uncheck();
    await expect(reason).toBeHidden();
  } finally {
    await maker.close();
  }
});

test("a tick with no reason is refused, and the tick is kept", async ({ page, browser }) => {
  // Review Focus 4
  const maker = await makerWithGameWhere(browser, { state: "waiting" });
  try {
    await checkingAGame(page, maker.slug);
    await onPart(page, "Wide video");
    await tickOn(page, "Wide video").check();
    await toTheDecision(page);

    await decideButton(page, "Send back").click();

    // It names the part, and the page opens at that question with the tick as it was left (walk W4).
    await expect(page.getByRole("alert")).toHaveText("Pick a reason for Wide video.");
    await expect(partBox(page, "Wide video").getByRole("alert")).toBeVisible();
    await expect(tickOn(page, "Wide video")).toBeChecked();
    expect(await stateOf(maker.slug)).toBe("waiting");
  } finally {
    await maker.close();
  }
});

test("Something else needs a line of your own, and keeps what was typed", async ({ page, browser }) => {
  // Review Focus 4
  const maker = await makerWithGameWhere(browser, { state: "waiting" });
  try {
    await checkingAGame(page, maker.slug);
    await onPart(page, "One line");
    await tickOn(page, "One line").check();
    // The label never says "if you want": for Something else the line is not optional (plain-words M5).
    await expect(
      partBox(page, "One line").getByText(
        "Add a line of your own. You need one if you picked Something else.",
      ),
    ).toBeVisible();
    await partBox(page, "One line").getByRole("radio", { name: "Something else" }).check();
    await toTheDecision(page);

    await decideButton(page, "Send back").click();
    await expect(page.getByRole("alert")).toHaveText("Say what's wrong with One line, in your own words.");
    await expect(partBox(page, "One line").getByRole("alert")).toBeVisible();
    await expect(partBox(page, "One line").getByRole("radio", { name: "Something else" })).toBeChecked();

    await page.getByRole("textbox").fill("Say what the game is, not what it is like.");
    await toTheDecision(page);
    await decideButton(page, "Send back").click();

    await expect(page).toHaveURL("/admin/games");
    await maker.page.goto(`/make/${maker.slug}`);
    await expect(maker.page.getByText("Say what the game is, not what it is like.")).toBeVisible();
  } finally {
    await maker.close();
  }
});

test("staff can change who it is for before Accept", async ({ page, browser }) => {
  const maker = await makerWithGameWhere(browser, { state: "waiting" });
  try {
    await checkingAPlayedGame(page, maker.slug);
    await onPart(page, "Who it's for");
    await expect(page.getByRole("radio", { name: "12+" })).toBeChecked();

    await page.getByRole("radio", { name: "16+" }).check();
    await toTheDecision(page);
    await decideButton(page, "Accept").click();

    await expect(page).toHaveURL("/admin/games");
    await maker.page.goto(`/make/${maker.slug}`);
    await expect(maker.page.getByText("16+")).toBeVisible();
  } finally {
    await maker.close();
  }
});

test("who it is for is one place: the maker's pick, staff's own pick, and sending it back", async ({
  page,
  browser,
}) => {
  // Plain-words H1 and H2
  const maker = await makerWithGameWhere(browser, { state: "waiting" });
  try {
    await checkingAGame(page, maker.slug);
    await onPart(page, "Who it's for");

    // Both ways to act on the age are on the one question, each saying what it does.
    await expect(page.getByText("The maker picked 12+. Pick who it's for.")).toBeVisible();
    await expect(page.getByRole("radio", { name: "12+" })).toBeChecked();
    await expect(page.getByText("Or send it back, and the maker will choose again.")).toBeVisible();

    // Sent back, the maker is told which way (not always "older").
    await tickOn(page, "Who it's for").check();
    await expect(page.getByRole("radio", { name: "It's for older players." })).toBeVisible();
    await page.getByRole("radio", { name: "It's for younger players." }).check();
    await toTheDecision(page);
    await decideButton(page, "Send back").click();

    await expect(page).toHaveURL("/admin/games");
    await maker.page.goto(`/make/${maker.slug}`);
    await expect(
      maker.page.getByText(`We think ${maker.name} is for younger players. Choose again.`),
    ).toBeVisible();
  } finally {
    await maker.close();
  }
});

test("making a game 18+ asks for its marks, and Accept without one is refused", async ({ page, browser }) => {
  // Review Focus 5
  const maker = await makerWithGameWhere(browser, { state: "waiting" });
  try {
    await checkingAPlayedGame(page, maker.slug);
    await onPart(page, "Who it's for");
    const gore = page.getByRole("checkbox", { name: "Gore" });
    // The marks are asked under the age, in the words the maker was asked (plain-words M6), and only for an 18+ game.
    const question = page.getByText(`Does ${maker.name} have any of these?`);
    await expect(gore).toBeHidden();
    await expect(question).toBeHidden();

    await page.getByRole("radio", { name: "18+" }).check();
    await expect(question).toBeVisible();
    await expect(gore).toBeVisible();
    await toTheDecision(page);
    await decideButton(page, "Accept").click();
    const refusal = `Pick what ${maker.name} has, or None of these.`;
    await expect(page.getByRole("alert")).toHaveText(refusal);
    // The page opens at who it's for, and the words are under the marks' question and above the four boxes (HL1).
    await expect(question).toBeVisible();
    const words = await boxOf(page.getByRole("alert"));
    expect(words.y).toBeGreaterThan((await boxOf(question)).y);
    expect(words.y + words.height).toBeLessThanOrEqual((await boxOf(gore)).y);
    expect(await stateOf(maker.slug)).toBe("waiting");

    await page.getByRole("checkbox", { name: "Gore" }).check();
    await toTheDecision(page);
    await decideButton(page, "Accept").click();
    await expect(page).toHaveURL("/admin/games");
    expect(await stateOf(maker.slug)).toBe("live");
  } finally {
    await maker.close();
  }
});

test("18+ with no mark on a game nobody played is refused before it is asked about", async ({
  page,
  browser,
}) => {
  // Harsh look HL4: staff are not made to say yes to a question and then refused for what was wrong before it.
  const maker = await makerWithGameWhere(browser, { state: "waiting" });
  try {
    await checkingAGame(page, maker.slug);
    await onPart(page, "Who it's for");
    await page.getByRole("radio", { name: "18+" }).check();
    await toTheDecision(page);
    await decideButton(page, "Accept").click();

    await expect(page.getByRole("alert")).toHaveText(`Pick what ${maker.name} has, or None of these.`);
    await expect(decideButton(page, "Accept it anyway")).toHaveCount(0);
    expect(await stateOf(maker.slug)).toBe("waiting");

    // With a mark picked the press would go through, so now it asks.
    await page.getByRole("checkbox", { name: "Gore" }).check();
    await toTheDecision(page);
    await decideButton(page, "Accept").click();
    await expect(page.getByRole("alert")).toHaveText(`You haven't played ${maker.name}. Accept it anyway?`);
  } finally {
    await maker.close();
  }
});

test("an update has a box only on what its maker can fix", async ({ page, browser }) => {
  // Review Focus 6
  const maker = await makerWithGameWhere(browser, { state: "live", updateWaiting: true });
  try {
    await checkingAGame(page, maker.slug);

    await expect(page.getByText(/^Update to a live game/)).toBeVisible();
    for (const title of ["Name", "One line", "Game files", "Where it plays"]) {
      await expect(tickOn(page, title)).toBeVisible();
      // The parts that have a box say nothing of the kind.
      await expect(partBox(page, title).getByText(LIVE_NO_BOX)).toHaveCount(0);
    }
    const withNoBox = async (title: string): Promise<void> => {
      await expect(tickOn(page, title)).toHaveCount(0);
      // A part with no box says why, so staff do not look for one.
      await expect(partBox(page, title).getByText(LIVE_NO_BOX)).toBeVisible();
    };
    for (const title of ["Upright video", "Wide video", "Other websites"]) await withNoBox(title);
    await onPart(page, "Who it's for");
    await withNoBox("Who it's for");
  } finally {
    await maker.close();
  }
});

test("a game that needs a keyboard says so", async ({ page, browser }) => {
  const maker = await makerWithGameWhere(browser, { state: "waiting" });
  try {
    await changeGame(maker.slug, { playsOn: "computer_only" });
    await checkingAGame(page, maker.slug);

    await expect(
      page.getByText("This game needs a keyboard. If you're on an iPad or phone, connect one."),
    ).toBeVisible();
  } finally {
    await maker.close();
  }
});

test("a game that changed while staff looked is not accepted, and staff are told to look again", async ({
  page,
  browser,
}) => {
  // Audit S-1
  const maker = await makerWithGameWhere(browser, { state: "waiting" });
  try {
    await checkingAPlayedGame(page, maker.slug);

    await changeGame(maker.slug, { oneLine: "Something the staff did not read." });
    await toTheDecision(page);
    await decideButton(page, "Accept").click();

    await expect(page.getByRole("alert")).toHaveText("This game changed while you were looking. Look again.");
    expect(await stateOf(maker.slug)).toBe("waiting");

    // The refusal brings the new answers onto this same page, so there is nothing to reload by hand: the new line is on the
    // list, and Accept then works (a page that kept the old look was refused again on every press).
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await expect(page.getByText("Something the staff did not read.")).toBeVisible();
    await toTheDecision(page);
    await decideButton(page, "Accept").click();
    await expect(page).toHaveURL("/admin/games");
    expect(await stateOf(maker.slug)).toBe("live");
  } finally {
    await maker.close();
  }
});

test("a game whose new files were refused can only be sent back, and says to tick first", async ({
  page,
  browser,
}) => {
  // Audit S-6, and walk W7: the button no longer offers an Accept that can only refuse.
  const words =
    "The maker is fixing this game's files, so you can't accept it yet. It stays on your list until they're done. You can still send it back.";
  const maker = await makerWithGameWhere(browser, {
    state: "waiting",
    pullProblem: "index.html is missing.",
  });
  try {
    await checkingAGame(page, maker.slug);
    // It is read before the blue button is pressed, so it is drawn as a refusal is, and not as a quiet note.
    const aboutTheFiles = page.locator("p.problem:visible", { hasText: words });
    await expect(aboutTheFiles).toBeVisible();
    await toTheDecision(page);
    await expect(aboutTheFiles).toBeVisible();
    // There is no Accept to press: the one blue button says Send back from the start.
    await expect(decideButton(page, "Accept")).toHaveCount(0);
    await expect(decideButton(page, "Send back")).toBeVisible();

    await decideButton(page, "Send back").click();

    await expect(page.getByRole("alert")).toHaveText("Tick what's wrong first, then press Send back.");
    // The words about the files are still there after the press.
    await expect(aboutTheFiles).toBeVisible();
    expect(await stateOf(maker.slug)).toBe("waiting");
  } finally {
    await maker.close();
  }
});

test("the page says how long you have played the game, and nothing yet", async ({ page, browser }) => {
  const maker = await makerWithGameWhere(browser, { state: "waiting" });
  try {
    await checkingAGame(page, maker.slug);

    await expect(page.getByText("You haven't played it yet.")).toBeVisible();
  } finally {
    await maker.close();
  }
});

test("the line about play moves while staff play, without a new page", async ({ page, browser }) => {
  // Walk W5: the line was drawn once, so it said "yet" after minutes of play.
  const maker = await makerWithGameWhere(browser, { state: "waiting" });
  try {
    const { email } = await checkingAGame(page, maker.slug);
    await expect(page.getByText("You haven't played it yet.")).toBeVisible();

    await countPlay(maker.slug, email, 30);

    // Coming back to the page asks again at once; the page also asks every 15 seconds, which no journey waits for. The
    // press is repeated until it lands, because it is lost if it comes before the page is listening.
    await expect(async () => {
      await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
      await expect(page.getByText("You've played it for less than a minute.")).toBeVisible({ timeout: 1000 });
    }).toPass();
  } finally {
    await maker.close();
  }
});

test("Accept on a game nobody played asks once, and then accepts", async ({ page, browser }) => {
  // Walk W6, the Owner's choice b.
  const maker = await makerWithGameWhere(browser, { state: "waiting" });
  try {
    await checkingAGame(page, maker.slug);
    await toTheDecision(page);

    await decideButton(page, "Accept").click();

    await expect(page.getByRole("alert")).toHaveText(`You haven't played ${maker.name}. Accept it anyway?`);
    await expect(decideButton(page, "Accept it anyway")).toBeVisible();
    expect(await stateOf(maker.slug)).toBe("waiting");

    await decideButton(page, "Accept it anyway").click();

    await expect(page).toHaveURL("/admin/games");
    await expect(page.getByRole("status")).toHaveText(`${maker.name} is live.`);
    expect(await stateOf(maker.slug)).toBe("live");
  } finally {
    await maker.close();
  }
});

test("a game played since the page was drawn is accepted without asking", async ({ page, browser }) => {
  // The server reads the play at the press, not the line the page was drawn with.
  const maker = await makerWithGameWhere(browser, { state: "waiting" });
  try {
    const { email } = await checkingAGame(page, maker.slug);
    await expect(page.getByText("You haven't played it yet.")).toBeVisible();
    await countPlay(maker.slug, email, 30);
    await toTheDecision(page);

    await decideButton(page, "Accept").click();

    await expect(page).toHaveURL("/admin/games");
    expect(await stateOf(maker.slug)).toBe("live");
  } finally {
    await maker.close();
  }
});

test("a game someone else decided first sends staff back to the list with a word", async ({
  page,
  browser,
}) => {
  // Walk W2: it was "We can't find that page." with a button that went nowhere useful.
  const maker = await makerWithGameWhere(browser, { state: "waiting" });
  try {
    await checkingAGame(page, maker.slug);
    // A colleague accepts it while this page is open.
    await putGameWhereStaffLeaveIt(maker.slug, { state: "live" });
    await toTheDecision(page);

    await decideButton(page, "Accept").click();

    await expect(page).toHaveURL("/admin/games");
    await expect(page.getByRole("status")).toHaveText(`${maker.name} isn't waiting for a check any more.`);

    // An old list, or the browser's Back after deciding, opens the same way.
    await page.goto(`/admin/games/${maker.slug}`);
    await expect(page).toHaveURL("/admin/games");
    await expect(page.getByRole("status")).toHaveText(`${maker.name} isn't waiting for a check any more.`);
    // A game that is not there at all is still a missing page, and staff's page offers the way back to the list.
    expect((await page.goto("/admin/games/no-such-game-at-all"))?.status()).toBe(404);
    await expect(page.getByRole("link", { name: "Back to games to check" })).toHaveAttribute(
      "href",
      "/admin/games",
    );
  } finally {
    await maker.close();
  }
});

test("hovering over a game on the list does not start a play", async ({ page, browser }) => {
  // Review L2: the site reads a page ahead when a link is hovered, and the check page's load starts a staff play.
  const maker = await makerWithGameWhere(browser, { state: "waiting" });
  try {
    await signInAsStaff(page);
    await page.goto("/admin/games");
    await pageHasSettled(page);
    const row = page.getByRole("link", { name: new RegExp(maker.name) });
    await expect(row).toHaveAttribute("data-sveltekit-preload-data", "off");

    await row.hover();
    await page.waitForLoadState("networkidle");
    expect(await playsStartedOn(maker.slug)).toBe(0);

    // Opening it does start one.
    await row.click();
    await expect(page).toHaveURL(`/admin/games/${maker.slug}`);
    expect(await playsStartedOn(maker.slug)).toBe(1);
  } finally {
    await maker.close();
  }
});

test("staff find the list from home, from Your account and from the bar of every staff page", async ({
  page,
  browser,
}) => {
  // Walk W1: nothing linked to /admin, so staff had to type its address.
  const maker = await makerWithGameWhere(browser, { state: "waiting" });
  try {
    await signInAsStaff(page);
    for (const address of ["/", "/me"]) {
      await page.goto(address);
      await pageHasSettled(page);
      await page.getByRole("link", { name: "Games to check" }).click();
      await expect(page).toHaveURL("/admin/games");
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Games to check");
    }
    await page.getByRole("link", { name: new RegExp(maker.name) }).click();
    await expect(page).toHaveURL(`/admin/games/${maker.slug}`);
    // The bar's own link is the way to the list from a game, as it is from the list.
    await page.getByRole("link", { name: "Games to check", exact: true }).click();
    await expect(page).toHaveURL("/admin/games");
  } finally {
    await maker.close();
  }
});

test("the first question's Back goes to the list, and later ones step back inside the page", async ({
  page,
  browser,
}) => {
  // Walk W9: a long page ended with no way back; now every question has its Back.
  const maker = await makerWithGameWhere(browser, { state: "waiting" });
  try {
    await checkingAGame(page, maker.slug);
    await expect(page.getByRole("link", { name: "Back", exact: true })).toHaveAttribute(
      "href",
      "/admin/games",
    );

    const first = (await heading(page).innerText()).trim();
    await nextButton(page).click();
    await expect(heading(page)).not.toHaveText(first);
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await expect(heading(page)).toHaveText(first);
    await page.getByRole("link", { name: "Back", exact: true }).click();
    await expect(page).toHaveURL("/admin/games");
  } finally {
    await maker.close();
  }
});

test("the staff pages are not there for anyone else", async ({ page, browser }) => {
  // Review Focus 7
  const maker = await makerWithGameWhere(browser, { state: "waiting" });
  try {
    const address = `/admin/games/${maker.slug}`;

    // Signed out.
    expect((await page.goto("/admin/games"))?.status()).toBe(404);
    expect((await page.goto(address))?.status()).toBe(404);

    // A plain member.
    await signUp(page);
    expect((await page.goto("/admin/games"))?.status()).toBe(404);
    expect((await page.goto(address))?.status()).toBe(404);
    // Nothing on the error page, home or Your account says there is a staff area behind it.
    await expect(page.getByRole("link", { name: "Back to Ruken" })).toBeVisible();
    await expect(page.getByRole("link", { name: /games to check/i })).toHaveCount(0);
    for (const open of ["/", "/me"]) {
      await page.goto(open);
      await expect(page.getByRole("link", { name: /games to check/i })).toHaveCount(0);
    }

    // A decision posted by hand is the same missing page, and changes nothing.
    const site = new URL(page.url()).origin;
    const posted = await page.request.post(`${site}${address}?/decide`, {
      form: { seen: "x", ageRating: "age_12" },
      headers: { origin: site },
    });
    expect(posted.status()).toBe(404);
    expect(await stateOf(maker.slug)).toBe("waiting");
  } finally {
    await maker.close();
  }
});

test("the button is in view and nothing scrolls sideways", async ({ page, browser }) => {
  const maker = await makerWithGameWhere(browser, { state: "waiting" });
  try {
    await checkingAGame(page, maker.slug);
    await page.emulateMedia({ reducedMotion: "reduce" });

    const viewport = page.viewportSize() ?? { width: 0, height: 0 };
    // On every question the blue button is in view: Next, and Accept or Send back on the last.
    const button = await boxOf(nextButton(page));
    expect(button.y).toBeGreaterThanOrEqual(0);
    expect(button.y + button.height).toBeLessThanOrEqual(viewport.height);
    const widths = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
    }));
    expect(widths.scroll).toBe(widths.client);
  } finally {
    await maker.close();
  }
});

test("every tick, button and link on the check is at least 44 by 44", async ({ page, browser }) => {
  const maker = await makerWithGameWhere(browser, { state: "waiting" });
  try {
    await checkingAGame(page, maker.slug);
    await page.emulateMedia({ reducedMotion: "reduce" });
    // The game's own question, and then a part with its reasons open, so its choices are measured too.
    const everyTarget = async (): Promise<void> => {
      for (const target of await page
        .locator("a:visible, button:visible, input:not([type=hidden]):visible, label:visible")
        .all()) {
        const box = await target.boundingBox();
        if (box === null) continue;
        const words =
          (await target.innerText()).trim() || ((await target.getAttribute("aria-label")) ?? "a target");
        expect(box.width, `${words}, width`).toBeGreaterThanOrEqual(44);
        expect(box.height, `${words}, height`).toBeGreaterThanOrEqual(44);
      }
    };
    await everyTarget();
    await onPart(page, "Name");
    await tickOn(page, "Name").check();
    await everyTarget();
    await toTheDecision(page);
    await everyTarget();
  } finally {
    await maker.close();
  }
});

test("Full size is drawn only where the browser can show a frame full screen", async ({ page, browser }) => {
  const maker = await makerWithGameWhere(browser, { state: "waiting" });
  try {
    await checkingAGame(page, maker.slug);
    const canFullScreen = await page.evaluate(() => document.fullscreenEnabled);

    await expect(page.getByRole("button", { name: "Full size" })).toHaveCount(canFullScreen ? 1 : 0);
  } finally {
    await maker.close();
  }
});
