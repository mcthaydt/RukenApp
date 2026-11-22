**53a1f3a FAIL: 1 red**

Lane 3 re-audit of #209 at 53a1f3a (6bb01c6, the merge of main with #281 plus the attach-phone birth date and the plain Change password message, then 53a1f3a's import move). Read only.

## What I ran
- At 53a1f3a: `pnpm typecheck` 0 errors, `pnpm lint` clean, `pnpm test` 118 files, 1820 passed (the layer-rule test that failed at 6bb01c6 passes now).
- At 6bb01c6 (53a1f3a changes only `accounts.ts` and the attach-phone route's import): `pnpm test:pg` on local Postgres 16, 49 files, 746 passed.
- Browser journeys, locally, tablet and computer: change-password, attach-phone, adults-only, make-live-changes, purged-account at 6bb01c6: 68 passed, 2 failed (R1). attach-phone again at 53a1f3a on computer: 3 passed, 1 failed (R1). The phone profile (WebKit) can't start in this container.
- `git merge-tree` with today's main (cad995f): no conflict.

## Red
**R1.** UNIT: `tests/browser/attach-phone.test.ts:62` ("gives the account its age when a birth date comes"). VERDICT: red. REQUIREMENT: green journeys; the fix for the old note N2 must be proved by a check. REASON: the journey clears the account's number with `makeItAnOldAccount(number)` and then calls `forgetAgeOf(number)`, which updates `where: { phoneNumber: number }`, so no row matches. EVIDENCE: fails on tablet and computer with Prisma "No record was found for an update", every run. EXPECTED: the journey reaches the attach-phone posts and checks `adultOnOf(number)`. FIX: call `forgetAgeOf(number)` before `makeItAnOldAccount(number)`. Only that test file.

## Closed from the last round
- Old R1 (#281): main is merged in; `adultPlayer` uses `{ number, password }` and `signInAs(page, number, password)`; `forgetRateLimits()` kept in adults-only beforeAll. The four make-live-changes 18+ runs pass.
- Old N1: `/me/password` with no number shows the plain message and no form (journey passes); the action answers 400 with the same words instead of 404.
- Old N2: code is right. `attachPhoneToAccount` stores `adultOn` only where none is on file (pg test passes), and the route refuses an invalid or under-13 birth date. Its journey is R1.

## Notes (not blocking)
- N1. The journey's name says "so an 18+ game opens for it", but it checks only the stored day. Either rename it or open an 18+ game as that account.
