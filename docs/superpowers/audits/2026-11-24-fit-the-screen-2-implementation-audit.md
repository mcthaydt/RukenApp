# Fit the screen (PR #379): implementation audit, cycle 2

Reviewed commit: `fc59d78516f8652238ab9a68c8e6aced05ffe360` (branch `claude/project-thread-q2xy7t`, `main` `e2a9d8f` merged in).
Reviewer: a fresh session, Opus 5.5, medium. Lane 2 (`src/lib/`, `src/app.html`, `src/routes/+layout.svelte`, `playwright.config.ts`, `tests/browser/support/`).
Written 2026-11-24 03:00 UTC.

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## Verdict

**FAIL: 3 red.** Both round 1 findings are fixed and their checks fail without the fix. Three phone problems block it: a step screen's view runs under its pinned Back and Save (the 18+ answer can't be pressed, and a CI journey fails), Your games runs 3px past its view (a CI journey fails), and a member's Your account scrolls 114px at 375x667 and 117px at 320x568.

## What ran

- `fc59d78`, locally (cloud container; WebKit 26.6 for the phone project, Chromium for tablet and computer):
  - `fits-the-screen` and `scrollbar`, all three sizes: 19 passed, 4 skipped, 1 failed (phone, `fits-the-screen.test.ts:77`, red 2). Repeated 3 more times on phone: 3 of 3 failed the same way.
  - `join-and-help-look`, all three sizes: 48 passed.
  - The three phone journeys that failed in CI: `make-live-changes.test.ts:185` failed (red 1); `edit-page.test.ts:434` and `cookie-consent.test.ts:189` passed (CI's failures there look like knock-on or flakes, see notes).
- R1 check: `src/app.html` and `src/routes/+layout.svelte` put back to `b5d1ff4` with the new tests kept: `fits-the-screen.test.ts:99` and `scrollbar.test.ts:23` failed on all three sizes (6 failed, "Error: ArrowDown"). With the fix, they pass. The check fails by itself.
- `b5d1ff4` (before the fix commit): `make-live-changes.test.ts:185` failed on phone, and `fits-the-screen.test.ts:77` failed 3 of 3 on a repeat. `main` `e2a9d8f`: `make-live-changes.test.ts:185` passed. So red 1 and red 2 are from this PR, not from `main`; round 1 did not see them because the quick run cancels the other pieces after the first failure.
- Reviewer's probes (a throwaway journey, not committed): measured `/make`, `/me` as a member at 375x667 and 320x568, and the age step's view, pinned row and 18+ option at the end of its scroll.
- CI on `fc59d78`: `browser shard 3 of 6 (quick, draft)` (job 138179166691) and `browser shard 4 of 6 (quick, draft)` (job 138179166568) failed, the other four were cancelled, `gate (quick, draft)` failed. `verify`, `postgres`, `commit-authors` and `pr-rules` passed.
- Not run: the whole journey suite (only the files above); a real iPhone.

## Round 1 findings

- **R1, keys don't scroll until a click: fixed.** The body has `tabindex="-1"` and the layout focuses it in `afterNavigate` only when nothing else has the focus (`document.activeElement` is the body or null). The journeys press ArrowDown, PageDown, Space and End with no click, and again after an in-app move to `/terms`. Without the fix those journeys fail on all three sizes (above).
  - Focus is not stolen: SvelteKit's own `reset_focus` runs before the `afterNavigate` callbacks (`node_modules/@sveltejs/kit/src/runtime/client/client.js:2267`, then `:2279`), and a screen that focuses a field on mount (`src/lib/focus.ts`, the delete and take-down screens) has that field active by then, so the layout leaves it. SvelteKit itself puts the focus on the body after every move, so a screen reader gets nothing new; keeping `tabindex="-1"` adds no tab stop. `body:focus { outline: none }` hides a ring on something that is not a control.
- **R2, Join title under 44px on phone: fixed.** The 2.25rem step-down now applies only below 360 wide; all 48 `join-and-help-look` checks pass, phone included.
- **Your account (not a member) at 320x568: fits**, with a check (`fits-the-screen.test.ts:88`) that passes on phone.

## Red findings

### Red 1. A step screen's view runs under its pinned Back and Save

- UNIT: `src/lib/look.css:1445` (`--foot` for a step screen with a pinned row).
- VERDICT: red.
- REQUIREMENT: the PR's own rule (look.css 5589: the view "ends ... above a step's pinned Back and Save ... so neither ever covers what is on the screen"); the owner's "the bar never covers content"; the CI journey `make-live-changes.test.ts:185`.
- REASON: `--foot` is set on `:root` as `calc(var(--button) + ...)`, but `--button` is defined only on `.screen` (look.css 905, 937, 947), so on `:root` the value is invalid and `--foot` is empty. The body's height is then the whole window and the pinned row floats over the last lines.
- EVIDENCE: on `/make/<game>/age`, phone 375x667: `getComputedStyle(document.documentElement).getPropertyValue("--foot")` is `""` while `:root` matches the rule's selector; body bottom 667, pinned row top 583; scrolled to the end, the 18+ option runs 556 to 641, under Save (screenshot: 18+ and "Only for adults." behind Back and Save). `make-live-changes.test.ts:185` fails: "locator.check: Timeout ... `<button>Save</button>` ... intercepts pointer events", locally on `fc59d78` and `b5d1ff4`, and in CI job 138179166691; passes on `main`. Tablet and computer read `--foot` as `""` too.
- EXPECTED: on every step screen with a pinned row, the view ends above the row, and the last answer can be scrolled clear of it and pressed.
- FIX: give `--foot` a value that resolves on `:root` (for example define the `--button` sizes on `:root` with the same media steps, or write the step's foot from those sizes), and add a check in `tests/browser/fits-the-screen.test.ts`: on a step screen at phone size, the body's bottom is at or above the pinned row's top and the last option is in view after scrolling to the end. Files: `src/lib/look.css`, `tests/browser/fits-the-screen.test.ts`.

### Red 2. Your games runs 3px past its view on a phone

- UNIT: `/make` (Your games, no games yet), `src/lib/look.css`.
- VERDICT: red.
- REQUIREMENT: the PR's acceptance criterion and its own check, `fits-the-screen.test.ts:77` ("Your account and Your games fit the window").
- REASON: the last row (`p.ways` with Your page and Maker agreement) ends 3px below the view.
- EVIDENCE: `Error: /make ... "view": 3` on phone, 4 of 4 runs locally on `fc59d78`, 3 of 3 on `b5d1ff4`, and in CI job 138179166568. Probe: body bottom 587, `p.ways` 486 to 590, its `a.go` 542 to 590.
- EXPECTED: `view` is 0 on `/make` at 375x667.
- FIX: take at least 3px of air out of `/make`'s card on short phones (look.css only), so the check passes on phone. Files: `src/lib/look.css`.

### Red 3. A member's Your account scrolls

- UNIT: `/me` for a member, `src/lib/look.css` (and the check in `tests/browser/fits-the-screen.test.ts`).
- VERDICT: red (the coordinator's brief: "treat any inner scroll there as a red").
- REQUIREMENT: the owner, 2026-11-24 00:18 UTC: screens fit the view with no scrolling, scrolling within a view only where something must and rarely; the PR's "Your account fits"; the coordinator's 320x568 ask.
- REASON: a member's account has the membership line and Change card or cancel, and is taller than its view. The PR's check signs up a person who is not a member, so it never sees this.
- EVIDENCE: probe after `payAsNewMember`: at 375x667 the view runs 114px past (body bottom 587, the card 72 to 693; Sign out and Delete my account at 621 to 669, under the bar's line); at 320x568, 117px (body bottom 488, card 64 to 597). Screenshot at 320x568: Your computers is the last line in view; Sign out and Delete my account are below.
- EXPECTED: a member's Your account fits at 375x667 and 320x568 with `view` 0, and Delete my account is in view.
- FIX: tighten a member's account so it fits at both sizes, and add the member case to `fits-the-screen.test.ts` (using `payAsNewMember` from `tests/browser/support/account.ts`), at 375x667 and 320x568. Files: `src/lib/look.css` (and `src/routes/me/+page.svelte` only if the layout must change), `tests/browser/fits-the-screen.test.ts`.

## Notes (not blocking)

- CI's phone failures in `edit-page.test.ts:434` and `cookie-consent.test.ts:189` passed locally on `fc59d78`; they ran in the same shards as reds 1 and 2. If they fail again after the fixes, they go under "Flaky tests" in `progress.md`.
- Round 1's quick run hid reds 1 and 2 by cancelling the other pieces after the first failure: a fix round should read every failed piece, and a reviewer should run every touched journey on phone.
