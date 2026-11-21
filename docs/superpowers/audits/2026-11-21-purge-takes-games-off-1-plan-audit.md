# Plan audit 1: a deleted maker's games come off Ruken

- Examined: `docs/superpowers/specs/2026-11-21-purge-takes-games-off-design.md` at **2ffdcd1** (branch `claude/project-thread-vhfmo8`, PR #268), with the code it describes (`src/features/accounts/deletion.ts`, `tests/features/accounts/purge.pg.test.ts`, already on the branch at 30975cc and unchanged since) and the agreement in #269's spec (`docs/superpowers/specs/2026-11-21-everything-editable-design.md` at c90a939, section 5.5).
- Lane 3. Reviewer: Opus 5.5, medium. Read only: no test was run (no Postgres in this container); every finding below is from the code and the schema.
- Prompt: Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## Verdict

**2ffdcd1 FAIL: 1 red.** The state changes are right and safe, and a run repeated after a failure finishes the job, but one account that fails stops the whole day's purge for everyone after it, and keeps stopping it every day.

## Red

### R1. One failing account stops every other account's purge, every day

- UNIT: `purgeDueAccounts` in `src/features/accounts/deletion.ts`, and the plan's "How" and acceptance criteria.
- VERDICT: red.
- REQUIREMENT: the coordinator's brief for this audit ("a failure on one account can't stop the whole run"), and the function's own promise at lines 96 to 97: "Each account is finished in a transaction of its own, so one that fails leaves the others done."
- REASON: the loop (line 112) awaits the bucket deletes (lines 118, 123, 124) and the transaction (line 127) with no `try`/`catch`, so the first throw leaves the function and every account after it in `due` is skipped. `due` has no `orderBy`, so nothing stops the same failing account from coming first again tomorrow: it can block every purge from then on. The plan adds new ways to throw per account: two `deleteAll` calls per game (each a list and a delete in R2), a per-game `update` (slug unique index, `Game_answered_check`), and, once #269 lands, `Game_held_check`. The plan says "If the transaction fails, the request stays open and the next run repeats both steps" but never says what happens to the other accounts in that run.
- EVIDENCE: `deletion.ts:112-165` (one bare `for` loop); `src/routes/jobs/purge-accounts/+server.ts:13` (no catch: the job answers 500); `cloudflare/worker.js:25-27` (a non-200 is reported as a failed run, so it is visible, but nothing finishes the other accounts). `purge.pg.test.ts` has no test where one account's purge throws.
- EXPECTED: an account whose bucket delete or transaction throws is left open (its request not purged) and the run goes on to the next account; the run still reports the failure (for example, answers how many failed so the job's address answers non-200, or logs and re-throws after the loop) so the daily run still shows as failed in Cloudflare. A later run finishes the failed account.
- FIX: in the plan, add this to "How" and add an acceptance criterion: a pg test with two due accounts, where the stand-in bucket throws on the first one's `files/<publicId>/` prefix; after the run the second account is purged (tombstone, games taken off) and the first is untouched and still open; the run reports one failure; a second run with a working bucket finishes the first. The second half also pins the plan's idempotency claim, which no criterion checks today. Code: wrap the body of the loop in `deletion.ts` in a per-account `try`/`catch`, and report the failures from `purgeDueAccounts` and the job route. Files: `src/features/accounts/deletion.ts`, `src/routes/jobs/purge-accounts/+server.ts` (if the answer changes), `tests/features/accounts/purge.pg.test.ts`, the spec.

## What was checked and holds

- **States match the maker's own buttons.** The live/waiting update sets the same columns as `takeOff` (`service.ts:870-886`); the draft/sent-back update sets the same as `throwAway` (`service.ts:925-944`), slug `x-<publicId>` (12 characters, passes `Game_slug_check`, unique because `publicId` is). A waiting game moving to `taken_off` passes `Game_answered_check` (waiting already needs every answer) and `Game_live_check`. Drafts go to `thrown_away`, which needs no answers: right, since `taken_off` would fail `Game_answered_check` for an unanswered draft.
- **Staff queue and decision days.** `waitingGames` reads `pendingPullId: { not: null }` (`service.ts:962`), cleared here, so the game leaves the staff list. A held yes for a coming decision day lapses because `lapsed()` (`service.ts:219-228`) is true when the state is no longer `waiting`; `sendOutDecisionDays` records it as `lapsed` and never makes it live.
- **Deleting `GameClip` rows is safe.** Nothing has a foreign key to `GameClip` (`prisma/schema/games.prisma:168-182`; no other model references it).
- **A returning maker loses nothing.** `findMany` reads only requests with `purgeAfter <= now`, and `restoreOnSignIn` cancels only when `purgeAfter > now`, so a request the job has picked can never be cancelled under it. At 13 days nothing changes (criterion 1).
- **Bucket before database, repeat-safe.** `deleteAll` of an empty prefix is a no-op (`r2-store.ts:33-47`); a run after a failed transaction finds the request still open (`purgedAt` null) and repeats both steps; the claim (`updateMany ... purgedAt: null`) stops two runs at once from both finishing an account. Two runs both deleting files first is harmless.
- **Agreement with #269.** Section 5.5 of #269's spec (c90a939) says the same thing as this plan: whichever merges second carries the clearing of `heldAgeRating`, `heldContentMarks` and `GameHeldClip` rows and criterion A11, and held files share `clips/<publicId>/`, so this plan's bucket step already removes them. `main` never holds `Game_held_check` and this purge without the clearing, provided the coordinator's progress.md handoff is kept.
- **Owner decisions.** Games off with the account (14:26 UTC) and videos deleted too (14:58 UTC) are both recorded in the spec at 2ffdcd1.

## Notes (not blocking)

- N1. A `taken_down` game's video rows and files are also deleted. Today nothing puts a taken-down game back (`taken_down` appears only in `review.ts` wording), so nothing breaks; if slice 4 adds a staff "put back", it will meet a game with no videos.
- N2. A pg test for a waiting game with a held yes, purged before its decision day, would pin the lapse described above (today it follows from `lapsed()` alone).
- N3. All accounts run in one request of the site Worker. Each game costs at least four R2 calls; a maker with many games, or many accounts due on one day, adds up. Worth a look if the Worker's per-request limits are ever met; not a defect at today's size.
