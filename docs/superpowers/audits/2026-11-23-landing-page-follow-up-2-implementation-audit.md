# Landing page follow-up (#369): implementation audit, round 2

Examined: `e99744c` (head of `claude/project-thread-2vpwcj`, on main at `509aa6e`). Lane 2, one fresh review. Reviewer: Opus 5.5, medium. Written 2026-11-23 16:04 UTC (time from `date`). Round 1: `3d5f23f` FAIL, 3 red (`2026-11-23-landing-page-follow-up-1-implementation-audit.md`).

**Verdict: `e99744c` PASS.**

## What changed since round 1

`git diff 3d5f23f e99744c`: only `src/routes/about/motion.ts` and `tests/browser/about.test.ts` (plus the live-state file added and removed).

## Round 1 findings

1. **Jump check failed on WebKit's `-0`. Fixed.** `about.test.ts:182-185` now polls `Math.abs(top) < 1` and checks it again after a second. CI job 137819489409 (shard 2, quick draft, at `e99744c`): `[phone] about.test.ts:169` passed, with every other phone `about` journey. With `motion.ts` from `509aa6e`, the journey still fails on computer: `Expected: < 1, Received: 23.765625`.
2. **Rise lost on `#fans`, `#safe`, `#pay`. Fixed.** `motion.ts:36-44` builds the set of ids from `.ways a[href^='#']` (`TOP_LINKS`: `#players`, `#makers`; the Sign in link is not a `#` link) and gives `y: 0` only to those. The new journey `about.test.ts:213` reads each block's start offset at 375x667: `#makers` and `#players` 0, the three bands above 0. Revert-checked: with `motion.ts` from `3d5f23f` it fails on tablet and computer (`#fans` received 0); with `motion.ts` from `509aa6e` it fails on computer (`#makers` received 24). Passes at `e99744c` on tablet, computer and phone (CI).
3. **Body missing attribution line. Fixed.** `gh api repos/mcthaydt/RukenApp/pulls/369 --jq .body`: line 1 is `<!-- claude-projects-attribution: {"github_login":"mcthaydt"} -->`, line 2 the Requested-by thread line, last line `Requested by **McThayDT**`. "## Lane", "## Acceptance criteria" and "## Changed tests" present; the new journey and the loosened-to-a-pixel jump check are both named under Changed tests.

## What ran

- `pnpm lint`: exit 0. `pnpm typecheck`: 0 errors, 2,221 files. `pnpm test`: 149 files, 2,162 passed.
- `tests/browser/about.test.ts` on tablet and computer (Chromium, local Postgres 16): 24 passed.
- Revert checks above (`motion.ts` from `3d5f23f`, then from `509aa6e`), restored after.
- PR CI at `e99744c` when written: verify, postgres, commit-authors, pr-rules-run and browser shard 2 passed; shards 1, 3-6 still running. `edit-page.test.ts:278` [phone] is a known flake owned elsewhere and is not judged here.
- Phone (WebKit) not run locally: the container has no WebKit; CI's result is used.

## Notes (not blocking)

- Main has moved to `583661f` since this branch's base `509aa6e`. Merging main in before the merge makes this verdict stale, as usual; re-point it then.
- The new journey's `0` checks for `#makers`/`#players` would also hold if those cards were never animated; the band check and the jump journey are what prove the behaviour, and both fail on the old motion.
- CRUD: the change makes nothing a person can save.
