# Implementation audit 1: the feed's simple order (PR #248, unit C tasks 2, 3, 5)

Examined: `6cab910` (lane 2). Spec: `docs/superpowers/specs/2026-11-21-feed-and-makers-page-design.md`, unit C (C3, C4, C6) and section 8.

Verdict: **6cab910 FAIL: 2 red**

## What ran, on 6cab910

- `pnpm lint`: pass (0 lint errors, Prettier clean). `pnpm typecheck`: its output ended in the wrangler type step with no error line; not read as a pass on its own.
- Vitest (unit): `tests/features/feed`, `tests/lib/random.test.ts`, `tests/architecture.test.ts`: 21 passed.
- Vitest (postgres 16 local): `tests/features/play/sessions.pg.test.ts`, `tests/features/games/service.pg.test.ts`, `tests/features/pages`: 132 passed.
- Mutation: removed the `s."startedAt" >= ${earliestStart}` line from `memberBeatsByGame`; all 28 tests in `sessions.pg.test.ts` still passed.
- Not run: the browser journeys (this PR changes no screen), CI on the PR.

## Checked and fine

- C3 query reads member sessions only, attentive beats only, both ends of the window, one query, `GROUP BY` game, `COUNT` converted from bigint; the code comment no longer claims an index on game and start, as agreed.
- C4 `seededNumber` is FNV-1a over UTF-8 of `seed + "\n" + key`; fixed values are pinned; `feedOrder` does not change its input, splits new/rest at exactly seven days, ties by seed then id.
- C6 `feed()` leaves out `age_18` before the cut, cuts to `FEED_MAX` before asking for makers, uses `chicagoDayOf` of the injected clock, returns `[]` for no games. `LiveGame.ageRating` is not null, so no unrated game slips past the 18+ filter. `feed` imports its neighbours through entry files; the layer test passes.
- No live-state file is left on the branch.

## Findings

UNIT: `tests/features/play/sessions.pg.test.ts` (`memberBeatsByGame`), `src/features/play/sessions.ts`
VERDICT: red
REQUIREMENT: C3: "reads only sessions started at or after `since` less `PLAY_SESSION_LIFE_MS`"; the agreed correction says that bound must stay.
REASON: nothing fails if the bound is removed.
EVIDENCE: with the `startedAt >= earliestStart` line replaced by `TRUE`, all 28 tests in the file pass. The third test uses sessions started 7 days 2 hours and 7 days 5 hours back, both inside the bound.
EXPECTED: a test that fails without the bound.
FIX: add one case to `memberBeatsByGame`: a session started more than a day before `since` (for example 9 days back) with a beat inside the window is not counted, next to one started just inside the bound that is. Touch only `tests/features/play/sessions.pg.test.ts`. Check by repeating the mutation above: it must now fail.

UNIT: `docs/superpowers/specs/2026-11-21-feed-and-makers-page-design.md`
VERDICT: red
REQUIREMENT: this PR's purpose, to record the owner's three answers; section 8 now says they are answered.
REASON: the spec still says in other places that the work waits on them.
EVIDENCE: line 192 (unit C row) says "nothing; tasks 2, 3 and 5 wait on **Open 3**"; line 195 (unit D) and line 196 (unit I) still list Open 3 and Open 2 as what they wait on; lines 40 and 41 say "Not built unless the Owner says keep it" and "Open 2" as if still open; line 59 says the interim order "ships only on the Owner's yes (**Open 3**)".
EXPECTED: one reading of the spec: answered, so nothing waits.
FIX: change those lines to say the Owner answered on 2026-11-21 (drop the "wait" and "only on the yes" wording, keep the Open labels as history). Touch only the spec.

## Notes (not blocking)

- `playersThisWeek` counts `member` and `free_game` plays, `memberBeatsByGame` counts `member` only, as C3 says. The feed therefore ranks free games by nothing but age. Recorded for the learned-feed spec, not changed here.
- The "ties" test in `order.test.ts` has a comment about "equal hashes of nothing else" that is hard to read; wording only.
