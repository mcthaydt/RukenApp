import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { pageHasSettled, signUp } from "./account.ts";
import { consented } from "./consent.ts";
import { givePage, makerNumberOf } from "./database.ts";
import { gameWhere } from "./game.ts";
import { asInstalled } from "./installed.ts";
import { beforeLaunch } from "./launch.ts";
import { forgetRateLimits } from "./rate-limits.ts";
import { PLAYTEST_WORDS as W } from "../../../src/features/playtest/words.ts";

// Playtesting at its fullest, the day before launch, for the standing checks (overlap, fit, real buttons, the pad): a
// maker with asking on, one person playing, one waiting and one signed out, so every row, button and badge the screens
// can show is there.

const SITE = "http://localhost:4173";

export interface PlaytestSide {
  context: BrowserContext;
  page: Page;
}

export interface PlaytestScene {
  slug: string;
  /** The maker, on their Playtesters page's address. */
  maker: PlaytestSide;
  /** Let in: their feed and the game's page show the badge, Play with its tag and the free line. */
  tester: PlaytestSide & { name: string };
  /** Still waiting: the game's page shows You asked and Take back. */
  asker: PlaytestSide & { name: string };
  /** Signed out: the feed and the game's page show the badge. */
  onlooker: PlaytestSide;
  playtesters: string;
  close: () => Promise<void>;
}

async function side(browser: Browser): Promise<PlaytestSide> {
  const context = await browser.newContext({ ...consented, baseURL: SITE });
  await asInstalled(context);
  await beforeLaunch(context);
  return { context, page: await context.newPage() };
}

async function asks(person: PlaytestSide, slug: string): Promise<void> {
  const answer = await person.page.request.post(`/g/${slug}/playtest`, {
    headers: { origin: SITE, accept: "application/json" },
    form: { want: "on" },
  });
  expect(answer.ok(), "the ask went in").toBe(true);
}

export async function playtestScene(browser: Browser): Promise<PlaytestScene> {
  const maker = await side(browser);
  const tester = await side(browser);
  const asker = await side(browser);
  const onlooker = await side(browser);
  await forgetRateLimits();
  const { slug } = await gameWhere(maker.page, { state: "live" });
  await givePage(
    { number: await makerNumberOf(slug) },
    { name: "Pat Playtest Maker", oneLine: "I make games." },
  );
  const playtesters = `/make/${slug}/playtesters`;
  const switched = await maker.page.request.post(`${playtesters}?/asking`, {
    headers: { origin: SITE },
    form: { asking: "on" },
  });
  expect(switched.ok(), "asking turned on").toBe(true);

  const named = async (person: PlaytestSide, name: string) => {
    // Several sign-ups in a row from one machine would meet the sign-up limit.
    await forgetRateLimits();
    await givePage(await signUp(person.page), { name, oneLine: "I play games." });
    await asks(person, slug);
    return { ...person, name };
  };
  const testerNamed = await named(tester, "Tess Tester Longname");
  const askerNamed = await named(asker, "Ash Asker Longname");

  await maker.page.goto(playtesters);
  await pageHasSettled(maker.page);
  await maker.page.getByRole("button", { name: W.letPlay(testerNamed.name) }).click();
  await expect(maker.page.getByRole("region", { name: W.playing })).toContainText(testerNamed.name);

  return {
    slug,
    maker,
    tester: testerNamed,
    asker: askerNamed,
    onlooker,
    playtesters,
    close: async () => {
      await Promise.all([maker, tester, asker, onlooker].map(({ context }) => context.close()));
    },
  };
}
