# Implementation audit 1: two more flaky journeys (#304)

- Commit examined: `630618c` (branch `claude/project-thread-4625xg`), against `main` at `e172f2a`.
- Lane 2: `tests/browser/support/account.ts` is shared by every journey that signs up. One fresh review, Opus 5.5 medium.
- Written 2026-11-22 05:32 UTC.

## Verdict

PASS: 0 red, 3 notes.

## What was checked, and what it showed

1. **Scope.** `git diff origin/main...630618c --stat` shows four files: `progress.md`, `tests/browser/edit-page.test.ts`, `tests/browser/support/account.ts` and the new `tests/journey-numbers.test.ts`.
   - There is no app code, config or CI change.
   - No retry, sleep, `waitForTimeout`, skip or wider timeout was added.
   - Every existing journey check is unchanged.
2. **`edit-page.test.ts:80`, the "Show" fix: the cause holds.**
   - "Show" is a plain form post (`formaction="?/show"` in `src/routes/make/page/links/+page.svelte`).
   - The row's " · Hidden" comes from the server's `link.hidden`, with no optimistic update.
   - So `expect(rows.nth(0)).not.toContainText("Hidden")` waits for the site's saved answer before the `goto`. That is a wait on readiness, the same as "Hide" two lines above.
   - Not reproduced here: the failure was in WebKit, which this container lacks.
3. **`make-game-crud.test.ts:20`, the phone-number fix: the cause is recorded honestly as likely.**
   - `src/features/accounts/auth.ts` (`sendSignUpCode`, around line 104) sends no code to a number that already has an account, so a repeated number fails a sign-up.
   - `freshNumber` now gives worker `TEST_PARALLEL_INDEX % 8` its own hundred area codes (200 + worker × 100 …). It keeps a per-worker set, so one worker process never hands out a number twice.
   - The Flaky tests entry says plainly that the error text was lost and the failure was not reproduced, so the fix is tied to the likely cause, not to that run. That matches what the evidence supports.
4. **The new unit test fails by itself on the old helper.** `main`'s `account.ts` was put in place temporarily and `pnpm exec vitest run tests/journey-numbers.test.ts` was run. Both tests failed: "expected 49780 to be 50000", and `+17375556328` falls outside worker 3's area codes. On `630618c` both pass. The file was restored and `git status` is clean. Criterion 1 is met.
5. **Checks on `630618c`.**
   - `pnpm lint`: 0.
   - `pnpm typecheck`: 0 (2012 files, 0 errors, 0 warnings).
   - `pnpm test`: 1853 passed.
6. **Journeys, on a fresh database, on computer and tablet:** `edit-page`, `make-game-crud`, `pay` and `join` gave **60 passed, 0 failed** (2.1 min).
7. **`progress.md`.**
   - The typed-before-alive entry now says the email screen went with #209. That closes audit 3's note N5 on #293.
   - The two new flaky entries give run, commit, cause and fix.
   - The hook follow-ups and the owner's 04:53 UTC Notion instruction are recorded.
   - The table row for #293 says "merged as `e172f2a`", and `git log origin/main` agrees.

## Not run

- The phone (WebKit) profile is not in this container, so CI's full run covers it. That includes the "Show" fix, which was for a WebKit run.
- The full journey suite: only the four files above ran here. The builder reports 1,076 passed at `a942d54`.

## Notes (not blocking, not fixed here)

- **N1. After a failure, a replacement worker can reuse numbers from that run.**
  - When a test fails, Playwright starts a new worker process with the same `TEST_PARALLEL_INDEX`.
  - The new process starts with an empty `numbersHandedOut` set, so it can draw a number its predecessor already gave an account on the same database.
  - The space per worker is 780,000 numbers, so the chance is small (around 1 in 100 for about 100 draws on each side). It also only arises after a failure has already happened.
  - If it ever matters, a fix would be to check the database for the number before handing it out.
- **N2. The `% 8` split holds only up to eight workers.**
  - `playwright.config.ts` sets no `workers`, so the count follows the machine's cores.
  - With more than eight workers, two of them share area codes, and those two could repeat each other's numbers.
  - CI's four-core runners and this container are well under eight.
- **N3. #304 needs an integration before merge.** `main` is now `f16ca91`, ahead of the `e172f2a` this branch sits on.
