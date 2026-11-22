# Plan audit 5: Ruken from your computer (a command line and an MCP for makers)

- Reviewed: PR #318, head `439da17` (spec `docs/superpowers/specs/2026-11-22-ruken-from-your-computer-design.md`, reworked after plan audit 4 at `c67ba76`). Code read at the same commit (the PR changes only docs; the code under it is `main`).
- Lane: 3 (PR 1 has a migration and a new way to sign in). Reviewer: fresh session, Opus 5.5, medium. Started 2026-11-22 14:16 UTC (from `date`).
- Owner decisions: D1 (press Yes) and D3 (no agent tool for throw away or take the page down) decided and recorded. D2 (npm) is open; this audit assumes neither option.
- Prompt: Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

**Verdict: PASS, 0 red, 2 notes.** Both of audit 4's reds are fixed in the spec and agree with the code. No new red found.

## Audit 4's reds, checked one by one

| Red | Fixed? | What was checked |
|---|---|---|
| R4-1 where the agreement is asked | Yes | Spec 5.3 now says `sendWhenAgreed(db, service, gameId, userId)` is called only by the check screen's `send` and by `POST .../send` for a `draft`; the game screen's `send` (sent back), `sendAgain`, `newVersion`, the API's sent-back and live sends, `new-version`, `put-back` and live saves call `sendForReview` as today. Code agrees: `src/routes/make/[game]/check/+page.server.ts` has one action, `send`, and checks `hasAgreed` in `whereItIsNotReady` only for `draft`/`waiting` (a `waiting` game is redirected before the send); `src/routes/make/[game]/+page.server.ts` `send` (sent_back), `sendAgain` (live, `liveSend === "again"`) and `newVersion` (`pullLatest` then `sendForReview`) have no agreement check. PR 2's checklist line and 3.2 row 63 say the same. 5.4's MCP refusal words still fit (they apply only to a draft). |
| R4-2 `/link` shadowing a maker page | Yes | The Yes screen is now `/me/link` (4.1, 4.5, Owns `src/routes/me/link/`, PR 1 checklist). `me` is in `RESERVED_HANDLES` (`src/features/pages/handle.ts:16`), so no new reserved word and `handle.test.ts` stays green. `/me` has no layout guard; each screen calls `signedInOnly(locals.caller, url)`, which sends a signed-out person to `/sign-in?next=<pathname + search>` (`src/features/accounts/pages.ts:19-21`), so `?code=KBTR-WMPQ` survives the sign-in as 4.1 step 2 needs. `tests/routes/link.pg.test.ts` is gone from Owns and the checklist; the place cases moved to `placeWarning` in `computer-keys.ts`, tested in `computer-keys.pg.test.ts` (both already owned), which is audit 4's N4-3 pattern. A2 points the warning case there (N4-1). |

Audit 4's notes: N4-1 (A2 points to `computer-keys.pg.test.ts`), N4-2 (`sendWhenAgreed` names `db` and `service`) and N4-3 (`placeWarning` in `computer-keys.ts`) are all in the spec.

## Red findings

None.

## Notes (not blocking, recorded)

- N5-1. A4 lists `/me`, `/me/password` and `/me/delete` as routes a key cannot open. The two new screens under `/me`, `/me/link` (pressing Yes makes a new key) and `/me/computers` (rename, remove), are the most valuable to a stolen key and are not named. The design already keeps keys to `/api/v1` (4.3), so this is a check gap, not a design gap. Suggest adding both to A4's list in PR 1's journey. Files: the spec's A4 line, or PR 1's journey directly.
- N5-2. 4.5 says the warning cases run "with a test platform whose `placeOf` answers what each test sets", but `placeWarning(startedFrom, here)` takes two places and needs no platform. The platform is needed only where `start` records `startedFrom`. Either reading works; the implementer should test `placeWarning` as the pure function it is and test `startedFrom` being recorded through a test platform.

## Codebase checks run

- `grep -rn "readdirSync\|globSync" tests`: the folder-scanning tests (`handle.test.ts`, `loading-states.test.ts`, `look.test.ts`, `architecture.test.ts`) apply to any new screen under `/me/` as the rules they already are; none needs a new list entry for `/me/link` or `/me/computers`.
- 5.4 and 3.2 row 63 agree on the MCP's draft-only agreement refusal.

## Fix check

Nothing to fix before the build. The build still waits on the owner's D2.
