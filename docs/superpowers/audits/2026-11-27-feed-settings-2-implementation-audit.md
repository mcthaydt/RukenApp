# Feed settings: implementation audit 2 (lane 3)

- Pull request: #405, branch `claude/project-thread-eij1zi`
- Commit examined: `91a95020a129faedc5b0ed0945c5186368e2723c`
- Spec: `docs/superpowers/specs/2026-11-22-learned-feed-design.md`, unit D (D1 to D7), screen 6.2
- Round 1: `2026-11-27-feed-settings-1-implementation-audit.md` (FAIL at `45ced1c`, R1 and R2)
- Auditor: Opus 5.5, medium. Written 2026-11-27 02:15 UTC.

**Verdict: FAIL, 1 red, 3 notes.**

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## What ran

| Check | Result |
|---|---|
| `pnpm lint` | exit 0 |
| `pnpm typecheck` | exit 0 |
| `pnpm test` | 157 files, 2255 tests passed |
| `pnpm test:pg` on `taste.pg.test.ts` and `purge.pg.test.ts` (local Postgres 16) | 26 passed. The fix commit touches no server code, so round 1's full Postgres run (801 passed) still covers the rest. |
| Journeys in the Playwright 1.63 image (`mcr.microsoft.com/playwright:v1.63.0-noble`, so the phone ran in **WebKit**, as in CI): `fits-the-screen`, `look-layout`, `your-feed`, `me`, `feed-controls`, plus the probe below, on phone, tablet and computer | 232 passed, 4 skipped, **1 failed**: `feed-controls.test.ts:438` [phone] (note N1) |
| `feed-controls.test.ts:293` and `:438`, phone (WebKit), `--repeat-each 15` | 30 of 30 passed |
| CI quick run 45925809376 on the head | every job green, gate green |
| Probe (scratch, not committed; text below): Your feed at 375×667 and 320×568, empty and with three "more" chips and one "less" chip | below |

Probe, `document.body.scrollHeight - clientHeight` (the view; the page itself was 0 everywhere):

| Size | Empty | Cosy, Puzzle, Spooky more; Racing and sports less |
|---|---|---|
| 375×667, phone (WebKit), tablet and computer | 0 | **100 px** |
| 320×568 | 99 px (WebKit), 155 px (Chromium) | 267 px |

## Round 1's findings

- **R1 (Your account fits): fixed.** `fits-the-screen.test.ts:79` and `:98` pass on phone (WebKit), tablet and computer, locally and in CI. The new `look.css` rules are scoped to `.card:has(.side-by-side) .sidelinks`, which only `src/routes/me/+page.svelte` has (grep of `src/`), so no other screen moves. The changed `look-layout` test still holds every link to 44 px, reading order, and Sign out under the lowest link; it loosens only "under" to "under or beside", which the PR body names. Accepted.
- **R2 (Your feed fits an iPhone SE): fixed only for the empty page.** `/settings/feed` is now in the fit loop and a 375×667 check, and the empty page fits (probe: 0). With chips it does not: see red R3.

## Red

- **R3.** UNIT: `src/features/feed/YourFeed.svelte`, `tests/browser/fits-the-screen.test.ts`. VERDICT: red. REQUIREMENT: the Owner's rule (2026-11-24 00:18 UTC) that in-app screens fit the view with no page scrolling; the PR's own criterion "Your feed fits 375 by 667 with Start over above the bar"; round 1's R2 (which measured the page with chips too: 457 px). REASON: with the chips the spec's own 6.2 sketch shows (three on the more side, one on the less side), the page runs 100 px under the bar on an iPhone SE, and Start over and "Back to your account" are hidden under it. The fit check only looks at a new account, whose sides are empty. EVIDENCE: probe above, same on all three devices; screenshot `2026-11-27-feed-settings-2/your-feed-4-chips-phone-375x667.png`: Start over cut by the bar at 375×667 in WebKit with Cosy, Puzzle, Spooky, + Bold, + Clever, Add / Racing and sports, Add. EXPECTED: at 375×667, with the 6.2 sketch's chips (three more, one less) and the suggestions the page offers, the view does not scroll and Start over is in the viewport above the bar. FIX: lay out the chips so that state fits (for example one line per side that slides sideways with no scrollbar, or tighter chips), and extend the 375×667 check in `fits-the-screen.test.ts` to add those chips first (through the page's own Add, or `/settings/feed?/add`) and then assert view 0 and Start over in the viewport. Files: `YourFeed.svelte`, `fits-the-screen.test.ts` (and `your-feed.test.ts` only if a journey step moves).

## D1 to D7

Rechecked against the head. The fix commit changes only `YourFeed.svelte`'s layout, `look.css`, and three journeys: Start over still shows only while learning is on (it moved out of the `{:else}` block into `{#if feed.learning === "on"}`, the same condition); Add moved into the chip row as the 6.2 sketch has it; "Nothing yet." under an empty less side was removed (the spec does not ask for it). D1 to D7 otherwise stand as round 1 found them, and the CRUD journey `your-feed.test.ts` passes on all three devices.

## Notes (not blocking)

- **N1. `feed-controls.test.ts:438` [phone] failed once** in the whole-file run here (line 447, the fourth clip stayed `data-current="false"` for 15 s), then passed 15 of 15 alone. It is already in progress.md's Flaky tests, from #394 [computer], with the same line and symptom; this PR's ••• button and Good pick card are not on that path for a signed-out viewer (`tune` is false, `ask` undefined). It needs its own line under Flaky tests (WebKit phone, this run, Playwright image locally).
- **N2. Round 1's WebKit `feed-controls.test.ts:293` failure** (run 45922092165 attempt 1): not reproduced. It passed in the whole-file run here and 15 of 15 alone in WebKit, and CI's shard runs on this head are green. The failure looks like the same timing family as the known `feed-controls` flakes; it should be recorded under Flaky tests too.
- **N3.** At 320×568 the empty Your feed scrolls 99 px in WebKit; only `/me` is checked at that size, and the device matrix's small phone is 375 wide, so this is outside the criterion. Round 1's other notes (the Good pick card not drawn by any test until unit A; no `/settings` index) still stand.

## Probe

```ts
import { expect, test, type Page } from "@playwright/test";
import { pageHasSettled, signUp } from "./support/account.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

test.beforeEach(forgetRateLimits);

async function overflow(page: Page) {
  return page.evaluate(() => ({
    page: document.documentElement.scrollHeight - innerHeight,
    view: document.body.scrollHeight - document.body.clientHeight,
  }));
}

async function add(page: Page, direction: string, kind: string, value: string) {
  const status = await page.evaluate(
    async ([d, k, v]) => {
      const form = new FormData();
      form.set("direction", d);
      form.set("kind", k);
      form.set("value", v);
      const r = await fetch("/settings/feed?/add", { method: "POST", body: form, headers: { "x-sveltekit-action": "true" } });
      return `${r.status} ${await r.text()}`;
    },
    [direction, kind, value],
  );
  return status;
}

for (const size of [
  { width: 375, height: 667 },
  { width: 320, height: 568 },
]) {
  test(`Your feed with chips at ${size.width}x${size.height}`, async ({ page }, info) => {
    await signUp(page);
    await page.setViewportSize(size);
    await page.goto("/settings/feed");
    await pageHasSettled(page);
    const empty = await overflow(page);
    const out: string[] = [];
    for (const [d, k, v] of [
      ["more", "mood", "cosy"],
      ["more", "genre", "puzzle"],
      ["more", "mood", "spooky"],
      ["less", "genre", "racing_sports"],
    ])
      out.push(await add(page, d, k, v));
    await page.goto("/settings/feed");
    await pageHasSettled(page);
    const four = await overflow(page);
    const startOver = await page.getByRole("button", { name: "Start over" }).isVisible();
    await page.screenshot({ path: `${info.outputDir}/probe-${size.width}.png` });
    console.log(`PROBE ${info.project.name} ${size.width}x${size.height} empty=${JSON.stringify(empty)} fourChips=${JSON.stringify(four)} adds=${out.map((s) => s.slice(0, 3)).join(",")} startOverVisible=${startOver}`);
    expect(out.every((s) => s.startsWith("200"))).toBe(true);
  });
}
```
