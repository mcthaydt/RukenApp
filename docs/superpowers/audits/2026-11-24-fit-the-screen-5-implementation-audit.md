# Fit the screen (PR #379): implementation audit, cycle 5

Reviewed commit: `adc39f829bf33b446235efc91c3b7e0c58f9abfc` (branch `claude/project-thread-q2xy7t`).
Reviewer: a fresh session, Opus 5.5, medium. Lane 2.
Written 2026-11-24 05:24 UTC.

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## Verdict

**FAIL: 1 red.** Round 4's red is fixed and the fix is sound. But CI shard 1 is red on `fits-the-screen.test.ts:98` on computer: a member's Your account at 1280 by 720 runs 98px past its view. It reproduces on this commit alone, so it is this PR, not main's newer commits.

## What ran

- Diff `021a15d..adc39f8`: one file, `tests/browser/panels-feel-like-an-app.test.ts` (10 in, 2 out). Test-only.
- All in the Playwright v1.63.0 docker image (by digest, as CI), Postgres 16 in a fresh container, on `adc39f8`:
  - Phone `panels-feel-like-an-app`: 4 passed.
  - Mutation: `overflow: visible !important` added to `:root:not(:has(main.about))` in `src/lib/look.css`: `panels-feel-like-an-app:117` fails (`Expected: "hidden"`, `Received: "visible"`, line 148). The check fails by itself.
  - Probe, phone (iPhone SE, 375 by 667), each of `/help`, `/help/get-your-game-on-ruken`, `/help/github`, `/help/how-the-feed-works`, `/help/record-screen`, `/terms`, `/privacy`: the view runs 839 to 9852px long, the page 0. Pressing End scrolls the view to its end (`body.scrollTop` = its maximum), `scrollY` and `documentElement.scrollTop` stay 0, and the last line ends at 555 to 581, above the bar's top at 595. (Mobile WebKit has no wheel, so the key stands in for a swipe; the view takes the keys.) 7 passed. The probe was not committed.
  - Whole phone project, 4 workers: 742 passed, 30 skipped, 1 failed: `adults-only:289` ("no code waiting for +1…", support/texts.ts:66). It passed on rerun on phone, tablet and computer; it is the known sign-up text-code flake class in progress.md. The job journeys passed on this fresh database.
  - Whole tablet and computer projects, 4 workers: 1400 passed, 139 skipped, 7 failed: `fits-the-screen:98` on computer (the red), and `money-job:48`, `money-job:54`, `purge-job:39` on both, which the coordinator reports fail on main locally too (leftover data in a database reused across runs).
- CI on `adc39f8` (run 45326395448, draft, quick): pr-rules, commit-authors, postgres, verify green; browser shard 1 failed (job 138216906990) on `[computer] fits-the-screen:98`; fail-fast cancelled shards 2 to 6. The local full run above covers what they would have run.

## Red findings

### Red 1: a member's Your account does not fit a 1280 by 720 computer window

- UNIT: `src/routes/me/+page.svelte` and its rules in `src/lib/look.css` (wide layout), or `tests/browser/fits-the-screen.test.ts:98`.
- VERDICT: red.
- REQUIREMENT: CI green; the PR's own criterion, checked by `fits-the-screen.test.ts:98`, that a member's Your account fits the window it is opened in with nothing to scroll.
- REASON: on the computer profile the member's card is taller than the view, so Sign out and Delete my account sit below the fold.
- EVIDENCE: CI job 138216906990 and locally on `adc39f8`: `a member's /me at 1280 by 720`, `Expected: 0`, `Received: 98` (line 108). Probe at 1280 by 720: view (body) 0 to 640, scrollHeight 738; header 48 to 96; card 120 to 730 (margin 24px 320px 8px); bar 648 to 708; Delete my account 650 to 698. Screenshot: What is Ruken? is the last line in view; Sign out and Delete my account are below. Phone and tablet pass.
- EXPECTED: at 1280 by 720 the member's account fits its view, as at 375 by 667 and on tablet, with Sign out and Delete my account in view above the bar.
- FIX: make the member's account fit a short wide window (for example tighter top space above the card, or the links side by side, on wide screens), without changing the phone layout. If instead the PR chooses to let it scroll in its view there, as it already does at 320 by 568, change the loop to match and name the changed test and why in the PR body. The first fits the PR's criterion better. Files: `src/lib/look.css` (or the /me page), or `tests/browser/fits-the-screen.test.ts`, and the PR body.

## Notes

- Earlier rounds ran only the phone project in full; this is the first full tablet and computer run on this PR. Nothing else on tablet or computer is red.
- `adults-only:289` failed once with "no code waiting" and passed on rerun: record under Flaky tests in progress.md (a new line for this test, same class as the sign-up text-code timeout).
- Main has moved to `86dff0d` (video stills #380) since this branch's base `e2a9d8f`; CI tested the merge, and the red reproduces without it.
