# Feed top bar (#402): implementation audit, round 1

Reviewed commit: `691c7dbfd4448743e5430c095fe0b5b1c0834e01` (`691c7db`), branch `claude/project-thread-8e2bwm`, against `main` at `16f8996`.
Lane 2, short path. Brief: the pull request's ten acceptance criteria and the owner's standing rules.
Reviewer: a fresh session, Opus 5.5, medium. Written 2026-11-27 01:52 UTC.

**Verdict: FAIL, 1 red.**

## What ran

- `pnpm lint`, `pnpm typecheck`, `pnpm test`: pass (156 files, 2,254 tests).
- `tests/browser/feed-top.test.ts` and `tests/browser/feed-controls.test.ts` on tablet and computer (this container has no WebKit, so the phone did not run here; the quick CI run `45924026801` passed all six browser pieces, phone included): 79 of 80 passed. The one failure was `feed-controls.test.ts:809` (Share closes on the cross, Escape and the dimmed screen) on computer, at the Escape step; it then passed 5 of 5 alone. See note N3.
- A probe (not committed) measured the top bar on computer at 320×568, 375×667, 667×375 and 1280×720 and shot the feed, Following and Search on tablet and computer at each size. Measured boxes:

| Window | Speaker | Tabs pill | Search | Bar of places |
| --- | --- | --- | --- | --- |
| 320×568 | x 12–60 | x 55.3–264.7, h 48 | x 260–308 | y 496 |
| 375×667 | x 12–60 | x 82.8–292.2 | x 315–363 | y 595 |
| 667×375 | x 12–60 | x 228.8–438.2 | x 597–645 | right rail x 591, y 99.5–275.5 |
| 1280×720 | x 12–60 | x 535.3–744.7 | x 1220–1268 | y 648 |

At 320 wide the pill (x 55.3) runs under the speaker (ends x 60) by 4.7px and under Search (starts x 260) by 4.7px. See note N1; 320 is narrower than the device matrix's small phone (375), so it is not red here.

## Criteria

1. Top bar, glass, marks, no overlap upright and sideways: met on the device matrix (probe table; glass tokens with both `backdrop-filter`s and `--glass-edge`; `tests/lib/glass.test.ts` passes). Target size: see R1.
2. Following slides on, For you slides back, Home marked on both: met (`moveBetween("/", "/following")` gives "on", the reverse "back"; layout marks Home on `/following`; journey checks Home).
3. Following empty states: met (journey).
4. Search finds as the person types, case and accents ignored: met (journey and unit tests).
5. No 18+ game, no maker of only an 18+ game; empty and nothing-found words: met (`search.ts` builds the makers from the filtered games; journey and unit tests).
6. No script, address in step without a step per letter, Back to the feed: met (journey).
7. Fits the window, only results scroll, clear of the bar upright and sideways: met (journey; screenshots).
8. Keyboard alone, focus visible: met (journeys; changed Tab-order check is named in the body and explained).
9. Reserved words and open routes: met. See note N2.
10. No dependency, nothing kept, CRUD: met. Search and Following only read; nothing new a person makes.

Owner rules checked: frosted glass on the floating pieces (pill, Search); Search's own screen is solid felt, not floating, which is right. Everything custom (own icon, browser's search cross hidden). No underline (`text-decoration: none`; `real-buttons` passes per the body). Spinner: Search's waits are page moves, so the shared 2-second page spinner covers them; no new loader. Landing page line added in `sections.ts`. Copy passes the drunk-grandma test.

## Findings

### R1

UNIT: `src/features/feed/FeedTop.svelte`, `.tabs a`.
VERDICT: red.
REQUIREMENT: the house least height of a button, `--size-target: 48px` in `src/lib/look.css` ("the least height of a button or a field"), which the bar of places' own links use (`Bar.svelte` `.bar a { min-height: var(--size-target) }`); the coordinator's review brief names 48px targets.
REASON: the For you and Following tabs are 44px tall, smaller than every other button on the feed.
EVIDENCE: `FeedTop.svelte` `.tabs a { min-height: 2.75rem; }`; measured `For you` box height 44 at every size (probe above). The journey checks only `toBeGreaterThanOrEqual(44)` (`feed-top.test.ts`, "the feed's top bar holds…").
EXPECTED: each tab at least 48px tall (the pill then 52px), like the bar's links.
FIX: in `src/features/feed/FeedTop.svelte` set `.tabs a { min-height: var(--size-target); }`, and in `tests/browser/feed-top.test.ts` assert both tabs and Search are at least 48 tall. Check that the sideways hints offset in `Feed.svelte` (`top: calc(0.75rem + var(--size-target) + 0.5rem)`) still clears the taller pill (it assumes a 48px bar; add the pill's 0.25rem padding if not). Only those three files.

## Notes (not blocking, not fixed here)

- N1. At 320px wide the tabs pill touches the speaker and Search by about 5px each side. Below the device matrix today; worth a look if small Android phones join the matrix. R1's fix makes the pill no wider, so it does not get worse.
- N2. A maker who already took the address `following` or `search` before this change would lose their page to the new screens (a fixed route wins over `/[handle=handle]`). Not checkable from here; one query on the live database before merge would settle it: `select handle from "MakerPage" where handle in ('following','search');`.
- N3. `feed-controls.test.ts:809` failed once at the Escape step on computer here, then passed 5 of 5. The change does not touch the sheet or its keys, so it is not counted against this pull request; it should go under "Flaky tests" in `progress.md`.
- N4. Search reads every live game on each search (250ms after the last key) with no rate limit of its own. Fine at today's numbers, as the code's comment says; revisit when the catalogue grows.
- N5. Search's Back always goes to `/`, even when Search was opened from Following. Criterion 6 asks for the feed, so it is met.
