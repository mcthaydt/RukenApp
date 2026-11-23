# Test play before approval: implementation audit 2

Re-check of `claude/project-thread-m8mlbc` at **c1868e8**, which fast-forwarded to audit 1's commit de0cc6f and added one fix commit. Reviewer: Opus 5.5, medium, the session that wrote audit 1. Scope: R1 from audit 1, the hover note N3, and anything the fix commit touches.

## Verdict

**c1868e8 PASS: 0 red.**

## The fix commit (de0cc6f..c1868e8)

Five files: `src/routes/make/+page.svelte`, `src/routes/make/[game]/check/+page.svelte` (two buttons), `src/routes/make/parts/WaitingScreen.svelte`, `tests/browser/test-play.test.ts`, `tests/features/games/review.pg.test.ts`. Nothing else changed.

## Findings from audit 1

- **R1 fixed.** The expected row at `tests/features/games/review.pg.test.ts:715` now has `testPlay: true`. `pnpm test:pg` on local Postgres 16: 49 files, 727 tests passed.
- **N3 fixed.** All four Test play links (Your games, Check and send twice, Waiting) carry `data-sveltekit-preload-data="off"`. The journeys now assert that attribute on Your games, Check and send and Waiting before they press.

## What ran at c1868e8

| Check | Result |
| --- | --- |
| `pnpm lint` | exit 0 |
| `pnpm typecheck` | 0 errors (after deleting local build output under `.svelte-kit/` that the earlier browser run left behind and svelte-check had picked up; a clean checkout has none) |
| `pnpm test:pg` | 727 passed |
| `pnpm test:browser tests/browser/test-play.test.ts`, projects tablet and computer | 8 passed |
| Phone (WebKit) and the full browser suite | not run here: CI only, and no pull request exists yet |

The unit suite was not re-run: the fix commit changes no file it reads except the Svelte screens, which the unit checks only scan for class names and loaders, and those lines are unchanged. Audit 1 had 1,892 passed at ad63721.

## Notes still open (from audit 1, not blocking)

- N1: a live game's new files can't be test-played until they are sent for review (an owner question if they want it).
- N2: `testPlay` repeats `reviewLook`.
- N4: no journey checks a staff account by name.
- N5: phone (WebKit) runs only in CI.
