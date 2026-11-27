# Feed top bar (#402): implementation audit, round 2

Reviewed commit: `a4dd09addede8307399d8025ffe9ca466f4a92df` (`a4dd09a`; the fix is `1183b25`), branch `claude/project-thread-8e2bwm`, against `main` at `16f8996`.
Lane 2, short path. Brief: the pull request's ten acceptance criteria and the owner's standing rules. Round 1: FAIL at `691c7db`, 1 red (R1, tabs 44px), `docs/superpowers/audits/2026-11-27-feed-top-bar-1-implementation-audit.md` on `claude/project-thread-gvllcj`.
Reviewer: a fresh session, Opus 5.5, medium. Written 2026-11-27 02:09 UTC.

**Verdict: PASS, 0 red.**

## What ran

- `pnpm lint`, `pnpm typecheck`: pass. `pnpm test`: 156 files, 2,254 tests pass.
- Journeys on tablet and computer (this container has no WebKit, so the phone did not run here; the WebKit warm-up was left out of a local copy of the config, not committed): `feed-top`, `feed-controls`, `real-buttons`, `loading`, `glass`. 135 of 136 passed. The one failure was `feed-controls.test.ts:836` (Share slides up and fades in…) on tablet, at line 882 (`sheet` not hidden); alone it then passed 5 of 5. See N6.
- A probe (not committed), Chromium, measured the top bar:

| Window | Sound | For you | Following | Pill | Search | Sideways hints `top` |
| --- | --- | --- | --- | --- | --- | --- |
| 375×667 | x 12–60, h 48 | x 84.8, h 48 | x 179.3, h 48 | x 82.8–292.2, y 12–64 | x 315–363, h 48 | (upright: 38%) |
| 667×375 | x 12–60 | h 48 | h 48 | x 228.8–438.2, y 12–64 | x 597–645 | 72px |
| 1280×720 | x 12–60 | h 48 | h 48 | x 535.3–744.7 | x 1220–1268 | (upright) |

- `git merge-tree pr402 origin/main`: the code merges cleanly (`+layout.svelte` keeps both this change and #399's `data-way` lines); only `docs/superpowers/progress.md` conflicts. See N7.

## R1 from round 1

Fixed. `FeedTop.svelte` `.tabs a { min-height: var(--size-target); }` (48px, `look.css:103`); both tabs measure 48 tall at every size above, the pill 52. The journey now asserts For you, Following and Search are each at least 48 (`feed-top.test.ts:63–65`), and it passes on tablet and computer. The sideways hints moved to `calc(0.75rem + var(--size-target) + 0.25rem + 0.5rem)` = 72px, under the pill's bottom edge at 64px, so they still clear it by 8px.

## Criteria, re-checked on the whole change

1. Glass top bar, marks, no overlap upright and sideways: met (probe; glass tokens with both `backdrop-filter`s and `--glass-edge`; `glass` journeys pass).
2. Following slides on, For you slides back, Home marked on both: met (`+layout.svelte` marks Home on `/following`; journey).
3. Following's two empty states and their buttons: met (`Following.svelte`; journey).
4. Search as the person types (250ms), games by name then line or maker, makers by name or @address, case and accents ignored: met (`search.ts` `plainWords`, `matchRank`, name ranks 0–2, the rest 3–5; unit tests and journey).
5. No 18+ game, no maker of only one; empty and nothing-found words: met (makers are built only from the filtered games).
6. No script, address in step with `replace: true`, Back to the feed: met (journey).
7. Fits the window, only the results scroll, clear of the bar upright and sideways: met (journey; `.results` scrolls in its own view).
8. Keyboard alone, focus visible: met (journeys; the changed Tab-order check in `feed-controls.test.ts` is named and explained in the body).
9. `following` and `search` reserved; both routes open in the cookie list: met. See N2.
10. No dependency, nothing kept, CRUD: met. Search and Following only read.

Owner rules: frosted glass on the floating pill and Search; Search's own screen is solid felt, which is right for a full screen. Own icon, browser's search cross hidden. Nothing underlined (`real-buttons` passes here). No new loader: Search's waits are page moves under the shared 2-second spinner. Landing page line added in `sections.ts`. Plain words throughout.

## Findings

None red.

## Notes (not blocking, not fixed here)

- N1 (carried). At 320px wide the pill touches the speaker and Search by about 5px each side; below the device matrix.
- N2 (carried, still open). Whether a maker already holds the address `following` or `search` was **not** settled: this container has no connection or credentials for the live database, and the repo documents no read-only path to it (`verify` says never to touch the test site's database either). The table is `MakerPage` (no `@@map` in `prisma/schema/pages.prisma`), so the query is `select handle from "MakerPage" where handle in ('following','search');`. Someone with read access runs it before merge; one row means that maker loses their page to the new screens.
- N4 (carried). Search reads every live game on each search with no rate limit of its own.
- N5 (carried). Search's Back always goes to `/`, even from Following; criterion 6 asks for the feed.
- N6. `feed-controls.test.ts:836` "slides up and fades in, and slides away when it closes…" [tablet] failed once here at line 882, then passed 5 of 5. The change does not touch the share sheet. Belongs under "Flaky tests" in `progress.md`.
- N7. The branch is behind `main` (#399, #401) and conflicts in `progress.md` only. The owner's rule (2026-11-22 21:42 UTC) is merge `main`, then a fresh review of that head, so this PASS covers `a4dd09a` and goes stale at the merge commit.
- N8. The pill is 52 tall and Search 48, both from `top: 0`, so Search's middle sits 2px above the pill's. Cosmetic.
