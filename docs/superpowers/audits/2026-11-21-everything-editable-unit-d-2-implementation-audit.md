**0652b4b FAIL: 3 red**

# Everything editable, unit D (change email and password): implementation audit 2

- Branch: `claude/project-thread-evc10x`, commit examined 0652b4b (the fix of audit 1, `168a614`). Merges cleanly with `main` 385b146. No pull request yet.
- Brief: `docs/superpowers/specs/2026-11-21-everything-editable-design.md` section 5.4, criteria G1 to G6 and D1 to D7, and audit 1's four reds.
- Lane 3 implementation audit, round 2, a fresh session (Opus 5.5, medium). Written 2026-11-21 16:33 UTC (from `date`).
- Prompt: Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## What ran (in this container, at 0652b4b)

| Check | Result |
| --- | --- |
| `pnpm lint` | pass |
| `pnpm typecheck` | pass, 0 errors |
| `pnpm test` | 117 files, 1688 tests pass |
| `pnpm test:pg` (local Postgres 16) | 43 files, 657 tests pass |
| `tests/browser/change-credentials.test.ts`, computer and tablet | 14 of 14 pass |
| same, phone (WebKit) | not run: no WebKit build in this container. CI must run it. |
| The new regression test with the hook line removed from `auth.ts` | fails as it should (`an old link does not take over ...`), so it is a real check |
| Probe tests P1 to P4 (not committed; below) | P1 reproduces red 1, P4 reproduces red 2 |

## Audit 1's reds

| Red | Result |
| --- | --- |
| R1 stale change-email link | partly fixed: the newcomer who signs up with the old address is safe; an older account that moves to the old address is not (red 1 below). The refusal also answers raw JSON (red 2 below). |
| R2 typed address kept | fixed. Every `changeEmail` refusal returns `email: form.email`; the input has `value={form?.email ?? ""}`; the journey checks the box keeps the address and the password box is empty. |
| R3 keyboard journey | partly fixed: the two buttons are reached with Tab and show focus; the two links on `/me` are not (red 3 below). |
| R4 purge test | fixed. The test runs `requestDeletion`, advances 15 days, runs `purgeDueAccounts` (answers 1), opens the link and checks `deleted-<id>@deleted.invalid` and no session. |

## Red findings

### Red 1. A stale change-email link still takes over an older account that moves to the old address

- UNIT: `src/features/accounts/auth.ts`, `refuseStaleChangeLink`.
- VERDICT: red.
- REQUIREMENT: audit 1 red 1's EXPECTED: "a change-email link works only for the account that asked for it. Opened after its address moved to another account, it changes nothing and signs nobody in." Section 5.4 and N3.
- REASON: the hook compares the token's `iat` with the holder's `createdAt`, which is when the account was made, not when it got the address. An account made before the link that changes its own address to the freed one passes the check. The anchor is wrong: the link must be tied to the account that asked.
- EVIDENCE: probe P1, real flow end to end. Y signs up; a second later X signs up. X asks for A to B and keeps the B link; X asks for A to C and opens that link (A is free). Y asks to change to A and opens its link with Y's cookie (Y now holds A). The B link is then opened with no cookie. Output: `P1 open 302 /me Y email now p1-b@example.test Y sessions 1 -> 2 set-cookie rk_session=...`. Y's address is now X's B and the opener holds a session in Y's account. Sign-up signs in without a confirmed address (`autoSignIn: true`, no `requireEmailVerification`), so X never needed to own mailbox A to hold it and set the trap; the window is the link's life, one day.
- EXPECTED: the B link changes nothing and signs nobody in, whoever holds A now, including an account older than the link.
- FIX: bind each change link to the account that asked, using better-auth's existing `Verification` table (no new table, no migration). In `sendVerificationEmail`, for a change token, store `{ identifier: "change-email:" + sha256(token), value: user.id, expiresAt }` inside the same background task that sends the mail (before the send), so a free address and a taken one still answer in the same time. In the `/verify-email` hook, for a change token, refuse unless that row exists and its `value` equals the id of the account holding `claims.email`. When a change finishes (`emailVerification.afterEmailVerification`, or the same hook after success), delete that account's other `change-email:` rows, so an older open link dies with it (this also closes P2 below). Drop the `createdAt`/`iat` test or keep it as a second guard. Add P1 as a pg regression test that fails before the fix. Files: `src/features/accounts/auth.ts`, `tests/features/accounts/credentials.pg.test.ts`. If the implementer reads section 5.4's "needs a table" as covering this, it stops and the coordinator brings it to the owner instead.

### Red 2. A refused stale link shows the person raw JSON, not better-auth's redirect

- UNIT: `src/features/accounts/auth.ts`, `refuseStaleChangeLink`.
- VERDICT: red.
- REQUIREMENT: audit 1 red 1's FIX ("refuses with better-auth's `INVALID_TOKEN` redirect"); the drunk-grandma rule in CLAUDE.md. The code comment says "better-auth answers a bad link the same way", which is not so.
- REASON: the hook throws `APIError("BAD_REQUEST")`. better-auth answers a bad link from a mail (which carries `callbackURL=/me`) with a 302 to `/me?error=INVALID_TOKEN`.
- EVIDENCE: probe P4, same link shape: `P4 stale 400 null {"message":"Invalid token","code":"INVALID_TOKEN"}` against `P4 badtoken 302 /me?error=INVALID_TOKEN`. A person who opens an old link sees a page of code.
- EXPECTED: the refused link lands where any other bad link lands (`/me?error=INVALID_TOKEN`).
- FIX: in the hook, `throw ctx.redirect("/me?error=INVALID_TOKEN")` with that fixed path, not the query's `callbackURL`: the hook runs before better-auth's own `originCheck` on that endpoint, so redirecting to a `callbackURL` from the query here could send people to another site. Assert the 302 and its `location` in the regression test(s). Files: `src/features/accounts/auth.ts`, `tests/features/accounts/credentials.pg.test.ts`.

### Red 3. The keyboard journey does not Tab to the two links on /me

- UNIT: `tests/browser/change-credentials.test.ts`, "everything on both screens works with the keyboard alone, and focus shows".
- VERDICT: red.
- REQUIREMENT: G2 ("a journey tabs to and presses each new button") and audit 1 red 3's EXPECTED ("reaches each of the two links on `/me` and each of the two buttons with Tab, checks focus is visible").
- REASON: the links are reached with `link.focus()`, which also focuses an element Tab can never reach (for example `tabindex="-1"`), and their focus ring is not checked.
- EVIDENCE: the loop over `["Change email", ...]` calls `await link.focus()` then `toBeFocused()`; there is no `keyboard.press("Tab")` and no outline check before Enter.
- EXPECTED: from `/me`, Tab presses move focus to each link, its focus ring shows, and Enter opens its screen.
- FIX: replace `link.focus()` with pressing Tab until the link is focused (a bounded loop, failing after a set number of presses), then check `outline-style` as the buttons do. File: `tests/browser/change-credentials.test.ts`.

## Other questions the coordinator asked about the stale-link fix

- **Clock skew.** `iat` comes from the app's clock, `createdAt` from Postgres `now()`. A skew only matters for an account made within seconds of the link, while the attack needs the old address to be freed and taken after it; the one-second allowance is fine. Red 1's fix does not use time at all.
- **An old address reused by the same person (P2).** X asks A to B, then A to C (opens it), then C back to A (opens it). The old B link then still moves X to B: `P2 open 302 X email now p2-b@example.test`. Only the asker's own account moves, to an address the asker typed, so this alone is a note; red 1's fix (a finished change ends the other open links) closes it.
- **Several open links.** Covered by P1 and P2: each link stays good for a day whatever happens after it. Red 1's fix ties each to its account and ends the others when one is used.
- **A forged token (P3).** The hook reads the claims before the signature is checked, but it can only refuse, never let through. A forged token with any `iat` and a junk token both answer 401 from better-auth. The token is signed HS256 and parsed with `JSON.parse` both here and in `jose`, so the claims the hook reads are the ones better-auth trusts.
- **Other ways in.** Every reachable change token has `requestType: "change-email-verification"` (the one without it, in `update-user.mjs` line 448, is made and thrown away), so the hook cannot be stepped around through better-auth's legacy branch. The token's address is lowercased by better-auth, and `findUserByEmail` lowercases too, so the hook's lookup matches the one better-auth makes.

## Criteria

| Criterion | Result | Evidence |
| --- | --- | --- |
| G1 | not yet | no pull request; local results above |
| G2 | red 3 | |
| G3 | pass | unchanged since audit 1 |
| G4 | pass | R2 fixed; red 2 is the link's landing, counted there |
| G5 | pass | the one changed test (D7 purge test) was audit 1's own finding |
| G6 | note 1 (audit 1) | unchanged |
| D1 to D6 | pass | unchanged since audit 1; suites green |
| D7 | pass | R4 fixed |

## Probes (in the shape of `credentials.pg.test.ts`, not committed)

P1, the one red 1 rests on:

```ts
const y = await accountWithSession(); // made before the link
await new Promise((r) => setTimeout(r, 1100));
const x = await accountWithSession();
await changeEmail(formEvent({ email: "p1-b@example.test", password: PASSWORD }, x.cookie, "198.51.100.1"), deps(), x);
await settle();
const staleLink = linkTo("p1-b@example.test");
await changeEmail(formEvent({ email: "p1-c@example.test", password: PASSWORD }, x.cookie, "198.51.100.2"), deps(), x);
await settle();
await theAuth().handler(new Request(linkTo("p1-c@example.test"), { headers: { cookie: x.cookie, origin: ORIGIN } }));
await changeEmail(formEvent({ email: x.email, password: PASSWORD }, y.cookie, "198.51.100.3"), deps(), y);
await settle();
await theAuth().handler(new Request(linkTo(x.email), { headers: { cookie: y.cookie, origin: ORIGIN } }));
await theAuth().handler(new Request(staleLink, { headers: { origin: ORIGIN } }));
// expected: Y keeps x.email and has only its own session
```

## Notes (not blocking; recorded, not fixed here)

1. Audit 1's notes 2, 4, 6 and 7 stand as written.
2. Audit 1 note 3 stands: an address taken between the ask and the click still answers 500 when the link is opened.
3. Audit 1 note 5 stands: phone sign-in (#209) has not reached `main` yet (`main` is 385b146). If it lands first, this unit needs a way for accounts with no password, and `PAGE_ONLY_PATHS` and the limits will meet #209's changes.
4. `/me` ignores `?error=INVALID_TOKEN`, so an expired or refused change link lands on `/me` with no word about why. This was so before this unit for better-auth's own errors; a plain line ("That link no longer works. Ask for a new one.") would help. Product polish, not this unit's criteria.
