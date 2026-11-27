# Bar through moves (#427), implementation audit 1

- Pull request: #427, branch `claude/project-thread-pej2xk`
- Commit examined: `9f034cb40ac8f44e401a25e7f853bf65ce77607c`
- Lane: 2 (`src/lib/look.css`, `src/lib/page-moves.ts`). Reviewer: fresh session, Opus 5.5, medium.
- Written: 2026-11-27 15:55 UTC
- Verdict: **FAIL: 1 red**

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## What ran

All runs in this cloud container, inside the `mcr.microsoft.com/playwright:v1.63.0-noble` image (host network, Node 24, Postgres 16, the config's own stand-ins), on all three profiles (phone = WebKit, tablet and computer = Chromium). Emulation only, no physical phone.

| Run | Code | Result |
| --- | --- | --- |
| `bar-through-moves` | PR head | 3 of 3 passed |
| `bar-through-moves` | PR head with `look.css` and `page-moves.ts` put back to `origin/main` | tablet and computer FAIL on move 1, frame 0, top left corner, 46 and 27 against 16; phone passes |
| Same journey with every corner check made soft | without the fix | tablet and computer fail on **all 8 moves** (swipe to Followed, press Fresh, press Followed, swipe to Fresh, open a game, Back, You, Home), all four corners |
| Same, ring injected (below) | PR head plus one CSS rule | 3 of 3 **passed** (should fail) |
| Bar at rest probe (feed, You, back to feed) | PR head | feed and back: `blur(28px) saturate(1.8) brightness(0.94)`, `data-glass` on; You: `none`, solid `rgb(17, 19, 20)`, `data-glass` off; `data-sliding` cleared on all three profiles |

CI on the head: every quick draft check is green (gate, verify, postgres, six browser pieces, commit-authors, pr-rules).

## The cause

Confirmed. The owner's picture shows a dark square behind the bar with square corners, sitting over the clip while the page slides. Putting the two source files back to `main` makes the new journey see that patch at the bar's corners on Chromium (the Galaxy's engine) on every one of the 8 moves, and not on WebKit, which matches the builder's account. With the fix, the bar's own blur is off only while `data-sliding` is set, and `::view-transition-group(tabs)` blurs live in the bar's radius and corner shape. `--glass-filter` on the group resolves from `<html>`, so it follows the page the move goes to (`data-glass` on or off), as the comment says. Only the existing glass token is read, so `tests/lib/glass.test.ts` still holds.

`data-sliding` is set before `startViewTransition`, so the old picture is taken without the bar's blur, and is cleared on `finished` only when the mark is still this move's, so an overtaking move keeps it. `finished` settles on a skipped move too. On phone in this container the mark stayed up to about 2 s after arrival (the software-drawn WebKit slide is slow here) and then cleared; the glass came back each time.

## Coverage of route changes

Swipe and LB/RB both call `stepTab` in `src/features/feed/FeedTop.svelte` (lines 68, 83, 84), so the swipe moves cover the shoulder buttons' route. Fresh and Followed presses, Back, You and Home are filmed directly. Every route change in the app goes through `slideWhile` (root layout and the maker layout), so the fix reaches all of them.

## Findings

### 1. The ring check cannot see a ring that a press leaves in the bar's picture

- UNIT: `tests/browser/bar-through-moves.test.ts` (`noRingWithoutKeys`, `throughOneMove`) and `tests/browser/support/moves.ts` (`watchMoves`)
- VERDICT: red
- REQUIREMENT: the pull request's acceptance criterion 2 ("No button on the bar or the feed's tabs shows an outline, a ring or a tap flash, in any frame or after any move, unless the keyboard or gamepad put it there"), and the owner's ask to prevent a third bar artifact ("How can we prevent that from happening?"). The first bar artifact was exactly this kind of press ring.
- REASON: the check reads the computed style of the live links, but by the time frames are filmed the navigation has moved focus off the pressed link, while the bar on screen is still the picture taken at the press, with the pressed link's ring in it.
- EVIDENCE: with the fix in place, this one rule appended to `src/lib/look.css`: `.bar a:focus:not(:focus-visible), nav[aria-label="Feeds"] a:focus:not(:focus-visible) { outline: 3px solid red !important; box-shadow: 0 0 0 3px red !important; }`. The journey passed on phone, tablet and computer. The saved frames at 50 ms show a red ring round You on the bar (move 7) and round Followed in the tabs (move 3) on both tablet and computer. The corner check does not see it either, since the ring is inside the bar's box, away from its corners.
- EXPECTED: that rule makes the journey fail on tablet and computer (at least on moves 2, 3, 7 and 8, the presses).
- FIX: read the rings at the moment the old picture is taken. For example, in `watchMoves`'s `startViewTransition` wrapper, before calling `start`, run the same ring query as `noRingWithoutKeys` on the bar's and the tabs' links not matching `:focus-visible`, keep the result on `seen`, and have `throughOneMove` expect it to be empty for each move. Files: `tests/browser/support/moves.ts`, `tests/browser/bar-through-moves.test.ts` only. Check: the rule above fails the journey on tablet and computer, and removing it passes on all three.

## Notes (not blocking)

- In the test WebKit the bar fades to about a fifth mid-slide (seen in the phone frames here), the same before and after this change, as the pull request says. Follow-up if it shows on a real iPhone.
- The ring check's own guards (`outline: none` and `-webkit-tap-highlight-color: transparent` in `Bar.svelte`) are also covered by the global `html { -webkit-tap-highlight-color: transparent }` and the browser's `:focus-visible`-only outline, so taking them out of `Bar.svelte` shows nothing and the journey rightly stays green.
- LB/RB are not driven directly in the journey; they share `stepTab` with the swipe, so this is enough today. If the gamepad gets its own route, add it.
- The bar at rest is right: glass over the feed, solid on You, per #413.
