# Followed feed, review 2: implementation audit

- Pull request: #410, branch `claude/project-thread-8e2bwm`
- Commit examined: `c011f8629672a7e91abd5673094f86ceb129c488` (review 1 FAILED at `90c40a5`)
- Lane 2. Reviewer: fresh session, Opus 5.5, medium.
- Verdict: **PASS**, 0 red.

## What ran

- `pnpm lint`: exit 0. `pnpm typecheck`: exit 0. `pnpm test`: 157 files, 2264 of 2264 passed.
- `pnpm test:pg` on Postgres 16 (docker `postgres:16`): 53 files, 798 of 798 passed.
- Browser journeys, run inside the Playwright 1.63.0 image (`mcr.microsoft.com/playwright:v1.63.0-noble`), so the phone ran in real WebKit, on phone, tablet and computer: `feed-top`, `follow-a-maker`, `feed-to-game-grow`, `wishlist`, `bar`, `feed-controls` plus the probe beside this file. 241 passed, 1 skipped, 1 failed: `feed-controls.test.ts:836` "Share › slides up…" [computer], the Share dialog still visible with class `closing` after Escape. It passed on its rerun. It is already listed under "Flaky tests" in `progress.md` (same line, same symptom, seen on #399 and #400); this pull request does not touch the share sheet.
- Not run: the rest of the browser suite (the pull request's full CI run does that).

## Review 1's reds

**R1, Back from a game opened on Followed: fixed.** `src/lib/page-moves.ts` adds `isFeed` (`/` and `/followed`) and uses it in `grownGame` and `noteMove`; `+layout.svelte` uses it for the "to the feed" test and for `data-way="back"`. Evidence:
- The PR's journey (`feed-top.test.ts`, "Followed plays…") opens the game from Followed, presses "Back to the feed" and lands on `/followed` with Followed marked and the same clip current: passed on all three sizes.
- Probe 1 (view transitions watched): opening from Followed and Back by the arrow read `["clip moved move=grow way=-","clip moved move=grow way=back"]` on all three sizes, so the clip grows out and shrinks back in, as from Fresh.
- Probe 3: open, back arrow, open again, browser Back, from `/` and from `/followed`: four moves, each "clip moved", the same on both tabs, all three sizes.
- Unit: `tests/lib/page-moves.test.ts` covers `grownGame` both ways for `/followed` and `isFeed`.

**R2, no-script follow and Wishlist on Followed: fixed.** `Feed.svelte` now passes `back={tab === "followed" ? "/followed" : "/"}` to both. Evidence:
- The PR's journey, with script off, unfollows on `/followed` and stays on `/followed` ("You don't follow anyone yet."): passed on all three sizes.
- Probe 2, before launch and with script off: Wishlist on a Followed clip lands on `/followed` showing "On your wishlist", and pressing it again lands on `/followed` showing Wishlist: passed on all three sizes. The PR has no journey for Wishlist on Followed; the code path is the same prop as follow, so this is a note, not red.

## Review 1's passing points, rechecked

The fix commit touches only `Feed.svelte` (two props), `page-moves.ts`, `+layout.svelte` and two test files. `service.ts`, `Followed.svelte` and the `/followed` route are unchanged since `90c40a5`, so the right makers, the order, the end with no spinner, 18+ left out, and the signed-out, following-nobody and nothing-live states stand, and their journeys passed again. Private ordering is untouched. Fresh's own grow and Back (`feed-to-game-grow`, all tests) and the bar (`bar`) pass, so `isFeed` broke nothing on `/`. A move between the two tabs names no game (`grownGame("/", "/followed")` is null), so it still slides.

## Notes (not blocking)

1. **Main has moved and the branch no longer merges cleanly.** `git merge-tree origin/main c011f86` conflicts in `src/features/feed/service.ts` with #403 (private feed binding, `89caede`): main's `return { page, health }` against this branch's `followedPage` and `clipOf`. Before merging, the implementer merges `main`, keeps both (`return { page, health, followedPage }`), and the merged head needs its own review and green CI; this PASS names `c011f86` only.
2. The PR's journey checks where Back lands, not that the clip moved; probe 1 shows it does. A `watchMoves` check from Followed in `feed-to-game-grow.test.ts` would lock it in.
3. With script off, the game page's back arrow is still the plain link to `/`, even when the game was opened from Followed. Review 1 asked only for the scripted arrow; recorded for later.
4. No cap on how many games Followed loads at once (from review 1, still open).
