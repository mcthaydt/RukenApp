# Plan audit: online servers, and a player's birthday and place (cycle 3)

Examined: PR #203 at **0844018**: the spec `docs/superpowers/specs/2026-11-20-online-servers-and-player-place-design.md` as of c656734 (cycle 2's fixes), the merge of `main` at **1ba4b88** (#195 merged), and 0844018's one line in `docs/superpowers/specs/2026-11-17-game-facts-design.md`. Checked against `main` at 1ba4b88, #204 at **9dd05b7**, and `src/features/accounts/auth.ts` and `handle.ts` on `main`.

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## Verdict

**Not ready to merge: 1 red, 1 note.** Cycle 2's three reds and six notes are all answered. The one red is new: the fix for cycle 2's note 2N2 says About you adds no database query, but the files that would make that true are not in Y's list.

## Cycle 2, checked

| Finding | Where it landed | Holds |
|---|---|---|
| C1 `changedAt` | Q+'s "Waits on" and step 1 (a lapse test with H on `main`; H does it if it merges later) | yes, and it matches #204 9dd05b7 F12 |
| C2 not alongside | Y: not alongside Q+, #195's Q or V, or #204's A | yes |
| C3 privacy draft writer | Y's step 0, a lane 1 RukenPrivate pull request merged before Y is marked ready | yes |
| 2N1 #195's Boundaries | 0844018: serverAreas in O; birthday and place in U, after B | yes (a lane 1 doc line in a merged spec) |
| 2N2 under 13, extra read | "Delete my account" offered; read with the session's user | the offer yes; the read see D1 |
| 2N3 CLDR, `Intl.DisplayNames` | Section 5 and Y's step 0 | yes |
| 2N4 three areas listed | Section 5 | yes. Turkey and Cyprus stay in Eastern Europe and Egypt in Africa, with no clash |
| 2N5 copy | Section 3 | yes |
| 2N6 country CHECK | `User_country_check` in U, with its pg tests | yes |

- **The merge of `main`** brings in only #195 and #205. #203's diff against `main` is docs only: the spec, the two earlier audits and the one #195 line.
- **The leak check passes again.** The new lines (the area lists, the copy, the CHECK) name none of the feed's private rules or numbers.

## Red findings

### D1. "No query of its own" needs `auth.ts` and `handle.ts`, which Y does not own

- UNIT: section 5, "When it shows", and section 6, row Y. VERDICT: red.
- REQUIREMENT: `staged-path`, Splitting: each row names "the files it owns"; the spec's own claim in section 5 (2N2).
- REASON: `createHandle` gets the user from better-auth's `getSession`, which returns only the user fields better-auth is told about. Today that is `status`, through `user.additionalFields`. For `aboutYouFirst` to read `birthDate` and `country` with no query of its own, both must be added there (`input: false`) and carried through `SessionInfo`. Those changes are in `src/features/accounts/auth.ts` and `handle.ts`, and neither is in Y's list.
- EVIDENCE: `src/features/accounts/auth.ts:148-155` (`additionalFields: { status: ... }`, with "Read so the request hook can treat an account ... as signed out (sessionInfo)"); `src/features/accounts/handle.ts:18` and `:45-46` (`getSession`, `session.userStatus`). `cookieCache` is off (`auth.ts:162`), so a saved answer is seen on the next request and there is no redirect loop.
- EXPECTED: Y owns the files its stated mechanism changes.
- FIX: Y's Owns adds `src/features/accounts/auth.ts` (two `additionalFields`, `input: false`) and `handle.ts` (`SessionInfo` carries "needs About you"), with their tests. Or drop the "no query of its own" line and keep one read in `aboutYouFirst`. Only the spec.

## Notes

- **D-N1. better-auth's own session answer would then carry the birthday.** With `birthDate` and `country` as `additionalFields`, `/api/auth/get-session` returns them to the signed-in browser. That is the player's own data, so section 4's rule still holds, but Y's privacy test should name that route too: it returns them only for its own session.

## Re-check at df51e59

Examined: **df51e59** (f5a60ce plus one line in section 5 of the spec).

- **D1: fixed.** Section 5 now says `aboutYouFirst` reads `birthDate` and `country` "in one small query by the signed-in user's id, once a page request", and the "no query of its own" claim is gone. It runs after `createHandle` in `src/hooks.server.ts`, which Y owns, and takes the user's id from the caller `createHandle` already makes. So `auth.ts` and `handle.ts` stay unchanged and Y's list is complete.
- **D-N1: no longer applies.** The columns are not added to better-auth's session user, so `/api/auth/get-session` does not return them. The spec gives that as the reason for the choice.
- **No new findings.** The diff is that one line; the leak check passes.

**Verdict at df51e59: 0 red, 0 open notes. The plan audit passes.** The spec can merge on green as a doc. Each lane 3 unit (O, U) still needs its implementation audit and the Owner's approval of its merge.
