# Feed to game slide: review 1 (PR #382)

Commit examined: ca1daebb2e3ea531ff0fab6dc2f922196bcb5f78 (base: main 86dff0d). Lane 1. Reviewed 2026-11-24 04:22 UTC.

**Verdict: ca1daeb PASS, 0 red, 3 notes.**

## What was checked

- **The questions are independent.** Each one in the `Promise.all` in `src/routes/g/[game]/+page.server.ts` reads only `game`, `caller`, `cookies` or `now`; none reads another's answer. All are reads: `isMember` (`premiumMembership.findUnique`), `pageOf` (`makerPage.findUnique`), `moreLiveGamesBy` (`game.findMany`), `screenFor` (cookie read plus `wishlist.slugsOf`), `sittingOf` (`playSession.findMany`), `playersThisWeek` (`playSession.groupBy`), `isKnownAdultCaller`. No write, so the cookie-consent write guard and order of writes do not come in.
- **Cost is unchanged.** `isMember` is still asked only for a signed-in caller who is not the maker, not staff, on a paid game (`ownOrStaff` repeats the two earlier branches), and `member` is only read after the same `own`/`staff`/`free` branches.
- **18+ filter unchanged.** `isKnownAdultCaller` is still asked only when another game is 18+.
- **Errors.** `Promise.all` rejects on the first failure, as the serial code did; it holds a handler on every member, so a second failure is not an unhandled rejection.
- **The Worker's database.** Every query of a request goes to that request's own connection (`src/lib/server/db.ts`, `request.connection ??= connect()`, set synchronously so concurrent first calls share it) and its own DataLoader (`batchPerRequest`), so calls in one tick stay in the request. A pool of `DATABASE_POOL_MAX` (default 3) queues the rest. Parallel reads in a load already exist (`src/routes/api/v1/api.server.ts:102`).
- **Unit test sound.** `tests/routes/g/[game]/page.server.test.ts` passes on the PR and fails (2,000 ms timeout) with main's serial `+page.server.ts` put back: run here.
- **Journey sound.** `tests/browser/feed-to-game-slide.test.ts` wraps `startViewTransition` before load and records `ready` resolving or rejecting, so a slide the browser throws away fails it; it shows ✓ (not skipped) on phone WebKit.
- **Runs here.** `pnpm lint` and `pnpm typecheck` clean; `pnpm test` 2,199 passed. Phone WebKit in `mcr.microsoft.com/playwright:v1.63.0-noble`: feed-to-game-slide, game-page, feed (23 passed); feed-to-game-slide `--repeat-each=5` (5 passed); adults-only, wishlist, maker-page (23 passed).
- **CI.** Quick draft run on ca1daeb green: verify, postgres, browser shards 1 to 6, gate. The full run starts when the PR is marked ready.
- **CRUD.** The change adds nothing a person makes.

## Notes (not blocking)

- N1. UNIT: `src/routes/g/[game]/+page.server.ts`. `moreLiveGamesBy` (and `isKnownAdultCaller` when one is 18+) now runs for a maker with no page, and the answer is thrown away (`makerPage === null ? [] : more`). One wasted read on those pages; the cost of asking at once. Keep unless it shows up in load times.
- N2. UNIT: the unit test. It gates one caller shape (signed in, not a member, paid game, player count on). A future serial await on another path, such as a free game, would not fail it. Fine for this change.
- N3. UNIT: the journey. It checks the slide plays, not how soon; the speed is held by the unit test only.
