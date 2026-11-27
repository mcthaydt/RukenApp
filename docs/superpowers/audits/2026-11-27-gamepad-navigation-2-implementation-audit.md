# Gamepad navigation (#409): lane 2 implementation audit, cycle 2

Examined commit: `f4adc93e8a65a2e27c092e3a7db207eb8bbdc438` (branch `claude/project-thread-0ay036`). Reviewer: a fresh session, Opus 5.5, medium effort. Written 2026-11-27 06:08 UTC.

**Verdict: FAIL, 3 red.** R1 and R2 of review 1 are fixed. The new bar ring breaks two existing journeys, the owner's tap ring is not what the change removes, and a long Search list is not walked properly by the pad.

## What ran

- `pnpm lint` (0 problems), `pnpm typecheck` (0 errors), `pnpm test` (159 files, 2,307 tests passed), on f4adc93.
- `tests/browser/gamepad.test.ts` and `tests/browser/feed-top.test.ts` on tablet, computer, phone (WebKit, through `mcr.microsoft.com/playwright:v1.63.0-noble` in Docker) and an Android profile (Playwright's `Pixel 7`, Chrome's engine with touch): all passed.
- A reviewer's probe (`2026-11-27-gamepad-navigation-2-probe.test.ts.txt`, not in the PR): `padReachesEverything` on 35 more screens on phone (WebKit), tablet and computer, the Search walk with the pad, the Followed tab with the pad, and the Android tap on the bar, captured mid-tap with Chrome's own touch events.
- Review 1's `nextBox` probe, plus a sweep of the measured Check and send layout with the name's button moved -80 to +80px and the line's -20 to +20px (861 layouts): every control reached from Send in each.
- No pad plugged in (mouse, touch, keyboard): `bar`, `feed`, `feed-controls`, `feed-to-game-grow`, `page-moves`, `play`, `report-a-game`, `real-buttons`, `sideways-phone` on phone (WebKit), computer and Android: 395 passed, 7 failed (R1 below, and one environment failure, see "Not judged").
- Baseline: the same failing journeys on `89caede` (main as merged into the PR) in a separate worktree: `bar.test.ts:123` and `feed-controls.test.ts:1030` pass there.
- Not run: a real controller or a real Android phone (none here); the full browser suite (CI's full run does it when the PR is marked ready).

## Review 1's findings

- **R1 (Check and send): fixed.** `ahead` now needs an overlapping box's middle to be more than half the smaller box's size further on. The failing layout from review 1 and 861 shifted layouts are all reached; the journey on `check` passes on all four profiles.
- **R2 (play screen): fixed.** The frame takes the focus on load when a pad is connected, the frame is the screen's first control for a first press, and B over the menu presses Keep playing (`data-pad-back`). Journeys 5 and 6 start from the screen as it opens and pass on all four profiles. Ruken's menu still opens with Home or View held.

## Red findings

### R1. The bar's new ring fails two existing journeys

UNIT: `src/features/feed/Bar.svelte` (the `.bar a { outline: none }` rule), with `tests/browser/bar.test.ts` and `tests/browser/feed-controls.test.ts`.
VERDICT: red.
REQUIREMENT: criterion 11 (the journeys pass on phone, tablet and computer in CI); the review rule that a pull request changing an existing test names it in its body.
REASON: the bar's focus ring is now a shadow with `outline: none`, and two journeys still check that a focused bar button has an outline.
EVIDENCE: on f4adc93, `bar.test.ts:123` ("Add a game ... by tap or by keyboard") fails on computer, phone (WebKit) and Android with `Expected: not "none"`; `feed-controls.test.ts:1030` ("everything is reachable with Tab ... and focus shows") fails on the same three with `Received string: "none 3px"`. Both pass on `89caede`. The draft's quick CI run did not include them, so it is green.
EXPECTED: the full browser suite passes.
FIX: change both checks to accept the bar's ring (an outline, or the 3px shadow the bar now draws), as `gamepad.test.ts` does, and name both in the body's "Tests changed". Files: `tests/browser/bar.test.ts`, `tests/browser/feed-controls.test.ts`, the PR body.

### R2. The ring the owner saw after a tap on the bar still shows

UNIT: `src/features/feed/Bar.svelte` (`.bar a.add[aria-current="page"]`).
VERDICT: red.
REQUIREMENT: the owner's report (2026-11-27: a full rectangle outline showed on tapping a bottom bar button); criterion 8 and the PR's "a tap or click draws no ring".
REASON: neither of the two things the change removes was being drawn on a tap. The only ring a tap on the bar brings up is the chalk ring that marks Your games on the big Add button, and it is unchanged.
EVIDENCE: in the Android profile, a tap on Add a game, with the PR's CSS and with its new bar rules removed (main's): no ring while the finger is down, then, once Your games opens, a full 3px white ring round the button, the same in both (`android-tap-add-a-game.png` in the project's `audits/2026-11-27-gamepad-navigation-2/`). Taps on Home and You show only the brighter pill. The tap colour was already off for the whole site on `main` (`html { -webkit-tap-highlight-color: transparent }`, `src/lib/look.css:5792`; every link and button reads `rgba(0, 0, 0, 0)`), so the new rule changes nothing; forcing a tap colour shows Chrome would draw it as a square, not the button's shape. In the Android profile a tap never matched `:focus-visible`, on main's rules or the PR's, even after a Tab press first, so the outline was not drawn on a tap either.
EXPECTED: a tap on a bar button shows no ring, on Your games too.
FIX: mark Your games on the Add button without a ring (for example the same brighter look the other places get), and check it with the Android tap above. If the owner wants a different mark there, that is their choice: show them the picture and ask. Files: `src/features/feed/Bar.svelte`, `tests/browser/gamepad.test.ts` (the bar journey: tap Add a game and check no ring shows on Your games).

### R3. On a long Search, up jumps to the search box and skips the results scrolled out of view

UNIT: `src/lib/pad-focus.ts` (`pinned`, `onScreen`, `move`), seen on `/search` with results (`src/features/feed/Search.svelte`).
VERDICT: red.
REQUIREMENT: the owner's rule, everything fully navigable with a gamepad; criterion 1 names `/search`, and the owner asked for search results with thumbnails (#402).
REASON: Search is a `position: fixed` screen whose results scroll in a box of their own, so every result counts as pinned. The rule that keeps a screen's own content ahead of the pinned part then never applies, and a pinned control's on-screen test ignores the results box's edges. So from the top result in view, up goes to the search box, not the result just above it.
EVIDENCE: with 20 results, down ten times then up ten times, on phone (WebKit), phone size in Chrome's engine and computer: the focus goes up two or three results, then to the search box, then back into the list, then to the box again, every time (for example: "48cd3fa1 → Search games and makers → 48065eb6 → 3f30d570 → 3344c4d8 → Search games and makers"). With the list scrolled down (as touch, a mouse wheel or Tab leaves it), `padReachesEverything` on `/search?q=Tiny g` fails on computer, phone (Chrome's engine) and phone (WebKit), every run: no result is reached at all. It passes on tablet, where the list fits. (In the first run, with fewer games in the database, it passed on computer and failed on phone, WebKit.) The PR's `/search` journey has no search typed, so no results.
EXPECTED: up and down walk the results one by one, scrolling the list, and go to the search box only from the first result; the pad reaches every result with the list scrolled anywhere.
FIX: in `pad-focus.ts`, judge pinned against the nearest scrolling box: a control inside a scrolled box (`overflow` not visible) is the screen's own content even when a fixed screen holds that box, and is on screen only inside that box's view. Then the existing "hidden ones that way first" rule applies within the list. Add `/search` with enough results to scroll to the reach journeys (signed out), and a down-then-up walk on it. Files: `src/lib/pad-focus.ts`, `tests/browser/gamepad.test.ts`.

## Notes (not blocking)

- N1. `main` has moved past the PR's base: #404 (Like, Save and Repost on the feed card) merged after `89caede`. The PR merges cleanly with `bd1e3ff`, but the new feed buttons have not been walked with the pad; the merge of main gets its own review as usual.
- N2. The `-webkit-tap-highlight-color: transparent` on `.bar a` repeats the whole site's rule and can go.
- N3. Review 1's N3 still stands: a box for words on a computer with only a pad has no on-screen keyboard.

## Not judged

- `feed-to-game-grow.test.ts:231` ("the bar is drawn four fifths of the way through Back") fails on phone in the Docker WebKit here, on f4adc93 and on `89caede` alike, so it is this machine's WebKit, not the change.

## Checked and fine

The reach check on 34 more screens (all but the long Search) on three devices: `/terms`, `/legal/maker-agreement`, the four `/help/*` guides, `/join`, `/goodbye`, a maker's page, Search with a short list and with nothing found, signed in `/followed` and `/search`, `/me/password`, `/me/computers`, `/me/delete`, `/me/link`, `/make/page`, `/make/page/links`, a link and its Where screen, `/make/page/links/add`, `/make/page/take-down`, a draft's `line`, `files`, `upright`, `wide`, `age`, `agreement`, `check`, `throw-away` and its own page, and a live game's `take-off` and own page. Followed with the pad: the first press lands on Sign in, LB goes to Fresh, RB back to Followed, and B back to the feed. The pad's Search walk down from the box scrolls the list on all three. No pad: the feed, the bar, page moves, play, report, real buttons and sideways phone journeys pass except as above.
