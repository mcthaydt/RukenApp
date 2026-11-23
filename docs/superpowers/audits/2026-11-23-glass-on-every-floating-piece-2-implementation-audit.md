# Glass on every floating piece: implementation audit 2 (re-review)

- Pull request: #370, head `f1f2748109da52be4f485f065b0fb184fe2bc10f` (branch `claude/project-thread-6s28wv`, `main` 682ef22 merged in). Started at `c5717d6`; the head moved during the review and everything below was re-run at `f1f2748`.
- Lane 2. Design round 2. Reviewer: Opus 5.5, medium.
- Written 2026-11-23 17:20 UTC.
- Verdict: **FAIL: 1 red.** Both reds from audit 1 are fixed. A new red: on phones and tablets, "Test play" becomes a second blue button.

## Is it exciting?

Yes. Over a colourful clip the bar, hints, name box and Share look like one set of glass pieces floating over the game. The softer fringe now reads as a lens edge, not a coloured outline. Over a plain white clip (the case that failed last time) every word and icon stands out clearly. Pictures are in project files `audits/2026-11-23-glass-review-f1f2748/`.

## What ran (at `f1f2748`, cloud container, Postgres 16)

| Check | Result |
| --- | --- |
| `pnpm lint`, `pnpm typecheck`, `pnpm test` (at `c5717d6`; the only changes since are CSS, tests and the merge of green `main`) | passed; 0 errors; 149 files, 2,164 tests |
| Journeys bar, play, feed-controls, look, game-page, glass, feed, make-look, sideways-phone, make-questions, make-send on computer and tablet | 411 passed, 0 failed |
| Same journeys on phone (WebKit, Playwright 1.63 Docker image) | 218 passed, 11 skipped, 0 failed |
| A throwaway probe (not committed): Check and send's button row on each size, and the feed over a plain white clip | see red 1 and the pictures |

## Pull request body

It starts with the attribution comment and the `_Requested by **McThayDT** · [project thread](…)_` line. It has `## Lane` and `## Acceptance criteria` (now 8, including the floating row) and `## Tests changed on purpose` (including `make-look.test.ts:63`). The last line is `Requested by **McThayDT**`. Passes.

## Audit 1's reds

- **Red 1 (faint labels over white): fixed.** `feed-white-phone.png` (WebKit) and `feed-white-tablet.png`: the name, both hint lines, and the Home, You, Share and sound pictures are plainly readable. `tests/browser/glass.test.ts` passes on all three sizes.
- **Red 2 (comments claiming 4.5:1): fixed.** `Feed.svelte` and the play-tab comment in `look.css` now say that the words carry the halo.

## Are the changed tests honest?

Yes.
- `glass.test.ts` reads the drawn pixels with all clips plain white. It takes the darkest 2% of each glyph's box as its halo and needs 4.5:1 against chalk, and the glyph itself must still be chalk (luminance 0.85 or more). That is a fair proxy for a text halo. It would fail if the ink were weakened, and it did fail at about 2.1 to 2.5 under the old ink. It replaces the deleted `feed.test.ts` sum, which could only pass with near-black glass.
- `buttonColour` decides "on glass" from the DOM (an ancestor, or its `::before`, has a backdrop filter), not from the same selector the CSS uses. A button on glass that stayed solid fails, and so does a solid button that turned glass. In the fallbacks, `--glass-filter` is `none`, so it expects solid, which matches.
- `make-look.test.ts:63` swaps "bottom within 1px of the window" for "8–24px above it and at least 8px clear of each side", which is exactly the owner's "make the footer floating".

## Floating footer

- **Upright phone:** the pill sits 0.75rem above the bottom (or above the home indicator) and is clear of both sides. `.screen` still pads its bottom by `button + 3.5rem`, which is more than the pill's `button + 1rem` height plus its 0.75rem lift. So the last line ("Throw this game away" in `test-play-second-blue-phone.png`) ends above the pill, and nothing is covered.
- **Sideways phone:** the `:root:not(:has(nav.bar))` rules from #366 come after it and reset `bottom`, `left` and `top` for the right-edge column. `sideways-phone.test.ts` passes on all three projects.

## Findings

### Red 1: "Test play" is painted as a second blue button on phones and tablets

- UNIT: `src/lib/look.css`, the rule `.screen .acts > :is(.button, button):not(.danger)` (the coloured-glass row, inside the upright/short media query, about line 1283).
- VERDICT: red.
- REQUIREMENT: the drunk-grandma test ("one main action per screen"); the pull request's criterion 7 ("a button on glass is glass *in its own colour*"); an outline button's own colour is none.
- REASON: the selector has specificity (0,4,0), which beats `.outline` (0,1,0). So every outline button in the pinned row gets `--glass-pay` fill and turns blue next to the real main button.
- EVIDENCE: the probe read `getComputedStyle` on `/make/<slug>/check`. On computer, Test play's background is `rgba(0, 0, 0, 0)` (outline, correct). On tablet and phone (WebKit) it is `rgba(0, 110, 184, 0.8)`, the same as "Send for review". Picture: `audits/2026-11-23-glass-review-f1f2748/test-play-second-blue-phone.png`, where both are blue and the outlined Test play looks like the stronger of the two. The same markup is on `WaitingScreen.svelte:50` and in the "Change something" branch of `check/+page.svelte:29`. `main` keeps outline buttons unfilled there. No journey checks Test play's colour on a phone, so CI stays green.
- EXPECTED: in the glass row, "Test play" stays an outline button (no fill, chalk ring, words with the glass halo). Only the blue main button is coloured glass.
- FIX: exclude outline (and quiet) buttons from the coloured-glass rule, e.g. `.screen .acts > :is(.button, button):not(.danger, .outline, .quiet)`. Add a journey check that Test play's `background-color` is `rgba(0, 0, 0, 0)` on Check and send at every size (`tests/browser/test-play.test.ts` or `make-send.test.ts`). Files: `src/lib/look.css`, plus that one test file.

## Notes (not blocking)

1. The bar's marked tab (`--glass-lift`, white at 0.22) is a faint pill over a white clip (`feed-white-*.png`). Over real clips it reads well. Over white, the place you are on is told mostly by the icon's position. It's worth a look on the owner's walk.
2. On a 375px phone, "Send for review" wraps to two lines inside the pill (`test-play-second-blue-phone.png`). Once Test play is an outline again the widths stay the same, so check whether it also wraps on `main` before treating it as new.
3. From audit 1, still open: frame rate with about seven blurred surfaces over a playing clip is unmeasured on a real phone.
4. The PR was `dirty` against `main` at `c5717d6`. At `f1f2748` it merges `main` 682ef22. This verdict names `f1f2748` only. Any later push or main merge makes it stale.

## Re-review

After the fix, a re-review checks red 1 by the new journey assertion (phone, tablet, computer) and a phone picture of Check and send. It also re-runs `glass`, `make-look`, `make-send`, `test-play` and `sideways-phone`.
