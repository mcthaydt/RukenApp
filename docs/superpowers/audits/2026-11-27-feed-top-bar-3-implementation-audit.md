# Feed top bar: implementation audit, round 3

**Verdict: `5416e24` PASS.** No red findings; two notes.

- Pull request: #402 (lane 2). Head examined: `5416e24e883599a0816321ffd742e65518c6bfae`.
- Reviewer: a fresh session, Opus 5.5 medium. Written 2026-11-27 02:59 UTC.
- Previous round: `a4dd09a` PASS (`2026-11-27-feed-top-bar-2-implementation-audit.md`). This round covers what came after it: `471beb0` (search result thumbnails), `b234496` (main merged, progress.md conflict), `effbd74` (tabs renamed Fresh and Followed, `/following` → `/followed`), `5416e24` (live state removed).

## What was checked

| Check | Result | Evidence |
| --- | --- | --- |
| Nothing a person sees still says "Following" or "For you" | PASS | `git grep -i -E "following\|for you"` over `src` and `tests` at the head: the only hits are the owner's 2026-11-22 words quoted in the comments of `FeedTop.svelte:2` and `feed-top.test.ts:10`, plus unrelated sentences ("for your game", "isn't for you yet"). No `/following` path anywhere outside `docs`. `main` never had a `/following` route, so no old address needs to keep working. |
| Route, reserved handle and consent list moved together | PASS | `src/routes/followed/` exists, `src/routes/following/` does not; `RESERVED_HANDLES` has `followed` and `search` (`src/features/pages/handle.ts:43`); the consent `OPEN` list has `/followed` and `/search` (`src/features/consent/routes.ts:19`); the layout's Home mark and its no-wordmark list both use `/followed` (`src/routes/+layout.svelte:30,61`). |
| 48px targets | PASS | Tabs `min-height: var(--size-target)`, Search `width`/`min-height: var(--size-target)`, Search's Back the same, result rows `min-height: var(--size-target)` (games 80px + padding). Measured in `feed-top.test.ts:64-66` (Search width ≥ 48, Fresh and Followed height ≥ 48), passed on phone, tablet and computer in CI. |
| Screens fit, no page scroll | PASS | Search is `position: fixed` with only `.results` scrolling; `feed-top.test.ts:212` checks the page's `scrollHeight` ≤ window height, the results end above the bar, and sideways the rows stay left of the rail: passed on all three profiles. Followed is a centred `min-height: 100dvh` block with short copy. |
| Frosted glass on the floating pieces | PASS | The tab pill and the Search button use `--glass-bg`, `--glass-filter`, `--glass-edge`, `--glass-ink`/`--glass-icon`; the current tab uses `--glass-lift` (`FeedTop.svelte:42-48,64-67,77-82`). Search's own screen is not over video, so its Back sits on felt like other page buttons. |
| Search thumbnails | PASS | `thumbnailOf` builds `/api/still/<key>?at=0&width=240` from the upright clip (`search.ts:41-44`); 240 is the smallest of `STILL_WIDTHS` and the still route accepts it; the feed also starts clips at 0 (`#t=0.001`), so this is the frame the feed opens on. Shown 64×80 with `object-fit: cover`, a 404 hides the image and leaves felt. `feed-top.test.ts:131-135` checks the 64px width and the address; unit tests in `tests/features/feed/search.test.ts` cover a stored clip and one with no still. |
| CRUD | PASS (nothing new to make) | The change adds nothing a person creates: Followed shows a message until Follow exists, and Search only reads. |
| PR body, identity, live file | PASS | Body ends `Requested by **McThayDT**`; no Co-Authored-By, Claude-Session or "Generated with" lines in the branch's commits; no file left in `docs/superpowers/live/`. |
| Lint, typecheck, unit tests on the head | PASS | Run locally at `5416e24`: `pnpm lint` exit 0, `pnpm typecheck` exit 0, `pnpm test` 156 files, 2255 tests passed. |
| CI ran on this head | PASS | Check runs on `5416e24` (run 45930415062, quick draft mode): gate, verify, postgres and browser shards 1–6 all success. Every test in `feed-top.test.ts` (6 tests) passed on phone, tablet and computer. One skip, `feed-to-game-grow.test.ts:231` on phone, comes from `main` (#399's WebKit gap), not this change. |

## Notes (not blocking, not fixed here)

1. UNIT: `src/features/pages/handle.ts`. VERDICT: note. REQUIREMENT: none broken. REASON: `followed` and `search` are now reserved; a maker who already took either as their handle before this merges would have their page shadowed by the new routes. EVIDENCE: not checkable from here (no access to the live database). EXPECTED: no live page uses either handle. FIX: if wanted, one read-only query on the live database for `handle IN ('followed','search')` before or after the merge.
2. UNIT: CI mode. VERDICT: note. REASON: CI on this head ran in quick draft mode; the full run happens once the pull request is marked ready. EXPECTED: the full run is green before the merge, as `release` requires.
