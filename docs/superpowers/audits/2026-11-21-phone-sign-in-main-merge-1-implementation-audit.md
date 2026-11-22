**094ef0a FAIL: 1 red**

Lane 3 implementation audit of #209 (phone sign-in) at 094ef0a, the merge of main (fe5f5ee: #274, #276, #277, #278) into the branch that last passed at c343326. Read only. Written 2026-11-21 21:06 UTC.

## What I ran at 094ef0a

- `pnpm typecheck`: 0 errors. `pnpm lint`: 0 problems.
- `pnpm test`: 118 files, 1820 passed.
- `pnpm test:pg` on a local Postgres 16: 49 files, 745 passed.
- Browser journeys, locally, for the files the merge touched (change-password, purged-account, adults-only, make-live-changes, sign-up), tablet and computer profiles: 90 passed, 4 failed (below). The phone profile (WebKit) could not start in this container (no WebKit build), so it did not run.
- CI: no check runs on #209 at 094ef0a, because the PR now conflicts with main (see R1).

## Red

**R1.** UNIT: `tests/browser/make-live-changes.test.ts` (and the merge with main). VERDICT: red. REQUIREMENT: green journeys before merge; the PR must merge cleanly. REASON: main moved after the merge: #281 (37944af, "Let the players in the live-changes journeys be adults") fixes two 18+ journeys that fail on fe5f5ee, and it conflicts with this branch. EVIDENCE: `make-live-changes.test.ts:179` and `:231` fail at 094ef0a on tablet and computer (`locator.getAttribute: Timeout 5000ms` reading what a signed-out player sees of an 18+ game). `git merge-tree 094ef0a origin/main` reports CONFLICT in `tests/browser/make-live-changes.test.ts`. EXPECTED: the four runs pass and the PR merges cleanly. FIX: merge main (3a60ce9 or later) into the branch; in #281's `adultPlayer`, use the phone shape (`{ number, password }` from `signUp`, `signInAs(page, number, password)`); keep #281's `forgetRateLimits()` in `adults-only.test.ts` beforeAll. Files: those two tests only. Then CI runs the full journeys.

## What checked out

- Password change by phone (`credentials.ts`, `/me/password`): checks the current password first; 5 a minute per client address and number hash (`hitPasswordChangeLimit`); wrong guesses count toward the number's ten-an-hour sign-in pause and a paused number is refused even with the right password; `revokeOtherSessions: true` signs other devices out. `/api/auth/change-password` from outside answers 404 (`PUBLIC_AUTH_PATHS` allow-list; covered by `credentials.pg.test.ts` and `auth.pg.test.ts`). Behaviour matches main's #274 change, keyed by number instead of email.
- Change email is gone everywhere: route, form, mails, link on /me; `/me/email` answers 404 (journey covers it). Owner's choice of 20:39 UTC respected.
- Purge: main's per-account `purgeOne` kept (photo, game files and clips deleted from the bucket first, `takeGamesOff`, one failure does not stop the rest), and the branch's phone cleanup added inside it (number codes, reset codes, pending sign-up, phone fields cleared). The daily job passes `secret`. Covered by `purge.pg.test.ts` and the "comes off Ruken with the account" journey (passed).
- 18+ gate: sign-up still writes `adultOn` (pending sign-up carries it to `makeAccount`); adults-only journeys converted to phone sign-up and pass on tablet and computer.
- Live video and rating edits: journeys pass except R1's two.
- Attach-phone job: unchanged by the merge; still finds the account by email, and with Change email dropped the owner's email stays what it is.
- CRUD for the account: create (sign-up), read (/me), update (change password), delete (Delete my account, purge) each have a journey.

## Notes (not blocking)

- N1. `/me/password` shows the form to a signed-in account with no number (only the owner's, until attach-phone runs), and saving answers 404. Gone once attach-phone runs.
- N2. The owner's account was made before the age question, so after attach-phone its `adultOn` is still empty and 18+ games stay hidden from it. Outside this PR.
