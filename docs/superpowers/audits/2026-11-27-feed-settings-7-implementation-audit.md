# Feed settings (PR #405): implementation audit 7, merge review

Reviewer: Opus 5.5, medium, in a fresh session. Examined: `edcd5f67a450f65110f9ee097ab3bf342431865a` (merge of `main` at
`bd1e3ff`, after #404 Like/Save/Repost, into the PR at `de2bcce`, which audit 6 passed). Written 2026-11-27 06:07 UTC.

**Verdict: PASS.** No red findings.

## What the merge had to keep

`git show --remerge-diff edcd5f6` shows only the seven conflicted files' resolution. Each keeps both sides:

| File | PR side (#405) | main side (#404) | At edcd5f6 |
| --- | --- | --- | --- |
| `prisma/schema/feed.prisma` | `TasteDirection`, `TasteKind`, `GoodPickAnswer`, `FeedTaste`, `GoodPickAsked` (unique `[userId, gameId]`) | `MarkKind`, `GameMark` (unique `[userId, gameId, kind]`) | all present, each model with its own unique and index; header comment covers both |
| `prisma/schema/games.prisma` | `feedTastes`, `goodPicksAsked` | `marks` | all three on `Game` |
| `src/features/accounts/deletion.ts` | deletes `feedTaste` (own, for them, on their games) and `goodPickAsked` | deletes `gameMark` (own, on their games) | all three, plus `makerFollow` both ways, in the purge transaction |
| `src/features/feed/services.ts` | `taste` | `marks`, `listOf` | all three on `FeedServices` and in `feedServices()`; the PR's `buildServices` helper folded in, no caller left (`grep buildServices` empty) |
| `src/features/feed/Feed.svelte` | `.tunes svg` | `.mark svg` | one shared glass-icon rule; buttons in order Like, Save, Repost, Share, ••• |
| `tests/browser/fits-the-screen.test.ts` | `/settings/feed` | `/me/saved`, `/me/reposts` | all in the list |
| `tests/features/feed/migration.test.ts` | Your feed migration check | marks migration check | marks check kept under the old name; Your feed check moved unchanged to `your-feed-migration.test.ts` |

## Checks run

| Check | Result |
| --- | --- |
| Migrations from scratch on edcd5f6 (`prisma migrate deploy`, Postgres 16) | all applied, `game_marks` 004437, `your_feed` 004603, `maker_follows` 004623 |
| Migrations over main's database (main's set applied at bd1e3ff, then edcd5f6) | only `your_feed` pending, applied cleanly out of order |
| Drift, both databases vs `prisma/schema` (`migrate diff --from-config-datasource`) | empty migration for both |
| Schema of the two databases (`pg_dump -s`, migrations table left out) | identical apart from pg_dump's random `\restrict` token |
| `pnpm lint` | exit 0 |
| `pnpm typecheck` | exit 0 |
| `pnpm test` | 2294 of 2297 passed on the first run; the 3 failures were 5-second timeouts in `tests/pr-rules.test.ts` and `tests/rules-pr-routes.test.ts` while the browser run loaded the box. Neither file differs from main. Re-run alone: 62 of 62 passed. CI's `verify` passed on edcd5f6. |
| `pnpm test:pg` | 55 files, 816 tests passed, including `purge.pg.test.ts` (chips and Good pick answers, follows, marks) and `taste.pg.test.ts` |
| Feed journeys (feed-controls, feed-marks, feed-to-game-grow, feed-top, feed, fits-the-screen, follow-a-maker, glass, how-the-feed-works, look-layout, your-feed) on phone (WebKit, iPhone SE), tablet and computer, in `mcr.microsoft.com/playwright:v1.63.0-noble` | 346 passed, 5 skipped, 0 failed (the run's only 6 failures were the probe's first draft, which read the top bar as the bottom one) |
| Reviewer's side-column probe (below), all three profiles at 320×568 and 375×667 | 6 of 6 passed; phone repeated 3 times, 6 of 6. One earlier phone 320 try failed on the Sound button's place (y −556, a screen up while the feed settled on a cold WebKit); Sound is not in the column, the probe's own timing, and three repeats passed |

Side column measured at 320×568: Like, Save, Repost 48×70 each (count under the icon), Share and ••• 48×48, at x 260,
from y 129 to 484, above the bottom bar at 496; at 375×667, x 315, y 228 to 583, bar at 595. No two overlap, nothing
past the window, page and width scroll 0.

## Account deletion

`purgeOne` deletes, in one transaction: the person's chips, everyone's chips naming them as maker, chips on their games,
their Good pick questions, their marks and every mark on their games, and follows both ways. `purge.pg.test.ts` checks
each and that other people's rows stay. Other players' Good pick answers about a leaving maker's games stay, as at
de2bcce (the game rows stay too); unchanged by the merge.

## Notes (not blocking)

- N1: the probe below is the only check that the five buttons of the column fit together at 320 and 375; no journey in
  the repo asserts it. Worth adding to `fits-the-screen` in a later change.

## Probe (not committed to the PR)

```ts
import { expect, test, type Browser } from "@playwright/test";
import { pageHasSettled, signUp } from "./support/account.ts";
import { consented } from "./support/consent.ts";
import { gameWhere } from "./support/game.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

// Reviewer's probe for PR #405 at edcd5f6 (not part of the PR): with both Like/Save/Repost (#404) and ••• (#405) in
// the clip's right column, every button there is at least 48px, inside the window, overlapping no other, and the page
// does not scroll, at 320 by 568 and 375 by 667.

const SITE = "http://localhost:4173";

async function liveGame(browser: Browser): Promise<void> {
  const context = await browser.newContext({ ...consented, baseURL: SITE });
  try {
    await gameWhere(await context.newPage(), { state: "live" });
  } finally {
    await context.close();
  }
}

test.beforeAll(async ({ browser }) => {
  test.setTimeout(180_000);
  await forgetRateLimits();
  await liveGame(browser);
});
test.beforeEach(forgetRateLimits);

const NAMES = ["Like", "Save", "Repost", "Share", "More or less like this"];

for (const size of [
  { width: 320, height: 568 },
  { width: 375, height: 667 },
]) {
  test(`the clip's side column fits at ${size.width} by ${size.height}`, async ({ page }) => {
    await signUp(page);
    await page.setViewportSize(size);
    await page.goto("/");
    await pageHasSettled(page);
    const clip = page.locator('section[data-current="true"]');
    await expect(clip).toBeAttached();
    const boxes: { name: string; x: number; y: number; width: number; height: number }[] = [];
    for (const name of [...NAMES, "Sound"]) {
      const button = (name === "Sound" ? page : clip).getByRole("button", { name, exact: true }).first();
      await expect(button, name).toBeVisible();
      const box = await button.boundingBox();
      expect(box, name).not.toBeNull();
      if (box === null) continue;
      boxes.push({ name, ...box });
      expect(box.width, `${name} width`).toBeGreaterThanOrEqual(48);
      expect(box.height, `${name} height`).toBeGreaterThanOrEqual(48);
      expect(box.x, `${name} left`).toBeGreaterThanOrEqual(0);
      expect(box.y, `${name} top`).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, `${name} right`).toBeLessThanOrEqual(size.width + 0.5);
      expect(box.y + box.height, `${name} bottom`).toBeLessThanOrEqual(size.height + 0.5);
    }
    const bar = await page.getByRole("navigation", { name: "Ruken" }).boundingBox();
    for (const [i, a] of boxes.entries()) {
      for (const b of boxes.slice(i + 1)) {
        const overlaps = a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
        expect(overlaps, `${a.name} overlaps ${b.name}`).toBe(false);
      }
      if (bar !== null && a.name !== "Sound") {
        expect(a.y + a.height, `${a.name} above the bar`).toBeLessThanOrEqual(bar.y + 0.5);
      }
    }
    const scroll = await page.evaluate(() => ({
      page: document.scrollingElement!.scrollHeight - window.innerHeight,
      wide: document.scrollingElement!.scrollWidth - window.innerWidth,
    }));
    expect(scroll).toEqual({ page: 0, wide: 0 });
    console.log(`${test.info().project.name} ${size.width}x${size.height}`, JSON.stringify(boxes), "bar", JSON.stringify(bar));
  });
}
```
