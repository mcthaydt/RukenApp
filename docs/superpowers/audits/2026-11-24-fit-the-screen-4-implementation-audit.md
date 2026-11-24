# Fit the screen (PR #379): implementation audit, cycle 4

Reviewed commit: `021a15da1143465ecaf58b72aa72ef134546518d` (branch `claude/project-thread-q2xy7t`).
Reviewer: a fresh session, Opus 5.5, medium. Lane 2.
Written 2026-11-24 04:23 UTC.

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## Verdict

**FAIL: 1 red.** Round 3's red is fixed: the only change since `8d50a58` is `tests/browser/look-layout.test.ts` (8 lines in, 2 out), the new check is sound, and it passes on phone WebKit. But the PR's CI is red: `panels-feel-like-an-app.test.ts:117` fails on phone, because the PR now sets `overflow: hidden` on the page root of every screen but the landing page, and that journey still expects a reading screen's page root to be `visible`. It passes on main and fails on this head, in CI and locally.

## What ran

- Diff `8d50a58..021a15d`: one file, `tests/browser/look-layout.test.ts`. The PR body names the changed test and why.
- All in the Playwright v1.63.0 docker image (by digest, as CI), WebKit for phone, Postgres 16, on `021a15d`:
  - Phone `look-layout`, `fits-the-screen`, `me`, `delete-account`: 47 passed.
  - Mutation, Delete given `margin-left:-30px` (same row, overlapping): the check fails, gap -22, wanted >= 8.
  - Mutation, Delete given `position:relative; top:10px` (different rows, overlapping): the check fails, y 421.48, wanted >= 459.48.
  - Whole phone project, 4 workers: 739 passed, 30 skipped, 4 failed: `panels-feel-like-an-app:117` (the red), and `money-job:48`, `money-job:54`, `purge-job:39`. The three job journeys fail the same way on main `e2a9d8f` against the same local database, so they are this machine's leftover data, not the PR (purge-job:39 is already in the flaky list).
  - Phone `panels-feel-like-an-app`: on `021a15d` 3 passed, 1 failed; on main `e2a9d8f` 4 passed.
- CI on `021a15d` (draft, quick): pr-rules, commit-authors, postgres, verify green; browser shard 2 failed (job 138203853063) on `panels-feel-like-an-app:117`, and fail-fast cancelled the other five shards; gate failed.

## Red findings

### Red 1: a reading screen's page root is now hidden, and its journey fails

- UNIT: `src/lib/look.css` (`:root:not(:has(main.about))`) and `tests/browser/panels-feel-like-an-app.test.ts:117`.
- VERDICT: red.
- REQUIREMENT: CI green; an existing journey changed by the PR is named in its body with why (`review`, `build`).
- REASON: the PR makes every screen but the landing page scroll inside `body` with `html { overflow: hidden }`, but `panels-feel-like-an-app:117` still asserts `html` overflow is `visible` on `/help/get-your-game-on-ruken`.
- EVIDENCE: CI job 138203853063 and local WebKit: `expect(rules.pageOverflow).toBe("visible")`, received `"hidden"` (line 146). Passes on main `e2a9d8f`.
- EXPECTED: the journey checks what its comment protects on the layout this PR chose: a reading screen still scrolls (now inside its view) and still pinch-zooms, with no double-tap zoom and no bounce.
- FIX: update the assertion to the new scroller (for example `html` overflow `hidden` with `body` `overflow-y: auto`, and the help page's view actually scrolls), keep the other assertions, and name the changed test and why in the PR body. If the help pages are meant to be web pages like the landing page, exclude them in `look.css` instead; that is the implementer's call within the owner's 2026-11-24 rule. Files: `tests/browser/panels-feel-like-an-app.test.ts` (or `src/lib/look.css`), the PR body.

## Notes

- With fail-fast, the draft CI only shows the first failing shard. The local whole phone run found no other red; tablet and computer were not run here.
