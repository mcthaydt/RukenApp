# Texts, branch B (sign-up, sign-in and forgot password by phone): implementation audit, cycle 2

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

- Pull request: #209 (draft), branch `claude/project-thread-5pb367`.
- Commit examined: `61b67b9` ("Bring main into the phone sign-in branch"), with `main` at `ef720a9` merged in (`git merge-base` is `ef720a9`). The review counts only for that commit.
- Measured against: the spec `docs/superpowers/specs/2026-11-15-texts-not-email-design.md` (the plan `docs/superpowers/plans/2026-11-15-texts-not-email.md` was deleted on `main` by `2f1bde5`, so its criteria are read through cycle 1's audit, `2026-11-20-texts-not-email-branch-b-1-implementation-audit.md`), `CLAUDE.md`, the `build`, `review` and `this-repo` skills, and the owner's standing instructions in project memory.
- Lane: 3 (a migration, `src/features/membership/`, `src/features/money/`). Model and effort: Opus 5.5, medium.
- Written: 2026-11-21 14:50 UTC (from `date`).

## Verdict

**FAIL: 3 red, 8 notes.** The sign-in code itself holds up: since cycle 1's last re-check (`d0c8353`) the branch's own source changed in one file (`phone.ts`, a North American number must be ten digits after the 1), and every merge from `main` left the accounts, sign-up, sign-in, forgot-password, membership, money and schema files as they were (`git diff --stat d0c8353 61b67b9` over those paths lists only `phone.ts` and `main`'s own files). Every check ran green, and the sign-up, sign-in and forgot-password journeys work when walked like a person.

The blocking red is new facts, not new code: the live site now has a real account made by email (the owner's), which is staff and is Floor Fifty's maker. After this merges and deploys, that account cannot sign in by any path, and the owner's step X8 (`first-owner` by phone) answers "There is already a staff account.", which the steps call done. The other two reds are the branch's paperwork: the live-state file is still on the branch and stale, and the pull request body does not name the tests it changes.

## What was checked, and how

| Check | Result | Evidence |
|---|---|---|
| `pnpm lint` | PASS | exit 0, at `61b67b9`, in a cloud container (Node 22.23.5, pnpm 10.34.6). |
| `pnpm typecheck` | PASS | exit 0: 1940 files, 0 errors, 0 warnings. |
| `pnpm test` | PASS | 116 files, 1739 tests passed. |
| `pnpm test:pg` | PASS | 47 files, 696 tests passed, on the container's Postgres 16 (a fresh `ruken_test` database). |
| `pnpm build` | PASS | exit 0. |
| CI quick draft run on `61b67b9` | PASS | `gate`, `verify`, `postgres`, six browser shards, `browser`, `which screens changed`, `commit-authors`: all `success` (check runs on the commit). The full run (ready pull request) has not run. |
| `verify` skill, as edited by this branch | PASS | Started it exactly as written (Node 24 from `/opt/node24`): READY. Its walk script ran to the end (exit 0): home, then sign-up by phone with the stand-in's code, landing on `/me`. |
| Journeys walked like a person, phone size (375 by 667) | PASS | Sign-up with a wrong code first ("That code isn't right. Check the text, or ask for a new one."), then the right code, lands on `/me` showing "+1 312 555 3632". Sign out; sign in with a wrong password ("That number and password don't match. Try again, or reset your password."), then the right one, lands on `/me`. Forgot password: the code screen reads "If that number has a Ruken account, we sent a code. It may come by text, or to the email you pay with."; the code from the stand-in and a new password typed twice lead to "Your password is updated. Sign in with it."; the old password is refused and the new one signs in. |
| `verify` from `main` | not run as a pass | `main`'s walk signs up by email, which this branch removes on purpose (the PR body names the edit), so it cannot pass here. The branch's own walk above is the run that counts. |
| Branch's own source since cycle 1 | read | Own commits since `d0c8353` without merges: `ec74922` (verify skill, live state), `0d55d14`, `489cd0c`, `aaa243d`, `9d15ba0`, `6e6c753` (journey waits), `f7620d3` (play journey signs up by phone), `e493735` (`phone.ts`). |
| Migration `20261117070000_texts_sign_in` | read | Adds four `User` columns, renames `SignInGuard.emailHash` to `numberHash` after deleting its rows (pauses of an hour at most), adds `PendingSignUp` and `TextSent`, a unique index and an E.164 check on `User.phoneNumber`, and the append-only trigger on `TextSent`. `schema.pg.test.ts` and `migrations.pg.test.ts` cover the checks and trigger (both green). See N1 for its date. |
| Money and membership changes | read | Stripe customers are made with no address; `paidWithEmailOf` reads `customer_details.email` from the verified event before the inbox's cut-down copy, and `completeCheckout` keeps it as `paperEmail` in the same transaction (only with an "@"). `processStripeDelivery` handles only the one inbox row it is given, so an address never lands on another event. `hasBeenPaid` counts journal lines by `makerUserId`; `hasBillingCustomer` counts Stripe customers; `hooks.server.ts` hands both to forgot password through `setMoneyCheck`, which says "has money" until set. No amount or ledger fact is written by this branch. |
| Email left anywhere | read | `grep` over `src` for `.email`, `email: true` and `makerEmail`: only the purge (which clears it), Stripe's own field and the stand-in address. Nothing mails a person but the reset code to `paperEmail`. |
| A real account made by email | FAIL | See R1, run on the `verify` database. |
| Graphify | used | `mcthaydt/RukenApp` is indexed at `main`, not this branch, so the branch was read from the checkout. |

## Red findings

### R1. The owner's live account, made by email, is locked out after this merges, and step X8 says it is done

- UNIT: the hand-over to the live site: `src/routes/jobs/first-owner/+server.ts` with `src/features/accounts/staff.ts` (`grantFirstOwner`), and step 6 (X8) of the owner's steps in `docs/superpowers/live/claude-project-thread-5pb367.md`.
- VERDICT: red. The fix needs the owner's choice (below).
- REQUIREMENT: the owner's rules of 2026-11-21 (project memory): "nothing in Ruken is permanent; everything must be editable", Floor Fifty's submission stays editable, and "keep the address" (a game's address stays fixed). The spec's call "no real person has an account yet, so nothing is moved over" was true on 2026-11-15 and is not now; this is said once, with the facts.
- REASON: every live account was made by email, and after this branch nobody can sign in with an email; nothing gives such an account a phone number, and the first-owner job refuses once any staff account exists.
- EVIDENCE:
  - The owner signed up on https://ruken.io by email and made that account staff with `{"email": …}` (project files, `owner-steps/2026-11-20-real-game-walk.md`, step 2), then Floor Fifty was sent, accepted and played there (`docs/superpowers/progress.md` line 31, unit G, 2026-11-21 03:10 UTC). `wrangler.jsonc` names one Worker, `ruken`, with `workers_dev: true`, so the address X8 uses (`ruken.ruken-beta.workers.dev`) is the same site and database as ruken.io.
  - Sign-in takes only a phone number (`signInWithPassword` posts to `/sign-in/phone-number`; `emailAndPassword.enabled: false` in `auth.ts`), so an account with `phoneNumber` null cannot sign in, and forgot password finds accounts only by number.
  - Run on the `verify` database at `61b67b9`: an account made the old way (email, no number) holding the `owner` staff role, plus a new account signed up by phone. `POST /jobs/first-owner` with the new number answered `{"problem":"There is already a staff account."}` and the only staff account stayed the email one with no number. The live-state's X8 says that answer "also means it is done".
  - `/me` for an account with no number shows an empty line (`accountOf` returns `""`).
- EXPECTED: after the deploy the owner signs in with their phone, is still staff, and still owns Floor Fifty at its address.
- FIX (owner's choice; recommended first):
  1. **Give the existing account a number (recommended).** A job behind the jobs secret, like `first-owner`, that sets `phoneNumber` on the account found by its old email, only when that account has no number and no other account has the number. The account keeps its id, staff role, games and its existing password (its `credential` row is unchanged), so the owner then signs in with the phone and the old password, or uses Forgot password. Tests: a pg test (number set; refused when taken or already set; 404 without the secret) and a journey (email account, the job, sign in by phone). X8 is rewritten to run it on https://ruken.io, reading the secret from the Keychain (`security find-generic-password -s ruken-jobs-secret -w`, the owner's instruction of 2026-11-21 00:09 UTC). Files: a new `src/routes/jobs/<name>/+server.ts`, a function beside `grantFirstOwner` in `src/features/accounts/staff.ts` (or `accounts.ts`), their tests, and the owner's steps.
  2. Move the staff role and the games from the old account to a new phone account: more tables to move (games, pages, money lines) and more to get wrong.
  3. Accept the loss: the owner signs up again and Floor Fifty is sent again from the new account. Breaks "keep the address" and the editable rule; not recommended.

### R2. The live-state file is still on the branch at the audited commit, and it is stale

- UNIT: `docs/superpowers/live/claude-project-thread-5pb367.md`.
- VERDICT: red.
- REQUIREMENT: `CLAUDE.md`, "Live state in a file": the session "deletes the file in its last commit before it hands the branch to the audit", so the commit the audit and the owner's approval name is the one that merges.
- REASON: the file is present at `61b67b9`, and it is the only place the owner's pre-merge steps are written, so it cannot simply be deleted.
- EVIDENCE: `git ls-files docs/superpowers/live/` at `61b67b9` lists it; it reads "Last commit: 53da7dc" and "main (206789a) merged in; waiting for CI", three merges ago. The PR body points the owner to this file for X1 to X4, Step 1a and X8.
- EXPECTED: no live-state file on the branch at the commit handed to the audit; the owner's steps kept where they outlive the branch.
- FIX: move the owner's steps (with R1's new X8) into the pull request body or the project files (`owner-steps/`), point the body there, and delete the live-state file in the fix round's last commit. Files: the live-state file and the PR body.

### R3. The pull request body does not name the tests it changes and deletes, and its "What ran" names no commit

- UNIT: the body of #209.
- VERDICT: red.
- REQUIREMENT: `build` ("A pull request that changes or deletes an existing test, golden or `verify` step names each one and why in its body") and `review` (the reviewer reads those first); `CLAUDE.md`, "Report honestly" and "Every review, check and approval names the commit it examined".
- REASON: 45 test files are changed and 2 deleted against `main`, and the body names only the `verify` skill edit and, loosely, "the mail code (`mails.ts`) and its journey are deleted".
- EVIDENCE: `git diff --name-status ef720a9...61b67b9 -- tests`: 45 `M`, 2 `D` (`tests/browser/mailed-links.test.ts`, `tests/features/accounts/mails.test.ts`), 6 `A`. Heavy rewrites with no line in the body include `tests/features/accounts/auth.pg.test.ts` (1106 lines changed), `forms.test.ts`, `auth-limits-plugin.test.ts`, `sign-in-pause-plugin.test.ts`, `sign-in-guards.pg.test.ts`, and journeys outside accounts (`look.test.ts`, `look-layout.test.ts`, `pay.test.ts`, `play.test.ts`, `purged-account.test.ts`, `connect-github.test.ts`, `first-owner.test.ts`). "What ran" gives 1517 unit tests and "the five Chromium projects" without a commit; at `61b67b9` it is 1739 tests and three devices.
- EXPECTED: one line for each changed or deleted test file and why (most are "signs up by phone instead of email"; say which ones changed what they assert), and a "What ran" that names the commit it ran on.
- FIX: edit the PR body only, keeping its first two lines and its last line "Requested by **McThayDT**".

## Notes (recorded, not fixed here)

- N1. **The migration is dated before two that are already live.** `20261117070000_texts_sign_in` sorts before `20261120004720_decision_days` and `20261120082539_shows_player_count`, both on `main`. `prisma migrate deploy` (in `pnpm run deploy`) applies it anyway, after them, so the live database and a fresh one apply them in different orders. Neither later migration touches `User` or `SignInGuard` (`grep`), so the result is the same. Recorded only.
- N2. **`TextSent` has no code yet.** The table, its unique key and its trigger are made and tested, but nothing in `src` writes or reads it. It may be the plan's choice to make every texts table in one migration (the plan is no longer in the repo to check); otherwise it is ahead of its user. Not worth a second migration to remove.
- N3. **`hasBeenPaid`'s comment says more than it counts.** `src/features/money/services.ts`: "as a maker or a member's pool", but it counts only journal lines with `makerUserId`; members are covered by `hasBillingCustomer`. One comment line.
- N4. **A comment in `src/features/games/service.ts` (`waitingGames`) runs past the line width** and reads oddly ("No maker's address: it would now be a stand-in nobody can read").
- N5. **X8's command pastes the jobs secret** (`read -s`) instead of reading it from the Keychain, as the owner asked on 2026-11-21 00:09 UTC, and uses the workers.dev address rather than https://ruken.io. Folded into R1's fix.
- N6. **After a reset, signing in lands on the home page**, because `/sign-in?reset=1` carries no `next`. The same as `main`; recorded only.
- N7. **The checks here ran on Node 22**, the container's default; the `verify` start and walk ran on Node 24 as the skill says. CI runs Node 24 and is green on `61b67b9`.
- N8. **Still open before merge, unchanged from cycle 1 (N5):** the full CI run on a ready pull request, Step 1a (a real code on the owner's phone), X1 to X4 as far as the owner has not done them (the live-state says the owner set up Twilio on the test site on 2026-11-20 09:11 UTC; the PR body still lists them as owed), and the owner's lane 3 approval.

## For the fix round

R1 needs the owner's choice first (recommended: give the existing account a number); R2 and R3 need none. The implementer fixes all three, each in its own files, and this audit (or a program) checks each fix on the new commit. After that the pull request leaves draft for the full CI run, and still stays unmerged until the owner's OK and the real-phone code test.
