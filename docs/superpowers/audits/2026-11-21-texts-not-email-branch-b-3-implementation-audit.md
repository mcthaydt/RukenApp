# Texts, branch B (sign-up, sign-in and forgot password by phone): implementation audit, cycle 3

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

- Pull request: #209 (draft), branch `claude/project-thread-5pb367`.
- Commit examined: `c343326` ("Give an account made by email its phone number by command, and clear the live-state file"). The review counts only for that commit.
- Re-checks cycle 2 (`2026-11-21-texts-not-email-branch-b-2-implementation-audit.md`, at `61b67b9`, three reds), plus exploratory checks of the new code.
- Measured against: the cycle 2 reds and their fixes, the owner's choice of `POST /jobs/attach-phone` (2026-11-21), `CLAUDE.md`, the `build`, `review` and `this-repo` skills.
- Lane: 3. Model and effort: Opus 5.5, medium.
- Written: 2026-11-21 15:20 UTC (from `date`).

## Verdict

**PASS: 0 red, 7 notes.** All three cycle 2 reds are fixed. `git diff --stat 61b67b9 c343326` touches 8 files: the new route, `attachPhoneToAccount` and its export, its database tests and journey, one journey helper, one doc comment in `money/services.ts`, and the deleted live-state file. Nothing else in the sign-in code moved since cycle 2.

## Reds from cycle 2

| Red | Result | Evidence |
|---|---|---|
| R1: the owner's live email account is locked out | FIXED | `src/routes/jobs/attach-phone/+server.ts` and `attachPhoneToAccount` in `src/features/accounts/staff.ts`. **Auth:** `hasJobSecret` (sha256 then `timingSafeEqual`, no secret set means nobody) runs before the body is read; anything else gets 404. The journey checks no header and a wrong secret both get 404. **Repeat calls:** a second call gets 409 "That account already has a phone number." and changes nothing; the owner steps say that means done. **Takeover:** it never replaces a number an account already has (`has_number`), and never gives a number another account holds (`number_taken`). The password, id, staff role and games stay, and the number isn't marked as confirmed. pg tests cover all five outcomes, including that the role and email survive. The journey covers a number-less account getting its number, then signing in by phone with its old password and seeing the number on `/me`. Sign-in doesn't need the number confirmed: better-auth's `requireVerification` is off (`node_modules/better-auth/dist/plugins/phone-number/routes.mjs:68`), and only `deletion.ts` and `changed-hands.ts` read `phoneNumberVerified` or `phoneConfirmedAt`. `cloudflare/worker.js` doesn't intercept the path. |
| R2: live-state file still on the branch | FIXED | `docs/superpowers/live/claude-project-thread-5pb367.md` is deleted at `c343326` (`git ls-tree c343326 docs/superpowers/live/` is empty). The owner steps are in project files at `owner-steps/2026-11-21-phone-sign-in-steps.md`, and they match the route's answers word for word. |
| R3: PR body doesn't name changed tests | FIXED | The body lists the deleted, added, rewritten and re-asserted tests against `main`, says why for each group, and names `c343326` as the commit it ran on, with an honest "What did not run" list. Its last line is "Requested by **McThayDT**". |

## Checks run on `c343326`

| Check | Result | Evidence |
|---|---|---|
| `pnpm lint` | PASS | exit 0 (cloud container, Node 22.23.5, pnpm 10.34.6). |
| `pnpm typecheck` | PASS | 1943 files, 0 errors, 0 warnings. |
| `pnpm test` | PASS | 116 files, 1739 tests. |
| `pnpm test:pg` | PASS | 47 files, 702 tests (cycle 2 had 696; the 6 new ones are `attachPhoneToAccount`), on a fresh Postgres 16 database. |
| Journeys `attach-phone`, `first-owner`, `sign-in` | PASS on tablet and computer (Chromium) | 31 passed. The `phone` project (WebKit) didn't start: the container has no WebKit (`Executable doesn't exist at /opt/pw-browsers/webkit-2359`). That's 11 failed to launch, none failed a step. |
| CI on `c343326` | not finished at 15:20 UTC | `verify`, `postgres`, `commit-authors`, `what changed` and `which screens changed` passed. The six browser pieces were queued or running. The full (ready) run hasn't run. |

## Notes (not blocking; follow-ups, not fixed here)

1. UNIT: `attachPhoneToAccount`. VERDICT: note. REASON: it doesn't check `User.status`, so a deleted account's tombstone (email `deleted-<id>@deleted.invalid`, no number) can be given a number. That number then can't be used to sign up. EVIDENCE: the `findFirst` in `staff.ts` filters only on email, and `deletion.ts:157-168` clears the number. EXPECTED: only an `active` account matches, and anything else gets "No account has that email." FIX: add `status: "active"` to the `where` clause, plus one pg test. Files: `staff.ts`, `staff.pg.test.ts`.
2. UNIT: the route. VERDICT: note. REASON: the route is for one use but stays live, so a leaked `JOBS_SECRET` now also lets someone take over an account: give any number-less account their own number, then reset its password by text. Before this, the secret could only run jobs and grant a first owner while there was none. EXPECTED: it can't be used once its job is done. FIX (owner's call, later): remove the route in a follow-up after the owner runs step 2, or have it refuse once no active account is left without a number. I didn't check how many number-less accounts the live database has.
3. UNIT: `attachPhoneToAccount`. VERDICT: note. REASON: two calls at the same moment with the same number both pass the `number_taken` check. One write then hits `User_phoneNumber_key` and comes back as a 500 instead of a 409. No data goes wrong. FIX: catch P2002 and return `number_taken`.
4. UNIT: `tests/browser/support/database.ts` `makeItAnOldAccount`. VERDICT: note. REASON: it clears only `phoneNumber`, so the journey's "old account" still has its number marked verified and a confirmation time, unlike the live account. The pg test makes a truly old account, and sign-in reads neither field (R1 row), so the journey's result still holds.
5. UNIT: forgot password for the attached account. VERDICT: note. REASON: the account has no `phoneConfirmedAt` and no `paperEmail`. If Twilio can't tell whether the number changed hands and the account has money booked, `resetChannel` answers "help". The owner signs in with their old password, so this doesn't block them. It only matters if they forget it.
6. UNIT: `src/features/money/services.ts`. VERDICT: note. REASON: a one-line doc comment fix there isn't named in the PR body. It's accurate: `hasBeenPaid` counts only `journalLine.makerUserId`.
7. UNIT: process. VERDICT: note. The `phone` (WebKit) journeys and CI's browser pieces on `c343326` hadn't finished when this was written. Merge still waits on green CI for its lane.
