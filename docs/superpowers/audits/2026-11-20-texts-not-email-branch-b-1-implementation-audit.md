# Texts, branch B (sign-up, sign-in and forgot password by phone): implementation audit, cycle 1

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

- Pull request: #209 (draft), branch `claude/project-thread-5pb367`.
- Commit examined: `b7fe8f7` ("Merge main into the phone sign-in branch"), with `main` at `949ffb5` merged in. The review counts only for that commit.
- Measured against: `docs/superpowers/plans/2026-11-15-texts-not-email.md` at `b7fe8f7` ("This slice": Units, acceptance criteria B1 to B11, "Codes go through Twilio Verify", the screens; Global Constraints; "The Calls in this plan"; Review Focus 1, 2 and 6; Tasks 3, 4 and 5), its audits (`2026-11-15-texts-not-email-plan-audit.md`, `2026-11-17-texts-not-email-2-plan-audit.md`), `CLAUDE.md`, and the merged servers-and-place spec (`2026-11-20-online-servers-and-player-place-design.md`, #203, on `main` at `d737360`) for what branch B must not block.
- Lane: 3 (a migration, `src/features/membership/`, `src/features/money/`). Implementation audit after the build; the Owner's approval before merge.
- Focus asked for: auth security (code expiry, rate limits, telling a stranger who has an account, the reset flow, sessions), the date of birth at sign-up, and anything that blocks #203.
- Written: 2026-11-20 01:08 UTC (from `date`).

## Verdict

Five red findings and six notes. The core of the branch is sound: the plugin's `verify` is unreachable from outside, a code never opens an account that already exists, sign-ups are bound to the browser that started them, codes expire in ten minutes with three tries and a per-number pause, a reset revokes every session, and the date of birth is still asked and checked. The three security reds are all ways to learn whether a number has an account, or to text a closed country, that the plan's rules forbid; each has a small fix in one or two files. The two other reds are gaps against the plan's code screen. Nothing in branch B blocks #203's units U and Y.

## What was checked, and how

| Check | Result | Evidence |
|---|---|---|
| Unit tests | PASS | `pnpm test` on `b7fe8f7`: 102 files, 1511 tests passed, in a cloud container. |
| `pnpm test:pg`, `pnpm build`, lint, typecheck, journeys | not run here | No Postgres server in this container. The builder ran them (lint, typecheck, build, database tests, journeys on computer and phone). CI's quick draft run on the PR's head was queued and running at 01:07 UTC; `commit-authors` passed. |
| better-auth 1.7.7's phone plugin | read | `node_modules/better-auth/dist/plugins/phone-number/routes.mjs`: `send-otp`, `verify`, `consumePhoneNumberOTP`, `request-password-reset`, `reset-password`, `verifyPhoneNumberOTP`. Matches the builder's Step 0 notes. |
| `verify` unreachable from outside | PASS | `auth.ts` `hooks.before` throws `NOT_FOUND` for any path outside `PUBLIC_AUTH_PATHS` when `PUBLIC_ROUTE_HEADER` is set; `forward.ts` always sets it; better-auth runs the user `before` hook ahead of plugin hooks (`api/dispatch.mjs` `getHooks`), so no limit or pause is touched first. |
| A code never opens an existing account | PASS | `finishSignUp` calls `verify` only when this browser has a pending row and no account has the number; otherwise `consumePhoneNumberOTP` and always `codeWrong`. Sign-up codes (`<number>`) and reset codes (`<number>-request-password-reset`) are separate identifiers. |
| Code expiry and tries | PASS | `expiresIn: 600`, `allowedAttempts: 3`; the plugin deletes an expired row and refuses the 4th try (`TOO_MANY_ATTEMPTS`); `consumeVerificationValue` is the race gate. Pending rows, the `ruken_sign_up` cookie and the code all last ten minutes; "Text it again" renews the row and the cookie. |
| Per-number limits and the wrong-code pause | PASS (with R2) | `auth-limits-plugin.ts` as planned: 1/30 s, 3/15 min per client and number, 10/h per number; 10 wrong codes pause codes for an hour, counted on both sign-up paths. |
| Reset flow | PASS | `request-password-reset` writes a row for any number and sends only for an account; `sendResetCode` picks text, email or help after the answer; `reset-password` revokes every session (`revokeSessionsOnPasswordReset`), and `onPasswordReset` never throws, so revocation always runs. |
| Session handling | PASS (with R1) | Sessions are checked against the table on every request (no cookie cache); sign-up's half-made account and its session are taken back on failure; purge clears the number, `paperEmail`, pending rows and both verification identifiers. |
| Logs hold no number or code | PASS | `sendLater` logs `textFailureCode`/`mailFailureCode` only; `finishSignUp` logs the error's name only; "reset held for help" has no number. |
| Date of birth at sign-up | PASS | `src/routes/sign-up/+page.svelte` asks month, day and year; `startSignUp` refuses an invalid date and under 13 before keeping anything or sending; `adultOn` is kept in `PendingSignUp` and written by `makeAccount`. |
| #203 not blocked | PASS | See "Against #203" below. |
| Graphify | used | Indexed at `main` `d737360`, not this branch, so used for callers on `main` (`signInWithPassword`: the sign-in page and two tests) and the branch was read from the checkout. |

## Red findings

### R1. Signing in tells a stranger which numbers have an account, by time

- UNIT: `src/features/accounts/auth.ts` (the sign-in path through better-auth's `/sign-in/phone-number`).
- VERDICT: red.
- REQUIREMENT: Global Constraints, "The form never tells a stranger whether a number has an account: the same screen, the same words and the same timing either way"; B3.
- REASON: for a number with no account the plugin answers 401 at once; for a number with an account it first checks the password hash, about 80 ms later.
- EVIDENCE: `routes.mjs` lines 60 to 98: `if (!user) throw APIError.from("UNAUTHORIZED", …)` comes before `ctx.context.password.verify(…)`. One `verifyPassword` of a wrong password with better-auth's hasher measured 81.6 ms on average over 5 runs in this container. The email sign-in this replaces hashed the password for an unknown user to hide exactly this (`api/routes/sign-in.mjs` lines 321 and 328, `await ctx.context.password.hash(password)`), so this is a regression from `main`. One try costs a stranger one of the number's ten guesses, and the per-client backstop allows 30 numbers a minute.
- EXPECTED: a wrong number and a wrong password take the same time.
- FIX: in a `before` hook on `/sign-in/phone-number` (in `sign-in-pause-plugin.ts` after the reservation, or a small hook in `auth.ts`), when no user has the number, run `ctx.context.password.verify` against a fixed dummy hash made once at start, then let the endpoint answer its own 401 (do not throw from the hook, so the pause's `after` hook still counts the guess). Test in `tests/features/accounts/auth.pg.test.ts`: the hasher is called once for a number with no account (spy or counting hasher), not a wall-clock test. Files: `auth.ts` or `sign-in-pause-plugin.ts`, and that test.

### R2. At the per-client limit, the code screen answers differently for a number with an account

- UNIT: `src/features/accounts/forms.ts` `finishSignUp`, with `auth.ts` `rateLimit.customRules`.
- VERDICT: red.
- REQUIREMENT: B2 ("no code typed there signs anyone in, even at the limit"), audit 6 and 2.2 ("a number with an account and a number without read the same at every try, do the same database work, and pause at the same count"), Global Constraints.
- REASON: the number-without-account path goes through better-auth's handler (`/phone-number/verify`, 10 per 15 minutes per client); the number-with-account path calls `auth.api.consumePhoneNumberOTP` directly, which better-auth's client limiter never sees (`api/index.mjs` line 172: `onRequestRateLimit` runs only in the router's `onRequest`).
- EVIDENCE: after one client has typed 10 codes on `verify` in 15 minutes (any number with a pending row and no account, a made-up `555 01··` one included), a code typed for a number with no account answers 429 and reads "Too many tries. Wait a few minutes" (`codeLimitFailure`, no error code, so `rateLimited`), while one for a number with an account reads "That code isn't right." Each probe costs one sign-up start (5 an hour per client), so it is slow, but it is the "same screens" rule broken. The verify path also does the limiter's extra row write that the other path does not.
- EXPECTED: both paths are counted and refused by the same per-client limit, with the same words, at the same try.
- FIX: in `finishSignUp`, before choosing the path, count one try per client address with the site's limiter (`api:auth:sign-up-code:<client>`, 10 per 15 minutes, refused as `rateLimited`), and drop `/phone-number/verify` from `customRules` so the two paths do the same work. Test in `forms.test.ts`: the 11th code from one client reads the same for a number with and without an account. Files: `forms.ts`, `services.ts` (the dep), `auth.ts` (the rule), `forms.test.ts`.

### R3. A number from a closed country gets a code if it is typed with its "+"

- UNIT: `src/features/accounts/forms.ts` `numberOf` (used by `startSignUp`, `requestReset`, `signInWithPassword`).
- VERDICT: red.
- REQUIREMENT: the Owner, 2026-11-15: "Stay closed there until replies work"; Task 4, `startSignUp`: "the country is open (… until then only `US` and `CA`), else `fail(400, { closedCountry: true })` and nothing is stored".
- REASON: only the picked country is checked; `toE164` takes a typed `+`, `00` or `011` as naming its own country whatever was picked, so the number itself is never checked.
- EVIDENCE: `numberOf` returns `toE164(country.dialing, form.phone)` after `countryOf(form.country)`; Task 2's own table has `["+1", "+44 7700 900123", "+447700900123"]`. So "United States" with "+44 7700 900123" keeps a pending sign-up and calls `send-otp`, and `sendSignUpCode` hands a UK number to Verify. Whether Twilio's Verify Geo Permissions then refuse it was not read (plan, "Which countries Verify may text").
- EXPECTED: a number whose dialing code is not an open country's reads "Ruken isn't in your country yet." and nothing is kept or sent.
- FIX: in `numberOf`, return null unless the E.164 starts with the picked country's `dialing` (today `+1`), and have `refusedNumber` say `closedCountry` for that case. Other countries under `+1` (the Caribbean) stay for Task 11's `countryOf(number)`, as planned. Test in `forms.test.ts`: "+44 …" under US on sign-up and forgot password reads `closedCountry`, and keeps and sends nothing. Files: `forms.ts`, `forms.test.ts`.

### R4. "Change the number" loses what was typed, and is a link, not a green button

- UNIT: `src/routes/sign-up/+page.svelte` line 50.
- VERDICT: red.
- REQUIREMENT: Task 4, "The screens": "'Change the number' (green, back to the first state with the fields kept)"; the sketch draws it as a green button.
- REASON: it is a plain link to `/sign-up?next=…`, a fresh page.
- EVIDENCE: `<p><a href={`/sign-up?next=${encodeURIComponent(nextPath)}`}>Change the number</a></p>`; the country, number and date of birth are lost and the person types them all again.
- EXPECTED: a green ("quiet") button that returns the first screen with the country, number and date of birth filled in (never the password).
- FIX: a `change` action in `src/routes/sign-up/+page.server.ts` that reads the hidden fields and answers them without `step`, and a `<button class="quiet" formaction="?/change" formnovalidate>` in the code form. Journey in `tests/browser/sign-up.test.ts`: after "Change the number" the fields hold what was typed. Files: those three.

### R5. "Text it again" has no 30-second wait on screen

- UNIT: `src/routes/sign-up/+page.svelte`, `src/routes/forgot-password/+page.svelte`.
- VERDICT: red.
- REQUIREMENT: "The Calls in this plan": "'Text it again' after 30 seconds is shown by a small script; with no script the button is always there"; Task 4, the screens: "shown after 30 seconds by a script and always without one".
- REASON: there is no script; the button is always there, so the first tap after a code reads "Give it a few seconds, then try again."
- EVIDENCE: no timer in either page (`grep setTimeout` finds none under those routes).
- EXPECTED: with a script, the button appears 30 seconds after the code screen shows; without one it is always there and the server's "Give it a few seconds" stays.
- FIX: in each page, hide the button on mount and show it after 30 s (a `$state` flag and `setTimeout` in `onMount`; server render keeps it visible). Journey: with scripts on, the button is hidden at first and shows after the clock is moved 30 s (`page.clock`). Files: the two pages and their journeys.

## Notes (recorded, not fixed here)

- N1. **Two texts an hour per number, not one limit.** `send-otp` and `request-password-reset` each allow 10 an hour per number, so an account holder can be sent up to 20 texts an hour (10 `alreadyText`, 10 reset codes). The plan says "each", so this is as planned; worth the Owner's eye for cost once real texts flow.
- N2. **A text-channel reset does not refresh `phoneConfirmedAt`.** `heldSince` then keeps the sign-up time (or the latest session), which only makes "changed hands" more likely, the safer side. Branch C or E may want to set it.
- N3. **`codeUsed` on the account-exists path** approves whatever verification is open for the number (perhaps the owner's reset). It runs only when the right code was typed for a code that was never sent, so it is reachable only by a guess. No effect on Ruken, which never asks Verify to check.
- N4. **`removeHalfMadeAccount` has no guard** that the user it deletes was just made. The only way `verify` returns an older user is a race in which another browser finishes first with the same code, which the code's single use prevents. A `createdAt` guard would make it impossible rather than unreachable.
- N5. **Open gates, already known, not new findings:** the full CI run on a ready pull request (A1/B10), the WebKit and tablet projects, Task 4 and 5's Step 3 (`showTheOwner`) and the visual check (B11), Step 1a (a real code on the Owner's phone), X1 to X4, and the Owner's lane 3 approval. CI's quick draft run was in progress at 01:07 UTC.
- N6. **For #203's Y:** Y's place screen "falls back to the phone number's country through `phone.ts`", but under `+1` a number alone cannot tell the United States from Canada until Task 11's area-code split, and B does not keep the country picked at sign-up. Y's plan should say which it uses. Nothing for B to change.

## Against #203 (servers and a player's place)

- U adds `PendingSignUp.birthDate` and deletes pending rows first: B's `PendingSignUp` is a plain table with a ten-minute life, and B's migration (`20261117070000_texts_sign_in`) is the newest, so U dates after it. Not blocked.
- Y changes `startSignUp`, `finishSignUp`, `pending-sign-up.ts` and `deletion.ts`: B keeps the date typed on the first screen in the form (hidden fields on the code screen) and `adultOn` in `PendingSignUp`, written in `makeAccount`'s one transaction, which is where Y adds `birthDate`. The sign-up line "We don't keep your birthday." is still there for Y to change. Not blocked.
- Y's "About you" redirect after sign-up: `finishSignUp` ends with `redirect(303, safeNextPath(next))`, so Y's handle can send the new account on. Not blocked.

## For the fix round

Reds R1 to R5 are in scope, each in its own files as listed. None needs the Owner's choice. After the fixes, this audit's session (or a program) checks each fix on the new commit, and the pull request goes to the full CI run, the visual check, Step 1a and the Owner's approval.
