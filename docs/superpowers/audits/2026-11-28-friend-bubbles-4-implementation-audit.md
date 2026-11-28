# Friend bubbles: implementation audit 4

Pull request #435, head **e611fe7** (branch claude/project-thread-cu5tvs). Fresh lane 2 review, Opus 5.5, medium. Re-review of audit 3's one red (the first-open tips over Save and Like at d18d72e).
Verdict: **PASS, 0 red, 3 notes.**

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## What changed since d18d72e

- `src/features/feed/Feed.svelte`: on an upright phone (`portrait and max-width: 499px`) `.hints` sits at the left, just under the top bar, `max-width: calc(100% - 0.75rem - 5.5rem - 1.5rem)`, no centring. z-index 3 is kept, so the tips stay over the friends' faces.
- `tests/browser/controls-overlap.test.ts`: any positioned box painted with glass or a colour that holds no control (and is not inside a control, `aria-hidden`, or `.friends`) now counts against every control; the feed's first screen is checked with the tips showing (the seen-tips note is cleared at each size) before it moves to the maker's clip.
- `docs/superpowers/progress.md`: one Flaky tests line.
- Criteria 10 (widened) and 16 (new) in the PR body match the diff.

## What ran

Here: Chromium only (no WebKit, no Docker daemon in this container), Postgres 16 local, globalSetup skipped, iPhone SE profile in Chromium and iPad (Chrome).

- At e611fe7: `controls-overlap`, `friend-likes`: 8 passed, 0 failed.
- The check fails by itself: e611fe7's tests with d18d72e's `Feed.svelte`: all 4 `controls-overlap` journeys fail on "first screen", naming the tips over Like and Save at 320×568, and over Like and the maker ("N Night Owl Games Studio") at 375×667, before and after launch. Restored after.
- `eslint` on the two changed files: clean.
- Probe (uncommitted copy of the journey with more sizes, phone profile, signed out and signed in with a friend's like): the overlap check passed at 320×568, 375×667, 667×375, 360×640, 360×780, 390×844, 412×915, 430×932, 480×854, 540×960 (centred, past the 499px query), 844×390 and 568×320, before and after launch, on `/` and `/followed`. Measured: the tips end 12px left of the maker's column at every upright size (320: tips x 12–208, column from x 220; 375: 12–263 vs 275; 480: 12–272 vs 380), start at y 72 under the top bar, and end above the game's card at every size (320 before launch: tips bottom 188, card top 223).
- CI at e611fe7 (run 46094909174, quick draft run): verify, postgres, all six browser pieces and gate green. `controls-overlap` passed in WebKit on phone (both journeys, no retry) and on tablet.
- Screens: /mnt/project-files/audits/2026-11-28-friend-bubbles-4/ (320×568 before launch, 375×667 after, 667×375 after).

## Audit 3's red

Fixed. The tips are clear of every button, the maker and the game's card at the three required sizes and the nine more above, and the journey now catches it (it fails on d18d72e's layout).

## The flake

The one WebKit failure of `controls-overlap.test.ts:217` signed out is recorded under Flaky tests as the rules ask (cause not found, message not kept). Acceptable for this merge: PR runs and sessions never retry, and CI's own WebKit run at e611fe7 passed both journeys first time. If it fails again in the full run, that is a red, not a second flake.

## Findings

None red.

## Notes (not blocking, not fixed here)

1. At 320×568 before launch the tips' lower edge meets the friends' faces (tips bottom y 188, faces top y 187): the tips draw over the top pixel of the faces. That is the order the owner asked for (faces behind every floating piece), and the faces are a picture, but it looks tight. Recorded only.
2. The flake line says its message was not kept. A WebKit run that fails once should keep its trace or error, so the next one can be looked at. Recorded only.
3. The tips' box sits at the left but its words are centred inside it; on a 320 phone they wrap to four lines. Readable, recorded only.
