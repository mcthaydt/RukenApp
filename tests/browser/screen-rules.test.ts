import { expect, test, type Page } from "@playwright/test";
import { pageHasSettled, signUp } from "./support/account.ts";
import { fillAnswers, putGameWhereStaffLeaveIt } from "./support/database.ts";
import { addDraft, agreeToTheAgreement, giveRealClips } from "./support/game.ts";
import { CARD_SCREENS, layoutHasSettled } from "./support/look.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";
import {
  linkFindings,
  measureScreen,
  VIEWS,
  viewFindings,
  type Answers,
  type Finding,
} from "./support/screen-rules.ts";

// The screen rules (CLAUDE.md, "Visual review", step 1), run on every screen the journeys visit, in every window the
// screens are reviewed in. A screen that breaks a rule fails this journey by itself: nobody has to look. The rules and how
// each is measured are in support/screen-rules.ts, and screen-rules-detect.test.ts proves each rule can fail.
//
// The journey makes the account and the games once, then walks every screen in every window with its own browser
// window of that size, as a phone, a tablet or a computer has it. It does not stop at the first screen that breaks a
// rule: it lists every one, so the fix can be made in one round.

test.beforeEach(forgetRateLimits);

/**
 * A screen a journey can open, and what it is called in the list of findings. It is either an address, or a way a journey
 * already has of reaching it (`CARD_SCREENS`).
 */
type Screen = {
  name: string;
  /** The front page needs no way back: it is where the others go back to. */
  isFrontPage?: boolean;
} & ({ path: string } | { open(page: Page): Promise<void> });

/** A screen that is an address. An address that answers an error is a finding of its own. */
function address(name: string, path: string, options: { isFrontPage?: boolean } = {}): Screen {
  return { name, path, ...options };
}

/** A new game of the signed-in maker, finished and with real clips, and where staff would leave it. */
async function gameWhere(
  page: Page,
  decision: Parameters<typeof putGameWhereStaffLeaveIt>[1],
): Promise<string> {
  const { slug } = await addDraft(page);
  await fillAnswers(slug, { files: true, videos: true, age: "age_12" });
  await giveRealClips(page, slug);
  await putGameWhereStaffLeaveIt(slug, decision);
  return slug;
}

/** The questions a finished game that is not 18+ can be opened at: marks are asked only of an 18+ game. */
const QUESTIONS = ["name", "line", "files", "plays-on", "age", "websites", "upright", "wide"];

test("every screen follows the screen rules", async ({ page, browser, baseURL, playwright }, testInfo) => {
  test.skip(
    testInfo.project.name !== "computer",
    "every window is made here by the journey itself, so one project runs it",
  );
  // About fifty screens in eleven windows, each one settled and measured.
  test.setTimeout(25 * 60_000);
  if (baseURL === undefined) throw new Error("the site's address is not set");
  const siteOrigin = new URL(baseURL).origin;

  // ---- The people and the games the screens belong to ----------------------------------------------------------------
  await signUp(page);
  // Not sent yet: every question, the agreement and Check and send are open.
  const unsent = (await addDraft(page)).slug;
  await fillAnswers(unsent, { files: true, videos: true, age: "age_12" });
  await giveRealClips(page, unsent);
  await agreeToTheAgreement(page, unsent);
  // An 18+ game is asked its content marks, which no other game is.
  const eighteen = (await addDraft(page)).slug;
  await fillAnswers(eighteen, { files: true, videos: true, age: "age_18" });
  const waiting = await gameWhere(page, { state: "waiting" });
  const sentBack = await gameWhere(page, {
    state: "sent_back",
    toFix: [
      { part: "one_line", reason: "not_this_game", note: "Please say what the game is, not how it feels." },
    ],
  });
  const live = await gameWhere(page, { state: "live" });
  const liveWithUpdate = await gameWhere(page, { state: "live", updateWaiting: true });
  const signedIn = await page.context().storageState();

  // Anyone can open these.
  const signedOutScreens: Screen[] = [
    address("the front page", "/", { isFrontPage: true }),
    address("signed out", "/goodbye"),
    ...CARD_SCREENS,
  ];
  // These need the maker's sign-in.
  const signedInScreens: Screen[] = [
    address("your account", "/me"),
    address("delete your account", "/me/delete"),
    address("join, not a member", "/join"),
    address("your games", "/make"),
    address("a new game", "/make/new"),
    address("a finished game", `/make/${unsent}`),
    ...QUESTIONS.map((question) => address(`question: ${question}`, `/make/${unsent}/${question}`)),
    address("question: marks", `/make/${eighteen}/marks`),
    address("the maker agreement to sign", `/make/${unsent}/agreement`),
    address("check and send", `/make/${unsent}/check`),
    address("throw a game away", `/make/${unsent}/throw-away`),
    address("a game waiting for staff", `/make/${waiting}`),
    address("a game sent back", `/make/${sentBack}`),
    address("a live game", `/make/${live}`),
    address("take a live game off", `/make/${live}/take-off`),
    address("a live game with a new version waiting", `/make/${liveWithUpdate}`),
  ];

  // What each address answers, asked once for the whole walk. A link asked with the maker's sign-in is asked with their
  // own copy of it, so asking changes nothing about the walk.
  const askedSignedOut: Answers = new Map();
  const askedSignedIn: Answers = new Map();
  const asksOut = await playwright.request.newContext({ baseURL });
  const asksIn = await playwright.request.newContext({ baseURL, storageState: signedIn });

  // ---- The walk ------------------------------------------------------------------------------------------------------
  /** Each finding once, with every window it was seen in. */
  const seen = new Map<string, { finding: Finding; views: Set<string> }>();
  const note = (finding: Finding, view: string) => {
    const key = `${finding.rule}|${finding.screen}|${finding.what}`;
    const known = seen.get(key) ?? { finding, views: new Set<string>() };
    known.views.add(view);
    seen.set(key, known);
  };

  for (const [index, view] of VIEWS.entries()) {
    const windowOf = {
      viewport: { width: view.width, height: view.height },
      isMobile: view.touch,
      hasTouch: view.touch,
    };
    const walks = [
      {
        screens: signedOutScreens,
        context: await browser.newContext({ baseURL, ...windowOf }),
        api: asksOut,
        asked: askedSignedOut,
      },
      {
        screens: signedInScreens,
        context: await browser.newContext({ baseURL, ...windowOf, storageState: signedIn }),
        api: asksIn,
        asked: askedSignedIn,
      },
    ];
    for (const { screens, context, api, asked } of walks) {
      const walker = await context.newPage();
      walker.setDefaultTimeout(15_000);
      for (const screen of screens) {
        if ("path" in screen) {
          const status = (await walker.goto(screen.path))?.status() ?? 0;
          if (status >= 400)
            note(
              {
                rule: "dead link",
                screen: screen.name,
                what: `its own address ${screen.path} answers ${String(status)}`,
              },
              view.name,
            );
        } else {
          await screen.open(walker);
        }
        await pageHasSettled(walker);
        await layoutHasSettled(walker);
        const measured = await measureScreen(walker);
        for (const finding of viewFindings(screen.name, measured, screen.isFrontPage === true))
          note(finding, view.name);
        // Where a link goes does not depend on the window, so the first window asks, and the others need not.
        if (index === 0)
          for (const finding of await linkFindings(screen.name, measured, api, siteOrigin, asked))
            note(finding, view.name);
      }
      await context.close();
    }
  }
  await asksOut.dispose();
  await asksIn.dispose();

  // ---- The verdict: every screen that breaks a rule, listed --------------------------------------------------------------
  const report = [...seen.values()]
    .map(({ finding, views }) => {
      const where = views.size === VIEWS.length ? "every window" : [...views].join(", ");
      return `${finding.rule} | ${finding.screen} | ${finding.what} | ${where}`;
    })
    .sort();
  await testInfo.attach("screen-rule-findings.txt", { body: report.join("\n"), contentType: "text/plain" });
  expect(report, "screens that break a rule (rule | screen | what | where)").toEqual([]);
});
