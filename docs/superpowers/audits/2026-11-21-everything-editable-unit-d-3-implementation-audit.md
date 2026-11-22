**25c3d1d PASS**

# Everything editable, unit D (change email and password): implementation audit 3

- Branch: `claude/project-thread-evc10x`, commit examined 25c3d1d (the fix of audit 2 is `cad6d14`; 25c3d1d only removes the live-state file). Merges cleanly with `main` 385b146. No pull request yet.
- Brief: `docs/superpowers/specs/2026-11-21-everything-editable-design.md` section 5.4, criteria G1 to G6 and D1 to D7, and audit 2's three reds.
- Lane 3 implementation audit, round 3, a fresh session (Opus 5.5, medium). Written 2026-11-21 16:49 UTC (from `date`).
- Prompt: Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.
- Since audit 2 the fix touches only `src/features/accounts/auth.ts`, `tests/browser/change-credentials.test.ts`, `tests/features/accounts/credentials.pg.test.ts` (plus audit 2's own file).

## What ran (in this container, at 25c3d1d)

| Check | Result |
| --- | --- |
| `pnpm lint` | pass |
| `pnpm typecheck` | pass, 0 errors, 0 warnings |
| `pnpm test` | 117 files, 1688 tests pass |
| `pnpm test:pg` (local Postgres 16) | 43 files, 659 tests pass |
| `tests/browser/change-credentials.test.ts`, computer and tablet | 14 of 14 pass |
| same, phone (WebKit) | not run: no WebKit build in this container. CI must run it (G1). |
| Mutation M1: the `/verify-email` hook call removed from `auth.ts` | the 3 stale-link pg tests fail, the other 9 pass. They are real checks. |
| Mutation M2: the `deleteMany` in `afterEmailVerification` removed | "a finished change ends the account's other open links" fails alone. Real check. |
| Mutation M3: `tabindex="-1"` on the "Change password" link on `/me` | the keyboard journey fails at `toBeFocused` after its bounded Tab walk. Real check. |
| Probes P5, P8, P10, P11 (not committed; below) | all as expected |

All mutations and probe files were reverted; the working tree is clean at 25c3d1d.

## Audit 2's reds

| Red | Result | Evidence |
| --- | --- | --- |
| R1 stale link takes over an older account | closed | `sendVerificationEmail` (change token) writes a `Verification` row `{ identifier: "change-email:" + sha256(token), value: user.id }` before the mail goes. better-auth's `changeEmail` passes `user: { ...session.user, email: newEmail }` (`update-user.mjs` 498-505), so `value` is the asker's id. The `/verify-email` before-hook refuses unless a live row names the account that holds the token's old address. New pg test (audit 2's P1) passes and fails under M1. |
| R2 refused link shows raw JSON | closed | the hook throws `ctx.redirect("/me?error=INVALID_TOKEN")`, a fixed path. Tests assert 302 and the `location`. Probe P11: a refused link carrying `callbackURL=https://evil.example/x` still lands on `/me?error=INVALID_TOKEN`; the account holding the address keeps it and gets no new session. |
| R3 keyboard journey does not Tab | closed | the journey starts at `/me`, presses Tab at most 12 times until the link is focused, checks `outline-style`, presses Enter and checks the heading. M3 shows it fails when a link is not reachable by Tab. |

## Questions the coordinator asked

- **Spec 5.4's "needs a table".** The builder stores the binding in better-auth's existing `Verification` model (`prisma/schema/accounts.prisma` 117). No schema file or migration changes. The spec's stop rule is about better-auth needing a schema change to do change-email; this adds rows to a table that exists and that better-auth already uses for this kind of thing. The reading holds, and it is what audit 2's FIX asked for. The pull request body should say so in one line, so the owner sees it.
- **Free and taken addresses still answer alike (D4).** Probe P5: a free address answers `{"sentTo":"p5-free@example.test"}` and a taken one `{"sentTo":"change3@example.test"}`, the same shape (each names what was typed). Before the background work runs there are 0 rows for the free one; after it, 1. The taken one gets 0 rows and 0 mails, since better-auth returns before calling `sendVerificationEmail`. The row write sits inside `mailLater`, after the answer, so it adds no time to the free case (140 ms against 117 ms in one run, both dominated by the password check; one sample, not a timing proof).
- **A link reused after its own change (P10).** Opened once: 302 `/me`, and the account's change rows go to 0. Opened again: 302 `/me?error=USER_NOT_FOUND` (nobody holds the old address). Nothing changes.
- **The real flow back to the old address (P8).** X asks A to B (keeps the link), A to C (opens it), then C back to A through the form (opens it). The B link then answers 302 `/me?error=INVALID_TOKEN` and X keeps A. Audit 2's P2 note is closed by the real flow, not only by the committed test's hand update.
- **Other ways around the hook.** Unchanged from audit 2: every reachable change token carries `requestType: "change-email-verification"`; `sendChangeEmailConfirmation` and `updateEmailWithoutVerification` stay off (`auth.ts` 241-242), so the confirmation and legacy branches are not reached. A forged token can only be refused by the hook, never let through, because better-auth checks the signature afterwards.
- **Clock.** The row's `expiresAt` and the hook's comparison both use the injected `clock`, so they agree in tests and in production. The token's own expiry (one day) is checked by `jose` on real time and matches the row's day.

## Red findings

None.

## Criteria

| Criterion | Result | Evidence |
| --- | --- | --- |
| G1 | not yet | no pull request; local results above; phone (WebKit) journeys only in CI |
| G2 | pass | R3 closed; M3 |
| G3 | pass | unchanged since audit 1 |
| G4 | pass | R2 closed |
| G5 | pass | changed tests are this unit's own; the D7 purge test was audit 1's finding |
| G6 | pass | fix touches only the unit's files |
| D1 to D6 | pass | suites green; D4 rechecked by P5 |
| D7 | pass | unchanged since audit 2 |

## Notes (not blocking; recorded, not fixed here)

1. Audit 1's notes 2, 3, 4, 6 and 7 and audit 2's notes 2 to 4 stand: an address taken between the ask and the click still answers 500 when opened; phone sign-in (#209) may land first and then needs a no-password path; `/me` says nothing about `?error=INVALID_TOKEN` or `USER_NOT_FOUND`, so a refused or expired link lands on `/me` with no word about why ("That link no longer works. Ask for a new one." would help).
2. Change-link rows are never deleted when they expire (only when a change finishes), and a purged account's open rows stay until then. They hold a hash and an account id, nothing personal, and the hook ignores expired rows. better-auth's own rows in that table behave the same. A cleanup is a follow-up, not this unit.
3. The keyboard journey's walk is bounded at 12 presses. If `/me` grows more than about a dozen focusable things above the links, it will fail and need a larger bound; that is the intended failure, not a flake.

## Probes (in the shape of `credentials.pg.test.ts`, not committed)

- P5: X asks a free address, Y asks an address another account holds; compare answers, rows before and after `settle()`, and mails to the taken address.
- P8: X asks A to B (keep link), A to C (open), C to A through `changeEmail` (open), then open the B link with no cookie.
- P10: a good link opened twice.
- P11: after P10, someone signs up with X's old address; the B-style link is opened with `callbackURL` changed to `https://evil.example/x`.

Output:

```
P5 {"sentTo":"p5-free@example.test"} | {"sentTo":"change3@example.test"} rowsBeforeSettle 0 rowsFree 1 rowsTaken 0 mailsToTaken 0 ms 140 117
P8 302 {"sentTo":"change7@example.test"} 302 /me afterReturn change7@example.test oldLink 302 /me?error=INVALID_TOKEN now change7@example.test
P10 302 /me 302 /me?error=USER_NOT_FOUND rows 0
P11 302 /me?error=INVALID_TOKEN zEmail change9@example.test zSessions 1
```
