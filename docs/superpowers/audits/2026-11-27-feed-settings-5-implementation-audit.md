# Feed settings, implementation audit 5 (lane 3)

Reviewer: fresh session, Opus 5.5 medium. Commit examined: `eba51c9d68be1a27f9026994662317fcec38408d` (PR #405). Written 2026-11-27 04:14 UTC.

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## Verdict: PASS (no red)

R5 and R6 from audit 4 are fixed. D1 to D7 and the earlier rounds' criteria still hold. Merge is still blocked by things outside this verdict (see "Before it can merge").

## What ran

- Browsers from the Playwright docker image `mcr.microsoft.com/playwright:v1.63.0-noble` (run-server, WebKit 2359 included), app and stand-ins on the host, the repo's `playwright.config.ts` with only `globalSetup` dropped and `connectOptions` added (the warm-up launches a local WebKit, which the container lacks). Phone is the iPhone SE in WebKit, tablet the iPad in Chromium, computer Desktop Chrome at 1280x720.
- `tests/browser/fits-the-screen.test.ts` and `tests/browser/your-feed.test.ts` on all three, plus the probe `2026-11-27-feed-settings-5-probe.test.ts.txt`: 39 passed, 6 skipped (the skips are the journeys' own `test.skip`s and the probe's Chromium-only touch test on two profiles), exit 0.
- The probe adds every mood (12) on "more" and every kind of game (11) on "less" through Add, one at a time, and after each checks the new chip's × is inside the box and clear of the fade.

## Findings checked

| Item | Result | Evidence |
| --- | --- | --- |
| R5: a chip added through Add lands in view | PASS | Probe: 23 adds per profile, every one "in" on phone (WebKit), tablet and computer. `showNewChip` scrolls to the chip after `tick()`. |
| R6: a mouse wheel scrolls the chips at 1280x720 | PASS | Probe at 1280x720: box scrollTop 0 → 239 (its maximum, 536-297) after one wheel of 400 over the "less" side; page overflow 0. |
| No page scroll, 375x667 | PASS | Phone WebKit with all 23 chips: page 0, view 0, box 928 tall in a 256 view; Start over's bottom 567 above the bar's top 595. |
| No page scroll, 1280x720 and 1280x600 | PASS | page 0, view 0 at both; foot bottom 620 < bar 648, and 500 < 528. |
| Buttons at least 48px | PASS | No button or link in `main` under 48x48 on any profile, empty or full. |
| Keyboard | PASS | Journey's Tab walk reaches every × in view; probe focuses the last chip (Other) from the top and it scrolls into the box; Enter on it removes it. Focus ring draws fully (phone shot). |
| Touch | PASS (Chromium only) | Chromium touch emulation at 375x667: a finger drag scrolled the box 173px, page 0. WebKit touch can't be synthesised by Playwright; WebKit's box has `overflow-y: auto` and scrolls by script and focus. |
| Gamepad | Not testable today | The site has no gamepad layer (only `src/features/play/` mentions it); the owner has it queued as its own site-wide piece. The box is reachable by moving focus, which is what that layer will drive. Not a red against this PR. |
| D1-D7 | Hold | `your-feed.test.ts` 18 of 18 (6 journeys x 3 profiles), CRUD unchanged since audit 4. |
| Diff since audit 4 | Only `YourFeed.svelte`, `fits-the-screen.test.ts`, `progress.md` | `git diff 3ea9010 eba51c9 --stat`. |

## Before it can merge (not findings against the code)

- The branch conflicts with `main` in 8 files (`git merge-tree origin/main eba51c9`: progress.md, accounts/deletion.ts, feed/Feed.svelte, feed/feed.ts, feed/services.ts, routes/+page.server.ts, tests/browser/support/database.ts, purge.pg.test.ts). Because of that GitHub ran no CI (`ci.yml`) on eba51c9 or 3ea9010; only `pr-rules` ran. The builder merges `main`, CI goes green, and the merge head gets a fresh review, since Feed.svelte and the purge change on both sides.

## Notes (not blocking)

1. When the box is scrolled down, its top edge cuts a chip in half with no fade, and the side's heading ("What you want to see less of") is out of sight, so a chip's side is not shown (phone shot). A top fade, or headings that stay put, would fix both.
2. After a chip is removed by keyboard, focus falls to the page, not to the next chip, so a keyboard (and later a gamepad) user starts over from the top. This was already so before this round.
3. The wheel check in `fits-the-screen.test.ts` hovers the "more" region only; the probe shows the "less" side works too.
