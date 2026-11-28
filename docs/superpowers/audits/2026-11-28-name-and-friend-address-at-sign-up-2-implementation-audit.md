# Implementation audit 2: a name and an address for every account (#465)

- Examined: `claude/project-thread-adrwam` at `12e47f4` (full `12e47f4feac13689a9671f0ccea5367339520e7c`), against `docs/superpowers/specs/2026-11-28-name-and-friend-address-at-sign-up-design.md` (plan audit 6 PASS at `ee89b36`) and implementation audit 1 (FAIL at `c9e220f`, R1 and R2).
- Lane 3 (migration `prisma/migrations/20261128093000_page_listed`, additive). Auditor: Opus 5.5, medium, a fresh session that did not build it.
- Written 2026-11-28 13:05 UTC.

**Verdict: PASS, 0 red.**

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## What ran

- In this cloud container, at `12e47f4`: `pnpm lint` (0), `pnpm typecheck` (0 errors, 0 warnings), `pnpm test` (2469 passed), `pnpm test:pg` on Postgres 16 (846 passed).
- CI at `12e47f4` (run 46144360954, attempt 1, no retries): `verify`, `postgres` and all six browser pieces passed, `gate (quick, draft)` passed. The PR touches `prisma/`, so the draft run ran every journey (`RUN_EVERYTHING_WHEN`), on phone (WebKit), tablet and computer: 2658 passed, 180 skipped, 0 failed across the six pieces.
- Each fix's check fails by itself: with `taken.add(avoid)` removed, the new `service.pg.test.ts` case fails (`expected 'taken-down' to match /^taken-down-\d{4}$/`); with `pad-moves.ts` before `c162dac`, the new "lines that touch" case fails.
- Probe `docs/superpowers/audits/2026-11-28-name-and-friend-address-at-sign-up-2-probe-pad.test.ts.txt`: on 31 screens (signed out and in, feed, tabs, search, sign-in and sign-up, help and legal pages, a game page and its price card, Your account and every room under it, Your feed, Your games, a new game's first question, the page editor and take-down) at 320x568, 375x667, 667x375 and 1280x800, every control's left and right move under main's `pad-moves.ts` and under the PR's. Computer and tablet gave the same 14 differences, listed in the probe.
- No WebKit in this container, so the phone engine is checked by CI only (above).

## R1 (pad cannot reach "Your name" on a small iPhone): fixed

- `src/lib/pad-moves.ts`: left and right rank a box whose shared height with the focus is 2px or less (`TOUCHING`) as off the row, so a link on the line above that only touches no longer beats the link beside it. Up and down are unchanged; a touching line is still taken when nothing else lies that way (second new unit case).
- CI phone: `gamepad.test.ts:381` "signed in, the pad reaches everything on You, Your name, …" passed, and every other `gamepad.test.ts` journey passed on phone, tablet and computer (the signed-out screens, the feed and its clip line, Share, the game page and price card, Your turn, the page rooms, a maker's questions and Check and send).
- App-wide effect (probe): only 14 moves change, all toward the same line. On Your account (`/me`) right from Your computers now goes to Your name (the R1 case), left from Delete my account to Sign out, and left from Change password to Your feed; on the feed, right from Play goes to the next control in the rail; in the bar at 667x375 right from Save goes to Add a game, not Home; on a new game's first question right from the field goes to Next, not Back. None makes a control unreachable (no move went from a control to none), and the reach journeys above pass.
- CI also ran the unchanged `fits-the-screen`, `controls-overlap` and `look-layout` on all three profiles, green.

## R2 (take-down remade the page at the address just freed): fixed

- `makeUnlistedPage(userId, name, avoid)` adds `avoid` to the taken set; take-down passes `page.handle`. Sign-up and the name question call it without `avoid`, so they keep the name's own address first.
- `service.pg.test.ts`: a page at `taken-down`, taken down, is made again at `taken-down-NNNN`, and a second account then gets `taken-down`. Passes here; fails without the fix.
- `edit-page.test.ts`: the existing take-down step checks the remade page is unlisted with the same name at another address; the new journey lists a page at the address sign-up made from the name, takes it down, and a second account takes that address ("Saved. Your page is live."). Both passed on all three profiles in CI.

## The whole change, again

- Criteria 1 to 13 as in audit 1; since `c9e220f` the change adds only the two fixes, the removal of the one-off measure test (`tests/browser/tmp-measure.test.ts` is gone), the main merge `d63049c` (`git show --remerge-diff` empty: no hand edits) and `d41768e` (`/your-turn/stopped` left the gate's list, as main removed that route; `tests/hooks/people-screens.test.ts` still places every route folder in exactly one list, passed).
- Overlap: `controls-overlap.test.ts` (320x568, 375x667, 667x375, with `/me/name` and the unlisted maker's clip and game page) passed on all three profiles in CI.
- CRUD: unchanged from audit 1 and green in CI: the name is created at sign-up and read on Your turn and the share sheet, updated from Your account, deleted with the account (`your-name`, `friends-from-sign-up`); the page is listed, edited and taken down (`edit-page`), now with the freed address taken by someone else.
- The pull request body names the changed tests and why (`pad-moves.test.ts`, `service.pg.test.ts`, `edit-page.test.ts`), says the lane, and ends "Requested by **McThayDT**".

## Notes (not blocking)

- N1. `main` moved to `c82fc88` (#466) after `d4a43d4`: `docs/superpowers/progress.md`, `tests/browser/feed-controls.test.ts` and `tests/browser/tabs-show-now.test.ts`. `git merge-tree` merges it with `12e47f4` cleanly. By the owner's rule (2026-11-27 22:23 UTC) a PASS carries through a clean main merge.
- N2. The body's "Checks run" still says the phone profile has not run; CI run 46144360954 has now run it, green.
- N3. Audit 1's N2 stands: `/me/name` returns the name as typed (`src/routes/me/name/+page.server.ts:29`), not the cleaned one that is kept.
