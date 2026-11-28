# Clip-tile shape (#468): lane 2 review, round 1

Commit examined: `738343da370c08ddcfa35d43885f08ff663a7bcc` (`claude/project-thread-lyhbvv`), base `c82fc88`. Reviewer: a fresh session, Opus 5.5, medium. Lane 2 (`src/lib/look.css`, `tests/browser/support/look.ts`).

**Verdict: PASS.** No red findings. Two notes.

## What the change does

- `src/lib/look.css`: `.tiles .tile[data-shape=upright|wide]` gets `aspect-ratio: 9 / 16` or `16 / 9`.
- `tests/browser/support/look.ts`: `layoutHasSettled` no longer waits for `loadedmetadata` on a video whose computed `aspect-ratio` is not `auto`.
- `tests/browser/real-buttons.test.ts`: new journey "a waiting game's screen settles even when its clips never load". Once the page is in, it points each clip at an address the test never answers, checks `readyState` is 0, and expects `layoutHasSettled` to finish.
- `docs/superpowers/progress.md`: the flake note now says it was fixed.

## Checks run (this container, WebKit 26.6 for phone, Chromium for tablet and computer, Playwright 1.63.0)

| Check | Result |
| --- | --- |
| New journey with the fix, on phone, tablet and computer | 3 of 3 passed |
| New journey without the fix (`look.css` and `support/look.ts` from `c82fc88`, the test kept) | 3 of 3 failed: `page.evaluate: Test timeout of 45000ms exceeded`, inside `layoutHasSettled` |
| Repeat: new journey plus the two "waiting game's screen" journeys, `--repeat-each 10 --workers 4` | 60 of 60 passed |
| Loaded run, the flake's own conditions: `real-buttons`, `game-page` and `make-screen-review`, `--repeat-each 3 --workers 8` on 4 cores | `real-buttons` and `make-screen-review`: 408 of 408 passed. `game-page`: 14 failed (see note 2) |
| Other callers of `layoutHasSettled` plus the overlap journey: `take-off`, `make-second-look`, `make-design-pass`, `controls-overlap` | 184 passed, 0 failed (101 skipped by their own project rules) |
| CI quick draft run at `738343d` (run 46144315151) | `verify`, `postgres`, browser pieces 1 to 6 and `gate` all passed; `commit-authors` and `pr-rules` passed |

## Layout, overlaps and first-frame stills

The probe is `2026-11-28-clip-tile-shape-1-probe.test.ts.txt` in this folder. It uses the overlap measure from `controls-overlap.test.ts` (every button and link box against every other, and every floating painted box against them). It ran on the phone (WebKit) at 320×568, 375×667 and 667×375 (opened as if from the Home Screen), before launch (Wishlist) and after (Play). It covered the five screens that draw `.tiles`: waiting, sent back, live, and Check and send, on the PR and on the base CSS.

- Overlaps: none, on every screen, at every size, before and after launch, on both builds. Nothing scrolls sideways (scroll width minus window width is 0 everywhere).
- Video boxes: the same to 0.01 px on the PR and the base at every size. For example 375×667 waiting: upright 76.69×136.33, wide 242.38×136.33; 667×375: 101.25×180 and 320×180. Nothing on screen moves.
- First-frame stills: every video on these screens has `data-still` and a `--still` address set by `stillPoster` on both builds. The local server cannot make the still picture itself ("Binding MEDIA needs to be run remotely", as `verify` says), so the picture was not seen; what the change could break, that the still is asked for at the video's size, is unchanged. Videos keep `preload="metadata"` and `#t=0.001`.

## Exploratory checks

- The skip is safe for the other videos it now covers. Every other rule giving a video an `aspect-ratio` (`.sheet.fix video`, `.preview .card`, `.gamepage .more .tile`, `.about .wall video`) sets one side and leaves the other `auto`, so their boxes come from the ratio and not from the clip. No `<video>` in `src` has `width` or `height` attributes, which would compute to `auto W / H` and be skipped while their box still waited on the clip.
- The journey's `readyState === 0` check right after the new `src` is not racy: setting `src` runs the media load algorithm, which sets `readyState` to 0 at once.
- CRUD: the change adds nothing a user can make. Nothing to cover.
- The pull request body lists each check it edits, with lane and criteria. Its last line is "Requested by **McThayDT**".

## Notes (not blocking)

1. UNIT: `src/lib/look.css` (the new rule's comment). VERDICT: note. REQUIREMENT: none broken. REASON: the comment says the rule sets the box "before the video has loaded a thing". The box was already set by `.tile`'s `width: 100%; height: 100%` inside a frame of fixed size: the probe measured the same boxes with and without the rule. So the rule only marks the video as shaped, for `layoutHasSettled`. The PR body says this plainly ("Their frames already set their size"), so nothing is wrong. FIX if wanted: a few words in the comment saying the frame already sets the size and the ratio is what tells the wait. Only `src/lib/look.css`.
2. UNIT: `tests/browser/game-page.test.ts:89`, `:130`, `:140`. VERDICT: note, outside this change. REASON: under 8 workers on 4 cores (twice the cores), 14 of these runs timed out at 30 s while setting up (for example `apiRequestContext.post` to `/jobs/review` at `support/game.ts:385`, or the context closing). EVIDENCE: the loaded run above. `game-page` does not use `layoutHasSettled` or `.tiles`, so this change cannot reach it, and the flake note already records `:130` failing the same way in the builder's 8-worker runs. It is a machine that is too loaded, not the app; CI runs fewer workers. FIX: none here. If it is ever seen in CI, it goes under "Flaky tests".

## What did not run

- The full CI run (it starts when the draft is marked ready). Only the quick draft run is green.
- A still picture seen on screen, for the reason above.
