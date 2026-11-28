# Code quality review, slice 3 close

Examined: `main` at `2a88be3` (2026-11-28 15:18 UTC). Read-only review; nothing in the app was changed.

## The short answer

The code is better than the bug count suggests. The logic is typed, the risky parts are kept apart and tested, and the private feed boundary has its own test that fails when anything leaks. The problem is how the code gets changed. Every look or feel problem the owner finds gets a narrow patch and a narrow test for that one symptom, and nothing checks what the screens actually look like. So the owner ends up as the visual test suite. A rewrite or a switch of tools would not fix that. What fixes it is screenshot baselines, one list of screens, and one owner for the moves between pages.

## What is good

- **The pure logic is separate and tested.** `src/lib/pad-moves.ts` (where the gamepad's focus goes next) and `src/lib/gamepad.ts` (what a press means) work on plain data, with no page involved, and unit tests cover them. Those are the right shapes.
- **The private boundary is guarded.** `tests/feed-private-boundary.test.ts` fails if the public repo names a private setting, and `tests/features/consent/routes.test.ts` reads `src/routes` from disk, so a new route can't skip the cookie rules. That second idea should be used much more widely (weakness 2).
- **There are a lot of journeys.** 95 browser test files cover every create, read, update and delete, at three sizes.

## What is weak, with evidence

### Tests check how things work, almost never how they look

- `toHaveScreenshot` appears 0 times in `tests/`, and there is no `tests/golden/` folder. No screen is ever compared against an approved picture.
- The look checks are rules for one property at a time, each added after the owner complained: `controls-overlap.test.ts` after "these are overlapping, why didn't reviewer catch this?" (2026-11-27), `text-contrast.test.ts` in #451 after search became unreadable, and `bar-through-moves.test.ts` for focus rings. Each one catches its own bug and nothing next to it. A screen can pass all of them and still look wrong: a missing image, a wrong colour, a layout that shifted, or a clip sliding twice.
- So the owner is the only check that looks at the whole screen. That is the main reason they keep finding visual and feel bugs.

### The list of screens is kept by hand in many places

- `src/routes/+layout.svelte` keeps five separate lists or conditions about which screen gets what: `place` (line 38), `NO_BAR` (12 route ids), `FULL_SCREENS`, `READ_IN_PEACE`, and the header condition at line 222. That condition is a single line with four checks, and some of them use the address while others use the route id.
- The checks that cover every page keep their own copies. `controls-overlap.test.ts` has `SIGNED_OUT` and `SIGNED_IN`, and `text-contrast.test.ts` and `fits-the-screen.test.ts` have lists of their own. A new screen is covered by whichever lists someone remembers to update. That is how the cookie card ended up covering What we keep, and why "every page" checks miss pages.
- The lists also cause merge conflicts. In the last two days, merges into five different branches conflicted on `tests/browser/controls-overlap.test.ts`, plus `progress.md` and `Feed.svelte` (from `git log --merges`).

### Moving between pages has no single owner

- A page move is coordinated through marks on `<html>`: `data-move`, `data-way`, `data-step`, `data-sliding`, `data-clip-waits` and `data-named`. The code sets them in 12 places, and `src/lib/look.css` reads them in 35 `view-transition` rules.
- Four separate handlers decide whether a sheet is open by checking `document.querySelector("dialog[open]")`, instead of asking one piece of shared state.
- The layout's `onNavigate` checks `browserSlid` (Safari's own swipe), `heldMove()` (Back pressed mid-slide), `grownGame` and `clipMoves` (the clip grows into the game page), and reduced motion. Each check was added to fix one bug: the double slide, the dark clip, Back mid-slide. The sound fix (#456) lives separately in `src/features/feed/sound.ts`. With no single place that knows "a move is happening, this is its kind, and this is what plays", each new fix can break an older one. That pattern is visible in the history: #412 needed two review rounds because one Back cleared another Back's wait.

### Input handling: one duplicate path, one dead path

- `src/features/feed/FeedTop.svelte` (around lines 190 to 215) runs its own gamepad loop on every frame for LB and RB, with its own `held` state and its own constants (`LB = 4`, `RB = 5` in `tabs.ts`). Meanwhile `src/lib/pad-focus.ts`, through `gamepad.ts`, already reads the same buttons as `tabBack` and `tabNext`. That is two loops reading one gamepad. The known bug where the first press after coming back to the feed is ignored is exactly what two separate `held` states would cause.
- The tab switching in `pad-focus.ts` works on `[data-pad-tabs]`, which nothing in `src` uses, so that path never runs.
- Wheel and trackpad input is handled in `FeedTop.svelte` (sideways moves change tabs) and in `Feed.svelte` (up and down moves the clip). Touch is handled in both as well. Each has its own thresholds. The pure, tested rules in `pad-moves.ts` are good, but the code that decides which handler owns a gesture is spread across components.

### The test suite is noisy, and the noise is hidden on main

- "Flaky tests" in `progress.md` has 117 entries, and 55 of them say a test passed on a rerun. The files that appear most: `feed-controls.test.ts` 18 times, `edit-page` 9, `cookie-consent` 8, `adults-only` 6, `make-second-look` 6.
- About 12 entries are the same sign-up failure ("no code waiting" or "Text me a code") from the stand-in for Twilio, the text-message service. Several are marked "cause not looked for".
- Retries on main (up to 2) keep deploys moving, but the flakes then show up as rows in a document instead of failures, so nobody is forced to fix them. Every flaky pull request run also costs a full CI rerun and a session's time.

### The files are big, and the styling lives in two places

- `src/lib/look.css` is 6,116 lines of global CSS. Components also carry their own styles: `Feed.svelte` has 533 lines of `<style>`.
- `z-index` is set 24 times with arbitrary numbers (1, 2, 3, 5, 20, 30, 100, -1) and no named layers. That is how a control ends up drawn under or over the wrong thing.
- `Feed.svelte` is 1,441 lines and `src/features/games/service.ts` is 2,021 lines. A change in either one touches a lot of unrelated behaviour, and reviewers have to read all of it.
- Comments read as a history log: `src/` has 100 comments quoting or citing "the owner" with dates. The reasons matter, but a dated decision belongs in `progress.md` or the spec. In code, it hides what the code does now.

### How fast it changes

- `main` got 293 commits in the last 2 days, with up to 10 branches open at once, all changing the same shared files (the layout, look.css, Feed.svelte, the standing journeys). A lot of the "fix" work is re-merging and re-auditing, not building.

## Top 5 weaknesses, ranked by what they cost the owner

1. **No screenshot baselines, so the owner is the visual test.** Fix: add Playwright `toHaveScreenshot` baselines for every screen at the three device sizes, signed in and signed out. Make them repeatable with still poster frames for videos, fonts loaded before the shot, frozen clocks and masked counters. A change that alters pixels fails until the new picture is approved on the screens page. Size: medium, about 2 to 3 days including getting the shots stable. Lane 2 for the test support, lane 3 for `tests/golden/`.
2. **The list of screens is hand-kept in about 8 places.** Fix: one registry, for example `src/lib/screens.ts`, mapping each route id to whether it has the bar, the wordmark, full screen, the cookie card or "read in peace", and its sample addresses for tests. The layout reads it, every standing check loops over it, and a unit test (the same idea as `consent/route-ids.ts`) fails when a route is missing from it. Size: small to medium, 1 to 2 days, lane 2.
3. **Page moves, sound and focus have no single owner.** Fix: one controller for moves, for example `src/lib/moves.svelte.ts`. It holds the current move (kind, direction, and whether it is held, waiting on a clip, or done), any open sheet, and whether sound is on. The layout, the feed and the sheets read it, instead of setting marks on `<html>` and checking `dialog[open]`. Add a journey that films each kind of move and fails when a slide plays twice. Size: large, 3 to 5 days, lane 2. Do it after slice 3 closes, not during the polish rush.
4. **Flaky tests are logged but not fixed.** Fix: first, find the root cause of the stand-in's "no code waiting" race, which is the most common single cause. Then work `feed-controls.test.ts` down. Add a CI step that lists each retry-pass on main and keeps the list short, for example a cap of 5 open entries before new feature work starts. Size: medium, 1 to 2 days for the text-code race, then ongoing.
5. **The files are too big, and gamepad and wheel input go through duplicate paths.** Fix: split `look.css` by feature, alongside the screen registry. Replace the arbitrary `z-index` numbers with named layers (video, friends' faces, floating controls, the bar, sheets, the cookie card). Delete the gamepad loop in `FeedTop.svelte` and give the feed's tab row `data-pad-tabs` so `pad-focus.ts` handles LB and RB in one place. Split `Feed.svelte` into the player, the controls and the gestures. Size: medium, done piece by piece as each part is next touched. The gamepad change alone is small, about half a day.

## Notes, not blocking

- In RukenPrivate, the only connection point read was the ranker seam (`src/features/feed/ranker.ts`). It is narrow and its boundary has a test. Nothing else was checked there.
- This review did not run the suites or the app. It used the source, `git log` and `progress.md` at `2a88be3`.
