# Feed clip grows into the game page: implementation audit 2 (PR #393, lane 2)

Commit examined: 57173ff6b59ea3de9db031340a9e42ffa1b3dc41. That is fix commit 46d7c80 plus main merged in (b7fd0f9, bringing #390 and #391). Reviewed 2026-11-24 15:37 UTC. This audit re-checks R1 and R2 from audit 1 (21b47c6) and the code the fix touched.

**Verdict: 57173ff PASS, 0 red, 2 notes.**

## R1: Back shrinks the clip into the feed every time. Fixed.

- `slideWhile` no longer names the feed's clip once and gives up. In the update callback it now looks for it for up to 12 tries, 16 ms apart, through `arrivedClip` in `src/lib/page-moves.ts`. The feed puts its place back through its snapshot: `returnTo` sets `current` after a `tick()` (`src/features/feed/Feed.svelte`), not through the IntersectionObserver, so the clip carries `data-grows` well inside that wait.
- Phone WebKit in `mcr.microsoft.com/playwright:v1.63.0-noble` ran `tests/browser/feed-to-game-grow.test.ts --repeat-each=15`: 60 passed. The Back test passed 15 of 15, where audit 1 saw 3 failures in 11 runs.

## R2: only Back to the feed the game came from grows. Fixed.

- `clipMoves(game, toFeed, wentBack)` lets a move to the feed grow only when it is a Back and the game is the one `noteMove` recorded as opened from the feed's clip. Arriving on the feed clears that record. `+layout.svelte` calls `noteMove` before the reduced-motion and no-view-transition early returns, so the record stays right whichever way the move is drawn.
- The new journey "a game's page opened another way slides back to the feed, with no clip moving" opens `/g/<slug>` directly, presses Home, and expects `data-move="back"`, the moves `["played"]`, and no name left. It passed 15 of 15 on phone WebKit. The unit cases in `tests/lib/page-moves.test.ts` cover Back only, the right game only, forgetting the game on the feed, and keeping it through the play screen.
- Audit 1's N2 is fixed along the way: each move tags the elements it names (`data-named`) and only clears its own, so a late `finished` cannot take a later move's name.

## Other runs

- `pnpm lint` and `pnpm typecheck` are clean. `pnpm test` passed: 2,227 tests in 154 files.
- Phone WebKit: page-moves, game-page, feed and feed-controls all passed (58).
- CI quick draft run on 57173ff is green: verify, postgres, browser shards 1 to 6, gate. The full run starts when the PR is marked ready.
- Main's merge (#390 spinners only, #391 share sheet slide) is outside this change's scope. Its touched journeys (feed-controls Share, loading) passed in the quick CI and in the runs above where they overlap.

## Notes (not blocking)

- N1 (from audit 1, still open). No journey runs without view transitions, since every profile has them. By reading, the layout returns before any name is set.
- N2. A move that `heldMove()` takes over (Back pressed mid-move) returns before `noteMove`, so `openedFromFeed` can outlast a return to the feed. For that to show, the person would need to reach the same game's page another way and then press the browser's Back straight to the feed, which their history order makes unlikely. At worst they see one fade with the clip and no partner. Found by reading.
