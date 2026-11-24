# Fit the screen (PR #379): implementation audit, cycle 3

Reviewed commit: `8d50a588c2855f046e6d4952b20f4bad70a422dd` (branch `claude/project-thread-q2xy7t`).
Reviewer: a fresh session, Opus 5.5, medium. Lane 2.
Written 2026-11-24 03:45 UTC.

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## Verdict

**FAIL: 1 red.** All three round 2 reds are fixed. One existing phone journey fails: `look-layout.test.ts:113` still expects Delete my account under Sign out, but the PR puts them side by side. It fails in CI on this commit, locally in WebKit, and also on `fc59d78`, so it came with the side-by-side row, not with this round's fixes; round 2 never saw it because CI cancelled that piece.

## What ran

- All in the Playwright v1.63.0 docker image (WebKit for phone), Postgres 16, on `8d50a58`:
  - Phone: `fits-the-screen`, `scrollbar`, `make-live-changes`: 26 passed.
  - Phone: `bar`, `delete-account`, `look-layout`, `look`, `make-design-pass`, `make-look`, `make-second-look`, `make-walk`, `me`, `membership`, `real-buttons`: 238 passed, 26 skipped, 1 failed (`look-layout.test.ts:113`).
  - Phone `look-layout.test.ts:113` with `src/lib/look.css` from `fc59d78`: failed the same way.
  - A throwaway probe (not committed), phone and tablet: `/make` and `/make/<game>/age` measured at 375x667, 320x568 and 667x375.
- CI on `8d50a58` (run 45319775475): `verify`, `postgres`, `commit-authors`, `pr-rules` passed. `browser shard 5 of 6 (quick, draft)` failed on `look-layout.test.ts:113` (phone); the other pieces were cancelled after it; `gate (quick, draft)` failed.
- Not run: the whole journey suite on tablet and computer; a real iPhone.

## Round 2 findings

- **Red 1, step screen's view under Back and Save: fixed.** `:root` now carries `--step-button` (60 / 52 / 56px, the same steps as `.screen`'s `--button`), and `--foot` resolves: probe on `/make/<game>/age`, phone, `--foot` = `calc(56px + 1.5rem + max(.75rem, 0px))`; body bottom 575, pinned row top 583, last answer bottom 549 after scrolling to the end; at 320x568 body 476, row 484, last answer 449. Sideways (667x375) `--foot` is `0px`, as the sideways rule intends. `make-live-changes.test.ts:185` passes on phone WebKit (it failed on `fc59d78` in round 2, so it fails without the fix).
- **Red 2, Your games 3px over: fixed; it was mid-rise.** Probe at 375x667: view overflow 3 right after load, 0 once `wordsHaveSettled` resolves, still 0 three seconds later; `p.ways` ends at 562 above the body's 587. The check now waits for the rise.
- **Red 3, a member's Your account: fixed.** `fits-the-screen.test.ts:98` passes on phone WebKit: view 0 at 375x667 with Delete my account in view; at 320x568 the page does not scroll, the view scrolls inside itself and its end clears the bar (accepted under the owner's 2026-11-24 "rare scroll is fine").

## Red findings

### Red 1. A journey still expects Sign out and Delete my account stacked

- UNIT: `tests/browser/look-layout.test.ts:113` against `src/routes/me/+page.svelte:55` (`.ways.apart.side-by-side`) and `src/lib/look.css`.
- VERDICT: red.
- REQUIREMENT: CI green; the owner's rule (2026-11-14, "All six") that the two tap areas never overlap; review rules: a PR that changes an existing test names it and why in its body.
- REASON: the PR puts Sign out and Delete my account on one row, but the journey asserts Delete starts below Sign out, so it fails on phone.
- EVIDENCE: CI job 138195252349 and local WebKit: `expect(remove.y).toBeGreaterThanOrEqual(bottomOf(signOut))`, expected >= 459.48, received 411.48 (same row). Same failure with `fc59d78`'s look.css.
- EXPECTED: the journey checks what the owner's rule protects in the layout the PR chose: both are 48px tall, and their boxes do not overlap with at least the row's gap between them, side by side or stacked, at every size.
- FIX: update `look-layout.test.ts:113` to assert no overlap (horizontal gap >= 8px when on one row, or Delete below Sign out when wrapped), and name the changed test and why in the PR body. Files: `tests/browser/look-layout.test.ts`, the PR body.

## Notes (not blocking)

- `/make` for a newcomer at 320x568 scrolls 138px inside its view (the page does not scroll). Inside the owner's "rare scroll is fine"; recorded in case the owner wants Your games to fit the first iPhone SE too.
- Round 2 asked for a step-screen check in `fits-the-screen.test.ts`; none was added. `make-live-changes.test.ts:185` already fails without the fix, so the property is guarded.
- Again a quick run hid a red by cancelling pieces after the first failure: a fix round should run every journey file that touches the screens it changes on phone before asking for review.
