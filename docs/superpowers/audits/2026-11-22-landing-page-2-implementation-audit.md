# Landing page, implementation audit 2

Reviewed: `3b013c7` on `claude/project-thread-2vpwcj` (the fix for audit 1 at `3603d00`, fast-forwarded onto audit 1's commit `eea847c`). Lane 2 re-check of the fix round, 2026-11-22 15:12 UTC.

**Verdict: PASS.**

## Audit 1's reds

- R1, PASS. `src/routes/about/sections.ts:43` now says "See one you like? Members tap Play, and they're in the game." and `:76` "Members tap Play and the game starts in the browser. Nothing to install." This matches `src/routes/g/[game]/play/+page.server.ts:35` (a non-member goes to `/join`) and the game page's "Members play every game." No other "Tap Play" claim is left for a stranger (grep of `sections.ts`; the steps line keeps "Members play every game.").
- R2, PASS. `sections.ts` now says "Send your game from GitHub in six short questions." This matches `src/routes/make/new/+page.svelte` (`counter={{ n: 1, of: 6 }}`).

## Scope

`git diff eea847c 3b013c7`: one file, `src/routes/about/sections.ts`, 3 lines changed, words only. `3b013c7` descends from `eea847c`, so audit 1 travels with the branch.

## Checks run here at 3b013c7

- `tests/lib/look.test.ts` and `tests/loading-states.test.ts`: 143 of 143 passed.
- `tests/browser/about.test.ts` on computer and tablet: 8 of 8 passed (local Postgres 16, `--trace off`). Phone (WebKit) not run here; CI runs it.

## Still open (from audit 1, not blocking)

- N1: the app-feel and frosted-glass rules are not on `main` yet; re-check `/about` when they merge.
- N3: CI has not run (no pull request yet).
