**53d9043 FAIL: 4 red**

# Everything editable, unit D (change email and password): implementation audit 1

- Branch: `claude/project-thread-evc10x`, commit examined 53d9043, based on `main` 2d00e7e. No pull request yet.
- Brief: `docs/superpowers/specs/2026-11-21-everything-editable-design.md` section 5.4, criteria G1 to G6 and D1 to D7.
- Lane 3 implementation audit, a fresh session (Opus 5.5, medium). Written 2026-11-21 16:13 UTC (from `date`).
- Prompt: Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## What ran (in this container, at 53d9043)

| Check | Result |
| --- | --- |
| `pnpm lint` | pass |
| `pnpm typecheck` | pass, 0 errors |
| `pnpm test` | 117 files, 1688 tests pass |
| `pnpm test:pg` (local Postgres 16) | 43 files, 656 tests pass (the 9 new ones included) |
| `tests/browser/change-credentials.test.ts`, computer and tablet | 12 of 12 pass |
| same, phone (WebKit) | not run: this container has no WebKit build (`/opt/pw-browsers/webkit-2359` missing). CI must run it. |
| Probe test (not committed; below) | reproduced red 1 |

G1 (CI green on a pull request head, `gate`, `commit-authors`) cannot be judged yet: there is no pull request.

## Red findings

### Red 1. An old change-email link takes over whoever gets the old address next

- UNIT: `src/features/accounts/auth.ts` (better-auth's `/verify-email`, enabled by `user.changeEmail`).
- VERDICT: red.
- REQUIREMENT: section 5.4 and N3 (an open change link must not outlive what it was made for; criterion D7's intent), and the audit's brief to look for account-takeover paths.
- REASON: better-auth's change-email token names the old address, not the account (`email`, `updateTo`, `requestType`, `email-verification.mjs` lines 183 to 243). When the link is opened it changes whichever account holds that address now, and, with no cookie, signs the opener in to it (`createSession`, then `setSessionCookie`).
- EVIDENCE: probe pg test run against this branch. Account X (address A) asks for A to B and keeps the B link unopened; X then asks for A to C and opens that link, which frees A; a new person signs up with A; X opens the old B link with no cookie. Output: `open stale 302 /me victim email now: attacker-b@example.test set-cookie: [ 'rk_session' ]`, `victim sessions 2`. The new person's account now has X's address and X holds a session in it. The window is the link's life (`emailVerification.expiresIn`, one day).
- EXPECTED: a change-email link works only for the account that asked for it. Opened after its address moved to another account, it changes nothing and signs nobody in.
- FIX: in `auth.ts`, a `before` hook for `/verify-email` that, for a token whose `requestType` is `change-email-verification` (the token is verified by better-auth afterwards; here read `iat` and `email` the way `isEmailChangeToken` reads the claims), refuses with better-auth's `INVALID_TOKEN` redirect when the account holding `email` was created after the token's `iat`. Add the probe below as a pg regression test that fails before the fix. Files: `src/features/accounts/auth.ts`, `tests/features/accounts/credentials.pg.test.ts`. (Binding the token to the user id instead would need a table, which section 5.4 says stops and comes back as a spec amendment.)

Probe, in the shape of `credentials.pg.test.ts` (its helpers `accountWithSession`, `formEvent`, `deps`, `settle`):

```ts
const x = await accountWithSession();
await changeEmail(formEvent({ email: "attacker-b@example.test", password: PASSWORD }, x.cookie), deps(), x);
const staleLink = linkTo("attacker-b@example.test");
await changeEmail(formEvent({ email: "attacker-c@example.test", password: PASSWORD }, x.cookie, "203.0.113.9"), deps(), x);
await theAuth().handler(new Request(linkTo("attacker-c@example.test"), { headers: { cookie: x.cookie, origin: ORIGIN } }));
// someone new signs up with x.email, then:
await theAuth().handler(new Request(staleLink, { headers: { origin: ORIGIN } }));
// expected: the new account keeps x.email and has only its own session
```

### Red 2. A refused change-email form throws away the new address that was typed

- UNIT: `src/features/accounts/credentials.ts` (`changeEmail`), `src/routes/me/email/+page.svelte`.
- VERDICT: red.
- REQUIREMENT: G4 ("its refusal shown beside what caused it with what was typed kept").
- REASON: no failure returns the typed address and the input has no `value`, so a wrong password, a bad address or "too many tries" comes back with an empty "New email" box. Sign-up keeps it (`forms.ts`, `kept = { email: form.email, ... }`).
- EVIDENCE: `changeEmail` returns `fail(400, { field, error })` with no `email`; `<input type="email" name="email" autocomplete="email" />` has no value. The D3 journey only checks the box is visible, not what is in it.
- EXPECTED: after any refusal the "New email" box still holds what was typed (passwords are cleared, as on sign-in).
- FIX: return `email: form.email` in every `changeEmail` failure (add it to `ChangeFormData`), set `value={form?.email ?? ""}` on the input, and assert in the D3 journey that the box still holds the typed address. Files: `credentials.ts`, `src/routes/me/email/+page.svelte`, `tests/browser/change-credentials.test.ts`.

### Red 3. No journey uses the keyboard on the new screens

- UNIT: `tests/browser/change-credentials.test.ts`.
- VERDICT: red.
- REQUIREMENT: G2 ("a journey tabs to and presses each new button").
- REASON: every step clicks; nothing tabs to "Change email", "Change password", "Send the link" or "Save password".
- EVIDENCE: the file has no `keyboard.press` or focus step (all six journeys use `.click()`).
- EXPECTED: a journey reaches each of the two links on `/me` and each of the two buttons with Tab, checks focus is visible, and presses Enter.
- FIX: add those keyboard steps (one journey can cover all four). File: `tests/browser/change-credentials.test.ts`.

### Red 4. The D7 purge test does not run the purge, and uses the wrong tombstone

- UNIT: `tests/features/accounts/credentials.pg.test.ts`, "an open change link does nothing once the account is gone".
- VERDICT: red.
- REQUIREMENT: D7 ("an account with a change-email link still open is purged; ... the purged row keeps its tombstone address").
- REASON: the test sets the address by hand to `purged-<id>@deleted.invalid`; the real purge writes `deleted-<id>@deleted.invalid` (`src/features/accounts/deletion.ts:147`) and does more than change the address. The test proves a stand-in, not the purge.
- EXPECTED: the test asks to delete the account, moves the clock past 14 days, runs `purgeDueAccounts`, opens the link, and checks the row still has `deleted-<id>@deleted.invalid` and no new session.
- FIX: drive the real `purgeDueAccounts` in that test. File: `tests/features/accounts/credentials.pg.test.ts`.

## Criteria

| Criterion | Result | Evidence |
| --- | --- | --- |
| G1 | not yet | no pull request; local results above |
| G2 | red 3 | |
| G3 | pass | both actions take the account from the session (`signedInOnly`), never from the form; there is no id to swap |
| G4 | red 2 | one blue button each, plain words; typed address not kept |
| G5 | pass | no existing test changed |
| G6 | note 1 | `docs/superpowers/progress.md` changed |
| D1 | pass | journey 1; pg test 1 |
| D2 | pass | `revokeOtherSessions: true` (`credentials.ts`); journey 2 shows the other browser sent to sign-in; pg test "signs the other sessions out and keeps this one" |
| D3 | pass, with red 2 | journey 3, both screens, no mail |
| D4 | pass | pg test "answers the same for an address another account has"; better-auth sends nothing for a taken address and the old-address notice goes either way |
| D5 | pass, note 4 | 10 to 128, same words as sign-up |
| D6 | pass | `ACCOUNT_CHANGE_LIMITS` is sign-in's 5 a minute per IP and address; the ten-wrong pause is shared (`reserveSignInAttempt`, `recordWrongPassword`); pg test "counts wrong passwords like sign-in does" |
| D7 | red 4 (purge half); receipts half pass | journeys 5 and 6 |

## The takeover questions the coordinator asked

- **A stolen session cookie.** Without the password it changes nothing: both screens check the password first, and `/change-email` and `/change-password` answer 404 through the public `/api/auth` route. A probe also sent `/change-email/`, `//change-email`, `/Change-Email`, `/change-email?x=1`, `/change-password/`, `/change-email%2F` and `/./change-email` through the public route with a live cookie: all 404. `/update-user` refuses an email in its body (`EMAIL_CAN_NOT_BE_UPDATED`). Cookie cache is off, so a revoked session ends at once.
- **Email enumeration.** Holds: same answer and words for a taken address, no link mailed to it, notice to the old address either way, and the slow mail is sent after the answer.
- **Should a password change revoke other sessions?** It does, as the spec asks (D2). The builder's note "no sign-out of other devices" does not match the code; it is true only of an email change (note 2).
- **Phone sign-in #209 merging first.** See note 5.

## Notes (not blocking; recorded, not fixed here)

1. G6: `docs/superpowers/progress.md` is outside unit D's row. The project's instructions let an implementer write it when the coordinator cannot; the coordinator should say whether that applied, or the change comes out.
2. A finished email change leaves the account's other sessions signed in, and no mail goes out when a password changes (`passwordChangedMessage` exists and is used for resets). The spec asks for neither; adding them is the owner's call.
3. If the new address is taken between the ask and the click, opening the link answers 500 (probe: `race open 500`). Nothing changes, but the person sees an error page. A friendly refusal would be better.
4. `changePassword` hard-codes 10 and 128 where sign-up uses `PASSWORD_MIN_LENGTH`/`PASSWORD_MAX_LENGTH`; the rules can drift apart. The too-long case is not tested.
5. An account with no password (phone-only, once #209 lands) can never pass the password check, and each try counts as a wrong password toward the pause. If #209 merges first, this unit needs a way for such accounts, and `PAGE_ONLY_PATHS` and the limits in `auth.ts` and `auth-limits-plugin.ts` will meet #209's changes.
6. Not probed: a change link opened while the account waits to be deleted creates a session, and `restoreOnSignIn` runs on session creation, so it may undo the deletion. Plain sign-up confirmation links already behave this way.
7. Phone (WebKit) journeys were not run here; CI must run them on the pull request.
