# Clip crop on the feed-to-game move: implementation audit, round 1

- Pull request: #406, head `40f920a162979270941f801a411a699821e8b688`, base `main` at `16f8996`.
- Lane 2 (`src/lib/look.css` is shared). One fresh review, Opus 5.5, medium.
- Written 2026-11-27 02:32 UTC (from `date`).
- Verdict: **40f920a PASS**. No red findings; two notes.

## The brief

The owner, 2026-11-27: "Refine the cropping on the grow feed to game page, it's not smooth". Acceptance criteria are in the pull request body: held a third of the way out and two thirds of the way back, nothing of the clip's pictures shows outside the moving box (under 0.5 of 255), nothing in a 4 by 4 patch at each corner (under 4), the clip is drawn inside (over 10), on phone (WebKit), tablet and computer; neighbouring move journeys still pass.

## What I ran

All runs in the `mcr.microsoft.com/playwright:v1.63.0-noble` image (WebKit for phone), against a local Postgres 16, `--trace off`.

| Run | Result |
| --- | --- |
| New journey on the PR head, `--repeat-each 2` | 6 passed (phone, tablet, computer, twice each) |
| New journey with `look.css` taken from `16f8996` (main) | 3 failed, all on "outside": phone 28.5, tablet 15.3, computer 28.2 |
| New journey with the PR's `look.css` minus only the `clip-rounds` animation | 3 failed, on corners: phone 114.9, tablet 115.9, computer 90.5 |
| CI on the head: verify, postgres, browser shards 1 to 6, gate (quick, draft) | all success |

So the builder's claim holds: the journey fails on main's styles on all three devices and passes with the fix. The third run shows the corner half of the check can fail on its own too, so both halves of the change are covered by a check that fails without them.

I did not rerun the neighbouring journeys (`page-moves`, `feed`, `feed-controls`, `game-page`, `bar`) locally; the draft's quick CI run covers the browser shards green.

## Reading the change

- `::view-transition-image-pair(clip)` gets `overflow: clip` and a `border-radius` animation from 0 to `--radius-card`, 450 ms, on the same `cubic-bezier(0.22, 1, 0.36, 1)` as the group. This is the right element: the pair is the box the group moves and sizes, and both pictures sit in it.
- Back sets `animation-direction: reverse`. The group's Back curve is `cubic-bezier(0.64, 0, 0.78, 0)`, which is the exact mirror of the out curve (1 − x2, 1 − y2, 1 − x1, 1 − y1). Reversing an animation applies its easing to the reversed progress, so the radius on Back is R·ease(1 − t) while the box's progress is 1 − ease(1 − t): the corners track the box exactly, the same as going out.
- `--radius-card` is read on the root, so the browsers without `corner-shape` get their 32px fallback from the `@supports not` block; WebKit (phone) passed the corner check with it.
- The game page's box is `.gamepage .hero` (`border-radius: var(--radius-card)`, `overflow: hidden`), so the end radius matches what the box lands in.
- Only three files change: `look.css`, the journey file and `progress.md`. No existing expectation was edited.

## Frames

Held at 8, 20, 35, 50, 65, 80 and 95 percent, both ways, main against the fix, on all three devices: https://claude.ai/artifact/6rSTa6LrCuRFrFTuBW4FpE

- Phone (WebKit): on main the feed's picture runs past the box, down over the page, until the end; with the fix it is cut to the box and its corners round as it shrinks. Back squares off as it lands in the feed.
- Tablet and computer: on main the feed's wide picture spills sideways over the panels as a see-through band; with the fix nothing shows outside the box at any held point.

These are held frames, not timed playback. Frame pacing at 60 fps was not measured, and nothing was tried on a real iPhone.

## Findings

UNIT: `src/lib/look.css`, the grow move. VERDICT: note. REQUIREMENT: none of this change's. REASON: on Back, the game's name drawn over the clip on its page disappears at the first frame, since the moving clip is drawn over the old page. EVIDENCE: phone Back strip, 8% frame, on both main and the fix. EXPECTED: the owner may want the name to fade rather than vanish. FIX: none here; it is the same on main, so it is a follow-up if the owner wants it.

UNIT: `tests/browser/feed-to-game-grow.test.ts`, `clipSpill`. VERDICT: note. REQUIREMENT: none. REASON: the check samples one held point each way, so a spill at another point of the path would not be seen. EVIDENCE: the frames at seven points show none on any device, so nothing is missed today. EXPECTED: nothing to change now. FIX: none.

## CRUD

The change adds nothing a person makes, so there is no CRUD journey to find.
