# Plain pages and corners, implementation audit 2 (PR #413)

Commit examined: e21273a0dbba9f35906105f6dd8d9cf55774e5ec (includes main at 577d17e). Lane 2, review round 2.
Reviewer: Opus 5.5, medium. Written 2026-11-27 09:47 UTC.

Verdict: **e21273a PASS.**

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## What ran

- `pnpm lint` exit 0. `pnpm test`: 161 files, 2,304 tests passed. `pnpm typecheck` exit 0 (the first run failed only on `.svelte-kit/output` left by local Playwright builds; it passed once that folder was cleared).
- Browser journeys at e21273a, 14 files (plain-pages, corners, glass, bar, feed-to-game-grow, fits-the-screen, page-moves, join-and-help-look, report-a-game, scrollbar, test-play, make-live-changes, about, feed-top):
  - computer and tablet (Chromium): 242 passed, 4 skipped, 0 failed.
  - phone (WebKit 26, Playwright's `v1.63.0-noble` image held to 1.5 CPUs, warmed by the PR's own `warm-webkit.ts` through a connect wrapper): 121 passed, 1 skipped, 1 failed (see below).
- A first-frame timing comparison of main and the PR on cold WebKit, and held frames of the moves between pages, using scratch scripts that were not committed.
- Draft CI run 45970287683 on e21273a: green.

## Review 1's reds

1. Corner check: fixed. Patch 2x2 (`feed-to-game-grow.test.ts`), named under "Changed tests" with the square-corner failure it still catches. It passes on computer, tablet and phone.
2. /about's cookie notice: fixed. `<MovingBehind />` sits in `.wall`, which renders only when there are clips. `plain-pages.test.ts` checks that the notice blurs while the wall is shown, and it passes on all three profiles.
3. PR body: its last line is now "Requested by **McThayDT**", with no footer.

## New since review 1

- **`:root:not([data-glass])`, the head meta and the line in app.html.** The server-sent HTML has `<meta name="glass">` on `/`, `/about` and `/g/<game>`, and not on `/sign-in` or `/search`. `<html>` already carries `data-glass` at DOMContentLoaded on the feed (computer and phone), so the first frame is glass. Inside the app, Your games has no mark after the move. Going from the feed to a game's page and Back, a MutationObserver saw the mark drop 0 times. The counter in `moving-behind.svelte` covers a new screen mounting before the old one unmounts. `$effect` does not run on the server, so the module-level counter is never touched there.
- **Pages.** Followed now plays clips through `Feed` (marked), and its empty states are plain. Your feed settings (`/settings/feed`, `YourFeed.svelte`'s sheet) is a plain page, so its sheet draws solid, which fits the rule. TasteSheet only opens over the feed, so it stays glass.
- **Moves between pages.** I held frames at 10%, 50% and 90% of feed to Your games and of Your games to Home, on phone WebKit. The bar fades out mid-move and comes back. Main does exactly the same in the same setup (frames compared side by side), so the PR adds nothing there.
- **New journey.** `plain-pages.test.ts`'s "moving between the feed and a plain page inside the app" passes on all three profiles.
- **warm-webkit.ts.** It draws plain, then glass, and checks the bar's blur each time. Warm-up took 3.1 to 3.6s here.

## The feed's first frame on cold WebKit (asked to judge)

This is not a product regression, so it does not block. The probe is a fresh container per run (cold Mesa cache), 1.5 CPUs, one phone page opening `/`. It measures load to the clip being visible, then two drawn frames, then a trial press.

| Warm-up | main 5825548 | PR e21273a |
| --- | --- | --- |
| none (fully cold) | 4.80s, 4.24s | 4.81s, 4.32s |
| each branch's own | 2.54s, 2.54s | 3.18s, 2.75s |

With no warm-up the two are the same, so the feed draws no slower. The gap only appears after each branch's own warm-up. That is a difference in the test harness's shader cache, and a phone's GPU has no such cache to warm. The PR's worst case (3.2s) still clears the 5-second press wait, and the draft CI phone shards passed.

## Failure seen, not from this PR

- `feed-to-game-grow.test.ts` "a picture that comes late from an earlier Back does not end the wait of the next Back" (phone, 1.5 CPUs): it fails 3 of 4 on main 5825548 and 4 of 4 on the PR. The failure is the same ("the first Back's picture came before the second Back began"). This is a timing race on a slow WebKit, and it happens on main. It belongs under "Flaky tests" in progress.md and needs its own fix. It does not count against this PR.

## Checked and holding

48px buttons, no page scroll, the focus ring and contrast are unchanged since review 1, and fits-the-screen, scrollbar, bar and glass pass on all profiles. The corners are 20/14/12/8/4 with superellipse(1.4). The reduced-transparency gap is unchanged and does not block (see audit 1). Removing `:has()` also takes away the old-browser fallback question.

## Notes (not blocking)

- `.claude/skills/this-repo/SKILL.md`'s glass paragraph still does not say that a moving surface must place `<MovingBehind />`. Carried over from audit 1, and worth one sentence in a follow-up.
- PR body, "Not changed": the other `:root:not(:has(...))` rules in look.css were not measured for Safari's first frame. That remains a follow-up.
