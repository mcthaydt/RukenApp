# Learned feed, unit I (a parent's yes), implementation audit 2

Lane 3 implementation audit, round 2, of pull request #457 at head `157c7c2141f77915bdb2ccff8ad0f3bd6aa0f8b1`, against the learned-feed spec (section 6.5, section 10, unit I) and round 1's findings (`2026-11-28-learned-feed-unit-i-1-implementation-audit.md`, branch `claude/project-thread-tuqyu5`). Opus 5.5, medium. Written 2026-11-28 09:26 UTC.

**Verdict: 157c7c2 FAIL: 3 red.**

## What ran

- `pnpm test:pg` on `parent-asks.pg.test.ts` and `purge.pg.test.ts` (Postgres 16, local): 37 passed.
- Mutation checks. I took each fix out of `src/features/feed/parent-asks.ts` one at a time and ran the pg file again: the own-number check, the teen-number check, the No check and the per-number cap. Each time exactly one test failed, the test written for that fix. With the code as it is, all 17 passed. So each fix has a test that fails without it.
- Browser tests on tablet and computer. Phone was not run, because this container has no WebKit.
  - `fits-the-screen.test.ts` "a teen's Your feed and Ask a parent ... fit the window" passed on both. That includes the new loop with a problem showing at 320×568, 375×667 and 667×375, with Text my parent fully in view.
  - `parent-yes.test.ts` "an ask nobody answers ends after five days" passed.
  - The main CRUD journey failed locally on both at line 102: there was no "More or less like this" button on `/`. The local database had no games, so the feed had no clips. The journey passed in CI at `46f7347`, and the fix commits do not touch that path. CI's run on this head is the evidence for it.
- CI run 46128012519 at this head: verify (lint, typecheck, unit, build) and postgres are green. Browser piece 5 failed on attempt 1 (see R3). Attempt 2 was still running when I wrote this.
- `.eslintcache` is gone from the tree and listed in `.gitignore`. Fixed.

## Round 1 findings

1. **A teen could say Yes to themselves.** Fixed. The teen's own number is refused ("Type your parent's number, not yours."). So is any number on an account that is not a known adult's. In both cases no row is kept and no text goes out. Test: "refuses the teen's own number ...". But the new message for the second case leaks information (R1).
2. **`.eslintcache` was committed.** Fixed.
3. **Ask a parent did not fit with a problem showing.** Fixed. The problem now takes the line under the heading. Below 700 px tall, each label sits beside its field. The test uses the longest problem line, the 61-character bad-number one.

Two round 1 notes are now built: a per-number cap across all teens (`PARENT_ASK_LIMITS`, stand-in 10), and no re-texting a number after a No (per teen). Both are tested and mutation-checked.

## Red findings

### R1. "That number is a teen's" tells any teen account whether a phone number belongs to a minor, and the asking has no limit

- UNIT: `src/features/feed/parent-asks.ts` `ask()`; `src/routes/settings/feed/parent/+page.server.ts` `PROBLEMS["teen-number"]`.
- VERDICT: red.
- REQUIREMENT: spec section 10, "Least data, kept short" and "Teens get a calm feed by default" (nothing personal about an under-18 is read or shown), and spec section 1's failure case for a teen's data.
- REASON: the refusal says the number's holder is a teen. Refused asks keep no row, so they do not count toward the three texts a day. Anyone signed in as a teen can type number after number and learn which ones belong to a Ruken account that is not a known adult's.
- EVIDENCE: `ask()` returns `"teen-number"` before any `parentAsk.create`, and `too-many` counts only `parentAsk` rows. The PR's own test shows it: one teen gets `own-number`, `teen-number`, `teen-number` and then `texted`. That is four tries, and `parentAsk.count` is still 0 after the three refusals. The page then shows "That number is a teen's. Type your parent's number." An account with no known birthday gets the same words, which is also wrong for that person.
- EXPECTED: a refusal never says what kind of account holds the number, and a teen cannot test numbers without limit.
- FIX:
  - Give `teen-number` a message that names no one, such as "We can't text that number. Type your parent's number." `own-number` can stay as it is, since it is the teen's own number.
  - Make every refused number (`own-number`, `teen-number`, `said-no`, `number-busy`) count toward the teen's three a day, for example by keeping a refused try as an ended row or by counting refusals separately.
  - Add a pg test that a fourth refused try in one day returns `too-many`.
  - Files: `parent-asks.ts`, `settings/feed/parent/+page.server.ts`, `parent-asks.pg.test.ts`, and the migration only if a new column is needed.

### R2. `PARENT_ASK_LIMITS` is set up nowhere, so the live site will run on the loose stand-in

- UNIT: `src/features/feed/parent-asks.ts` `STAND_IN_PARENT_ASK_LIMITS`; `.env.example`.
- VERDICT: red.
- REQUIREMENT: round 1's fix ("set by a new Worker secret"); the rule at the top of `.env.example`, "Every setting the app reads"; the spec's "Environments and spend" (secrets are loaded by RukenPrivate's workflow, never by hand).
- REASON: nothing loads or documents the secret. When it is missing, the code falls back to the loose stand-in of 10 texts a day to one number. The live site would run on 10 a day indefinitely, which is the flooding the cap was meant to stop.
- EVIDENCE:
  - On the PR head, `git grep PARENT_ASK_LIMITS` finds it only in `parent-asks.ts`, `services.ts` and the pg test. It is not in `.env.example`, `wrangler.jsonc`, the PR body or any setup note.
  - In RukenPrivate, no branch mentions it. `private-worker.yml` loads `FEED_PUBLIC` into `ruken` and nothing else for the site.
  - The code comment calls the stand-in "deliberately loose ... for dev, the journeys and any moment the secret is missing". Nothing needs it loose: the journeys text one parent number at most twice (`parent-yes.test.ts` uses `freshNumber()`), and the pg tests inject their own limit.
- EXPECTED: a missing or malformed secret gives the safe, strict limit, and the secret is listed for setup.
- FIX:
  - Set the stand-in to a strict number no higher than the teen's own `TEXTS_A_DAY` (3), and keep the pg test of `readParentAskLimits`.
  - Add `PARENT_ASK_LIMITS` to `.env.example` as optional, with a plain line on what it holds and that the real value is a private secret.
  - Say in the PR body that RukenPrivate's workflow must load it into `ruken`. That is a RukenPrivate change, in its own PR.
  - Files: `parent-asks.ts`, `.env.example`, the PR body.

### R3. The CI failure on this head is not recorded under Flaky tests

- UNIT: `docs/superpowers/progress.md`, "Flaky tests".
- VERDICT: red (a standing rule).
- REQUIREMENT: CLAUDE.md, Verification: "A test that fails once and passes on retry is a defect: record it under Flaky tests".
- REASON: in run 46128012519 attempt 1, browser piece 5 (job 140926811825) failed `tests/browser/feed-shortcuts.test.ts:47` "before launch, Enter presses Wishlist where Play goes" [phone]. `POST .../wishlist` answered 404 (line 56). The run was started again (attempt 2), and `progress.md` at this head has no entry for the failure.
- EVIDENCE: `git show 157c7c2:docs/superpowers/progress.md | grep feed-shortcuts` finds only the feature's own row, nothing under Flaky tests. `main` has no entry either.
- Is it related to this PR? No.
  - The PR touches no wishlist, games or play route.
  - The 404 comes from `gameFor()` in `src/routes/g/[game]/wishlist/+server.ts`, which answers 404 when the clip's game is no longer live.
  - The test presses Wishlist on whatever clip comes first in the shared feed. In the same piece, on the other worker, `cli-games.test.ts:96` "a maker's games, from the first command to throwing one away" was running (it is the test that was interrupted).
  - The likely cause is that journey throwing away the game whose clip was on screen. This is likely, not proven.
- EXPECTED: an entry under Flaky tests that names the test, the run and job, the 404 and the likely cause.
- FIX: add that entry to `progress.md` in this PR. File: `docs/superpowers/progress.md`.

## Notes (not blocking)

- The per-number cap locks only the teen's row. Two different teens asking the same number at the same moment can both pass the count, which sends at most one text over the cap. That is fine at these numbers. An advisory lock on the number's hash would close the gap.
- "said-no" applies per teen, as the brief says. Another teen can still ask a parent who said No to the first teen. The per-number cap is what limits that.
- Not run here: the phone (WebKit) profile and the full journey suite. CI covers both.
