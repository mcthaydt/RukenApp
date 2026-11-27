# Feed settings: implementation audit 3 (lane 3)

- Pull request: #405, branch `claude/project-thread-eij1zi`
- Commit examined: `542ea9ddbb4f8b9d71e51f41f12fcac9e43cfff2`
- Spec: `docs/superpowers/specs/2026-11-22-learned-feed-design.md`, unit D (D1 to D7), screen 6.2
- Round 2: `2026-11-27-feed-settings-2-implementation-audit.md` (FAIL at `91a9502`, R3), on branch `claude/project-thread-nagqi8`
- Auditor: Opus 5.5, medium. Written 2026-11-27 02:50 UTC.

**Verdict: FAIL, 1 red, 3 notes.**

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## What ran

| Check | Result |
|---|---|
| `pnpm lint` | exit 0 |
| `pnpm typecheck` | exit 0, 0 errors, 0 warnings |
| `pnpm test` | 157 files, 2255 tests passed |
| `pnpm test:pg` on `taste.pg.test.ts` and `purge.pg.test.ts` (local Postgres 16) | 26 passed. The fix commit (`91a9502..542ea9d`) touches only `YourFeed.svelte`, `fits-the-screen.test.ts` and `progress.md`, so round 1's full Postgres run still covers the server. |
| Journeys in the Playwright 1.63 image (`mcr.microsoft.com/playwright:v1.63.0-noble`; phone = iPhone SE (3rd gen) in **WebKit**, as in CI): `fits-the-screen`, `your-feed`, `me`, `look-layout`, `feed-controls`, plus round 2's probe, on phone, tablet and computer | **233 passed, 4 skipped, 0 failed** |
| CI on the head (run 45928160524, quick draft run) | every job green, gate green |
| Probe 2 (scratch, not committed; below): Your feed at 375×667 on the phone (WebKit) with four chip sets | below |

## Round 2's finding

- **R3 (Your feed with the 6.2 sketch's chips): fixed for that exact set.** With Cosy, Puzzle, Spooky more and Racing and sports less, the view does not scroll (0) on all three devices, and Start over ends at 535 px with the bar's top at 595 px (screenshot `2026-11-27-feed-settings-3/your-feed-sketch-chips-phone-375x667.png`). The new check in `fits-the-screen.test.ts` adds those chips through the page's own Add sheet and asserts view 0, the view above the bar, and Start over and Back in the viewport; it passes on all three devices. Back as an icon (`aria-label` "Back to your account", 48×48) follows the icon rule in `this-repo`.

## Red

- **R4.** UNIT: `src/features/feed/YourFeed.svelte`, `tests/browser/fits-the-screen.test.ts`. VERDICT: red. REQUIREMENT: the Owner's rule (2026-11-24 00:18 UTC) that in-app screens fit the view with no page scrolling; round 2's R3 REASON (Start over hidden under the bar once a person keeps a few chips). REASON: the fix fits the one chip set the test adds, not the screen. The same number of chips with other words, or one more chip, scrolls the view again, and with one more "less" chip Start over and Back sit under the bar. EVIDENCE: probe 2, phone (WebKit) at 375×667, `document.body.scrollHeight - clientHeight` and the bottom of Start over (bar top 595):

  | Chips kept | View scroll | Start over bottom | Start over's centre |
  |---|---|---|---|
  | Cosy, Puzzle, Spooky more; Racing and sports less (the sketch, the test's set) | 0 | 535 | pressable |
  | Puzzle, Spooky, Racing and sports more; Cosy less (same count, words swapped) | **24 px** | 591 | pressable |
  | Cosy, Puzzle, Spooky, Clever more; Racing and sports less | **24 px** | 591 | pressable |
  | Cosy, Puzzle, Spooky more; Racing and sports, Bold less | **80 px** | **647** | **covered by the bar** |

  Round 2's probe, re-run with two more steps, agrees on all three devices (24 px, then 80 px with five more and two less). Screenshot `2026-11-27-feed-settings-3/your-feed-3-more-2-less-phone-375x667.png`: the less side's second row (Bold, Add) is the last thing above the bar, and Back and Start over are under it. The chips are what a person makes on this page, and the spec's sketch also has a maker chip (`@maker`), whose words are a maker's name of any length, so the count and width are not bounded by the layout.
  EXPECTED: at 375×667 Your feed does not scroll and Start over and Back are in the viewport above the bar for any number of chips a person keeps, not only for the sketch's set.
  FIX: bound the height the chips take, whatever their number (round 2's suggestion: each side one row that slides sideways with no scrollbar, Add fixed at its end; or a fixed number of chips per side with the rest behind a "See all" sheet), and change the new check in `fits-the-screen.test.ts` to add enough chips to wrap several lines on both sides (for example every mood on the more side and two genres on the less side) before asserting view 0 and Start over and Back in the viewport. Files: `YourFeed.svelte`, `fits-the-screen.test.ts`, and `your-feed.test.ts` only if a journey step moves.

## D1 to D7

Re-read against the head (`taste.ts`, the two `/api/feed/*` routes, `settings/feed/+page.server.ts`, `consent/routes.ts`, `+page.server.ts`, `Feed.svelte`), and the journeys and Postgres tests above pass:

- **D1**: `FeedTaste`, `GoodPickAsked`, `User.feedPersonal` (default true), `User.feedResetAt`; unchanged since round 2, `taste.pg.test.ts` passes.
- **D2**: `aboutGame` writes a `game` row only for a live game that is not one's own (403 own, 404 not live); unchanged.
- **D3**: chips, suggestions and Add; × deletes only the person's own row (`deleteMany where id, userId`); Start over deletes `FeedTaste` and `GoodPickAsked` and sets `feedResetAt` in one transaction. `ClipView` does not exist yet (unit B), as the PR body says. The fix commit changes how many suggestions show (note N1).
- **D4**: `asking` records the ask once (`createMany skipDuplicates`, count 1); `answer` only answers an unanswered ask; Yes/No keep a game chip in place of the mood the spec names, since games have no mood until unit C, stated in the code and the PR body.
- **D5**: `your-feed.test.ts` passes on all three devices (CRUD, second account).
- **D6**: off makes the viewer crowd and refuses new chips (409); on again calls `forget`; under 18 or unknown age is `locked` (403 on the switch).
- **D7**: `/settings`, `/api/feed/taste` and `/api/feed/good-pick` are in `GATED`; the feed's `tune` is false for anyone not signed in, so the ••• button is hidden without consent.

## Notes (not blocking)

- **N1.** The fix shows one suggestion once three or more chips are kept on the more side. The 6.2 sketch shows two suggestions beside three chips (`[+ Clever] [+ Story]`). It reads as a layout trade, not a requirement gap, and becomes moot if R4's fix bounds the rows; recorded for the owner's screens look.
- **N2.** At 320×568 Your feed scrolls even when empty (31 px phone, 87 px tablet and computer) and 199 px with the sketch's chips. Outside the device matrix (the small phone is 375 wide) and the PR's criterion, as round 2's N3 said.
- **N3.** No `feed-controls` flake in this run (it passed on all three devices); the two lines the PR added under Flaky tests stand.

## Probe 2

```ts
import { test } from "@playwright/test";
import { pageHasSettled, signUp } from "./support/account.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

test.beforeEach(forgetRateLimits);

async function add(page: import("@playwright/test").Page, d: string, k: string, v: string) {
  return page.evaluate(async ([d, k, v]) => {
    const form = new FormData();
    form.set("direction", d); form.set("kind", k); form.set("value", v);
    const r = await fetch("/settings/feed?/add", { method: "POST", body: form, headers: { "x-sveltekit-action": "true" } });
    return r.status;
  }, [d, k, v]);
}

const sets: Record<string, [string, string, string][]> = {
  sketch: [["more", "mood", "cosy"], ["more", "genre", "puzzle"], ["more", "mood", "spooky"], ["less", "genre", "racing_sports"]],
  swapped: [["more", "genre", "puzzle"], ["more", "mood", "spooky"], ["more", "genre", "racing_sports"], ["less", "mood", "cosy"]],
  fourOne: [["more", "mood", "cosy"], ["more", "genre", "puzzle"], ["more", "mood", "spooky"], ["more", "mood", "clever"], ["less", "genre", "racing_sports"]],
  threeTwo: [["more", "mood", "cosy"], ["more", "genre", "puzzle"], ["more", "mood", "spooky"], ["less", "genre", "racing_sports"], ["less", "mood", "bold"]],
};
for (const [name, rows] of Object.entries(sets)) {
  test(`probe2 ${name}`, async ({ page }, info) => {
    await signUp(page);
    await page.setViewportSize({ width: 375, height: 667 });
    for (const [d, k, v] of rows) await add(page, d, k, v);
    await page.goto("/settings/feed");
    await pageHasSettled(page);
    const view = await page.evaluate(() => document.body.scrollHeight - document.body.clientHeight);
    const so = await page.getByRole("button", { name: "Start over" }).boundingBox();
    const inView = await page.getByRole("button", { name: "Start over" }).evaluate((el) => {
      const r = el.getBoundingClientRect(); const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return hit === el || el.contains(hit) ? "hit" : `covered by ${hit?.closest("nav,[class]")?.tagName}.${(hit as HTMLElement | null)?.className ?? ""}`;
    });
    await page.screenshot({ path: `/w/scratch-shots/${name}-${info.project.name}-375x667.png` });
    console.log(`PROBE2 ${info.project.name} ${info.project.use.browserName} ${name} view=${view} startOverBottom=${so ? so.y + so.height : null} centre=${inView}`);
  });
}
```
