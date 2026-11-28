import { expect, test, type BrowserContext, type Locator, type Page } from "@playwright/test";
import { pageHasSettled, signUp } from "./support/account.ts";
import { consented } from "./support/consent.ts";
import {
  followById,
  givePage,
  likeById,
  personWithPage,
  unfollowById,
  userIdOf,
} from "./support/database.ts";
import { gameWhere } from "./support/game.ts";
import { asInstalled } from "./support/installed.ts";
import { showTheOwner } from "./support/look.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

// Friend bubbles (roadmap, slice 3: "up to 3 faces of people you know who liked it, then +N"): on a clip, the faces of
// the viewer's friends (people who follow each other) who liked the game, newest like first, at most three, then a +N
// for the rest. A one-way follow is not a friend. A friend taking the like back, or the friendship ending, takes the face
// off; with no friend left the cluster goes. Nobody signed out sees one.

const SITE = "http://localhost:4173";
/** A photo address of this run's own: a page's photo is its own, and the journeys share one database. */
const PHOTO = `photos/${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}.webp`;

let live: { slug: string; name: string };
let makerContext: BrowserContext;

test.beforeAll(async ({ browser }) => {
  test.setTimeout(180_000);
  await forgetRateLimits();
  makerContext = await browser.newContext({ ...consented, baseURL: SITE });
  live = await gameWhere(await makerContext.newPage(), { state: "live" });
});
test.afterAll(async () => {
  await makerContext.close();
});
test.beforeEach(forgetRateLimits);

/** The game's clip on the feed, brought on screen, once the feed's script has started. */
async function clipOnFeed(page: Page): Promise<Locator> {
  await page.goto("/");
  await pageHasSettled(page);
  const clip = page.locator(`section[data-slug="${live.slug}"]`).first();
  await clip.scrollIntoViewIfNeeded();
  await expect(clip.getByRole("button", { name: "Share" })).toBeVisible();
  return clip;
}

const bubbles = (clip: Locator) => clip.getByRole("img", { name: /^Liked by your friend/ });

/**
 * Where the faces sit: floating over the clip, just above the game's card at its left, in front of the video and behind
 * every button (the owner, 2026-11-27: "floating in the air behind the floating UI, but in front of the video like
 * instagram"). So the card is the same size with faces or without, and a press on them goes through to the clip, which
 * opens the game like a press anywhere else on it.
 */
async function facesPlaced(clip: Locator): Promise<void> {
  const faces = await bubbles(clip).boundingBox();
  const card = await clip.locator(".band").boundingBox();
  if (faces === null || card === null) throw new Error("the faces or the game's card are not on screen");
  expect(Math.abs(faces.x - card.x)).toBeLessThanOrEqual(1);
  expect(faces.y + faces.height).toBeLessThanOrEqual(card.y);
  // Just above it, not adrift up the clip.
  expect(card.y - (faces.y + faces.height)).toBeLessThanOrEqual(12);
  expect(faces.y).toBeGreaterThanOrEqual(0);
  const under = await clip.evaluate(
    (section, at) => {
      const thing = document.elementFromPoint(at.x, at.y);
      if (thing === null || !section.contains(thing)) return "outside the clip";
      return thing.matches("a.open") ? "the clip's link" : thing.outerHTML.slice(0, 80);
    },
    { x: faces.x + faces.width / 2, y: faces.y + faces.height / 2 },
  );
  expect(under).toBe("the clip's link");
}

/** The game's card is as tall as it would be with no friends' faces. */
async function cardHeight(clip: Locator): Promise<number> {
  const card = await clip.locator(".band").boundingBox();
  if (card === null) throw new Error("the game's card is not on screen");
  return card.height;
}

async function friendsWith(meId: string, name: string, photo?: string): Promise<string> {
  const friend = await personWithPage(name, photo);
  await followById(meId, friend.id);
  await followById(friend.id, meId);
  return friend.id;
}

test("a clip shows up to three faces of friends who liked it, then +N, and loses them as likes and friends go", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  // Opened from the Home Screen, so a phone held sideways shows the feed (a browser tab asks for it upright).
  await asInstalled(page);
  const account = await signUp(page);
  await givePage(account, { name: "Mo Viewer", oneLine: "I play games." });
  const meId = await userIdOf(account.number);

  // No friend liked it yet: no cluster.
  let clip = await clipOnFeed(page);
  await expect(bubbles(clip)).toHaveCount(0);
  const plainCard = await cardHeight(clip);

  // Four friends like it, oldest like first; two people who only follow one way like it too and are never shown.
  const ana = await friendsWith(meId, "Ana Able", PHOTO);
  const ben = await friendsWith(meId, "Ben Best");
  const cy = await friendsWith(meId, "Cy Clay");
  const dee = await friendsWith(meId, "Dee Dale");
  const followsMe = await personWithPage("Fan Only");
  await followById(followsMe.id, meId);
  const iFollow = await personWithPage("Star Only");
  await followById(meId, iFollow.id);
  for (const liker of [ana, ben, cy, dee, followsMe.id, iFollow.id]) await likeById(liker, live.slug, true);

  // Read: the three newest likes' faces, then +1 for Ana, the oldest; a face with no photo shows its first letter.
  clip = await clipOnFeed(page);
  await expect(bubbles(clip)).toHaveAccessibleName(
    "Liked by your friends Dee Dale, Cy Clay, Ben Best and 1 more",
  );
  await expect(bubbles(clip).locator(".face")).toHaveText(["D", "C", "B"]);
  await expect(bubbles(clip).locator(".others")).toHaveText("+1");
  // Each face is a round 28px disc, and nothing in it can be pressed (it is not a stop for Tab or a gamepad).
  const box = await bubbles(clip).locator(".face").first().boundingBox();
  expect(box?.width).toBe(28);
  expect(box?.height).toBe(28);
  await expect(bubbles(clip).locator("a, button")).toHaveCount(0);
  await showTheOwner(page, testInfo, "friend bubbles on a clip");
  // Floating above the card, which grows no taller, on the smallest phone too, and on a phone held sideways.
  await facesPlaced(clip);
  expect(await cardHeight(clip)).toBe(plainCard);
  const upright = page.viewportSize();
  await page.setViewportSize({ width: 320, height: 568 });
  await facesPlaced(await clipOnFeed(page));
  await page.setViewportSize({ width: 667, height: 375 });
  await facesPlaced(await clipOnFeed(page));
  if (upright !== null) await page.setViewportSize(upright);

  // Update: Dee takes the like back, so Ana's face comes in and the +N goes.
  await likeById(dee, live.slug, false);
  clip = await clipOnFeed(page);
  await expect(bubbles(clip)).toHaveAccessibleName("Liked by your friends Cy Clay, Ben Best and Ana Able");
  await expect(bubbles(clip).locator(".others")).toHaveCount(0);
  // Ana's page has a photo, so her face is it.
  await expect(bubbles(clip).locator("img.face")).toHaveCount(1);

  // Delete: friendships ending take the faces off, one at a time, and with nobody left the cluster goes.
  await unfollowById(meId, cy);
  clip = await clipOnFeed(page);
  await expect(bubbles(clip)).toHaveAccessibleName("Liked by your friends Ben Best and Ana Able");
  await unfollowById(ben, meId);
  clip = await clipOnFeed(page);
  await expect(bubbles(clip)).toHaveAccessibleName("Liked by your friend Ana Able");
  await likeById(ana, live.slug, false);
  clip = await clipOnFeed(page);
  await expect(bubbles(clip)).toHaveCount(0);
});

test("nobody signed out sees friend bubbles", async ({ browser }) => {
  // A signed-in person's friend likes the game, so the game has friend likes to show to someone.
  const context = await browser.newContext({ ...consented, baseURL: SITE });
  try {
    const page = await context.newPage();
    const account = await signUp(page);
    const meId = await userIdOf(account.number);
    const friend = await friendsWith(meId, "Eve Early");
    await likeById(friend, live.slug, true);
    await expect(bubbles(await clipOnFeed(page))).toHaveAccessibleName("Liked by your friend Eve Early");
  } finally {
    await context.close();
  }
  const signedOut = await browser.newContext({ ...consented, baseURL: SITE });
  try {
    const clip = await clipOnFeed(await signedOut.newPage());
    await expect(bubbles(clip)).toHaveCount(0);
  } finally {
    await signedOut.close();
  }
});
