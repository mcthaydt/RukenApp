# Playtesting, implementation audit 1

Examined: `e9f22209efc4a27106a504c172e0daba0c5b0776` (branch `claude/project-thread-dndr0a`, PR #460), against `docs/superpowers/specs/2026-11-28-playtesting-design.md` (plan audit PASS at 9fc6fb2) and the owner's design. Lane 3. Opus 5.5, medium. Read only: nothing on the PR branch changed.

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## Verdict

**FAIL: 4 red, 4 notes.** The service, the state table, who may play, the launch guard, deletion, consent and privacy are right and well tested. The reds are a stuck spot for a person with an old invite link, and two checks the criteria name that the PR does not have, and a red phone run in CI that left the phone profile unchecked.

## What ran (in this cloud container, at e9f2220)

- `pnpm lint`: exit 0. `pnpm typecheck`: exit 0, 0 errors.
- `pnpm test`: 171 files, 2461 tests passed.
- `pnpm test:pg` on Postgres 16: 57 files, 992 tests passed.
- Browser, tablet and computer profiles (Chromium), every playtesting journey and standing-check case: `playtest.test.ts` (4 tests), and the playtesting cases of `controls-overlap`, `fits-the-screen`, `gamepad`, `glass` and `real-buttons`: 19 passed, 4 skipped (phone-only or computer-skipped by design), 0 failed. Run with the config's `globalSetup` (warm WebKit) dropped, because WebKit is not installed here.
- Phone profile (WebKit): not run here (no WebKit). CI's quick draft run is the evidence for it; see CI below.

## Tests fail without their fixes (mutations, each put back after)

| Mutation | Check | Result |
|---|---|---|
| `src/lib/pad-moves.ts` back to main's | `tests/lib/pad-moves.test.ts` | the new case fails (1 of 13) |
| `openLink` turns any row to `in` (a link undoes a no or a removal) | `playtest.pg.test.ts` | 8 fail |
| `invite` stops clearing `noticeGoneAt` | `playtest.pg.test.ts` | 4 fail |
| `ask` ignores the switch | `playtest.pg.test.ts` | 2 fail |
| `viewOf` loses the launch guard | `playtest.pg.test.ts` | 1 fails |
| `playBasis` checks member before playtest | `tests/features/play/may-play.test.ts` | 1 fails |

## Merge of main (6 conflicts)

Read with `git show --remerge-diff e9f2220`. All six keep both sides and nothing else:
- `src/routes/+page.svelte`: main's `{#key shown}` quiet refresh, plus `playtest={data.playtest}`. Followed passes `{...data}`, so it carries `playtest` too.
- `src/routes/make/[game]/+page.server.ts`, `+page.svelte`, `src/routes/make/parts/LiveScreen.svelte` (props, types, markup): Test play and Playtesters both kept; Playtesters sits after Test play and above "See it on Ruken", as the spec says.
- `src/routes/your-turn/+page.server.ts`: main's `depends(TAB_DATA)` plus the PR's `cookies`.
- `tests/browser/controls-overlap.test.ts`: both new tests kept, braces right (the file runs).

## Checks asked for

- **Overlap at 320×568, 375×667, 667×375:** the PR's playtesting case passes (Playtesters, the invite sheet, a playtester's feed and game page, an asker's game page). My probe added the asker's feed clip with the badge and a signed-out feed and game page with the badge: no overlap, nothing spilling, on tablet's Chromium (probe: `2026-11-28-playtesting-1-probe-overlap.diff.txt`). See R2: the PR's own journey does not cover the badge on the feed.
- **WCAG AA contrast:** the standing journey (`tests/browser/text-contrast.test.ts`) is #451's and is not on main yet, so it cannot cover these screens in this PR. I ran #451's reader on Playtesters, the invite sheet, a playtester's game page and Your turn, and an asker's game page, at the three sizes: every word passes (probe: `2026-11-28-playtesting-1-probe-contrast-touch.test.ts.txt`). The badge and free line over a white clip pass `glass.test.ts`. Note N1.
- **Input devices:** keyboard and gamepad: the gamepad case passes on the four new screens, and `playtest.test.ts` presses Enter and pad A on a playtester's clip. Mouse: every journey clicks. Touch: my probe tapped Take back, Ask, Say no, Invite, Close, Stop then Keep, and Stop then Stop on a touch page: all work. Trackpad: the new screens have no swipe of their own; the feed's trackpad swipe is unchanged by this PR (`trackpad-swipe.test.ts` untouched, and the badge is a picture, not a control).
- **Owner's design:** by request or invite only (no open-to-all path: `ask` makes `asked`, only a yes, invite or link makes `in`); the feed shows only the badge (Feed.svelte adds the badge and a playtester's Play, nothing else; Ask lives only in `PlaytestAsk` on the game page); "Playtesters →" on Live opens the dashboard with the switch, invite, Let play, say no and Stop; playtest rows are in the player's Your turn only; a playtester plays free before launch whether a member or not (`playBasis` returns `playtest` before `member`, and money reads only `member`).

## Red findings

**R1.** UNIT: `src/routes/p/[token]/+server.ts`, `src/features/playtest/service.ts` (`newLink`, `openLink`), `prisma/schema/playtest.prisma` and this PR's migration. VERDICT: red. REQUIREMENT: the spec, "What a person sees", the invite link: "after which the old link lands on the game's page and does nothing"; the owner's rule that nobody gets stuck anywhere. REASON: an old (replaced) link sends the person to the feed with no word of why, so the game they were sent to is lost. EVIDENCE: `+server.ts` line 20, `redirect(303, slug === null ? "/" : ...)`; `newLink` overwrites the only token row, so the old token names no game. The PR names the deviation; its reason is the storage the PR chose, and the migration has not run anywhere yet, so it is still cheap to change. EXPECTED: an old link lands on the game's page (with nothing changed, as now). FIX: keep replaced tokens, e.g. a `PlaytestOldLink { token @id, gameId, replacedAt }` table written by `newLink` in the same transaction (or a `replacedAt` on the link rows), still only adding in the migration; `openLink` looks there when the current token misses and returns the slug without changing anything; `deletion.ts` deletes them with the maker's links; the migration test, the state-table link cases and the invite journey's "old link" step assert the game's page. Files: the schema, the migration, `service.ts`, `deletion.ts`, `p/[token]/+server.ts`, `privacy/+page.svelte` if the old tokens need a line, and their tests.

**R2.** UNIT: `tests/browser/controls-overlap.test.ts` and `tests/browser/fits-the-screen.test.ts` (the playtesting cases). VERDICT: red. REQUIREMENT: criterion 13, the checks pass "on the feed and game page with the badge and the extra line"; the owner's standing overlap rule (2026-11-27 23:12 UTC). REASON: the badge on a feed clip is never measured: the overlap case runs the feed only as the playtester (Play and the free line, no badge) and the fit case runs no feed at all. EVIDENCE: `controls-overlap.test.ts` lines 287 to 289 (`tester` on `/`, `asker` only on `/g/...`); `fits-the-screen.test.ts` lines 343 to 346 (three game or maker pages). My probe found no overlap today, so this is a missing check, not a broken screen. EXPECTED: the badge on the feed is in the standing checks at the three sizes, for an asker and for someone signed out. FIX: add `["/"]` for `scene.asker.page` (clip `scene.slug`) to the overlap case, and a signed-out page on `/` before launch; add the asker's `/` to the fit case. Only those two test files.

**R3.** UNIT: route tests for `src/routes/make/[game]/playtesters/+page.server.ts`, `src/routes/g/[game]/playtest/+server.ts`, `src/routes/your-turn/remove/+server.ts`. VERDICT: red. REQUIREMENT: criterion 8, "(route + database tests)": someone who is not the maker gets 404 from every Playtesters address and action; nobody can ask for their own game; a player's Remove on another's row is 404. REASON: only the service is tested; no test reaches these routes as the wrong person. EVIDENCE: no file under `tests/routes/` names `playtesters`, `playtest` or `your-turn/remove`; `playtest.test.ts` has no 404 step (grep for `status` finds none). The code is right on reading (`ownGame` 404s; the ask route 404s the maker; `hide` returns not found), so this is a missing check. EXPECTED: a test that fails if a route stops refusing. FIX: route tests (or journey steps with `page.request`) that, as a second account, GET `/make/<g>/playtesters` and POST each of `?/asking`, `?/answer`, `?/remove`, `?/invite`, `?/newLink` and see 404 and no change; as the maker POST `/g/<g>/playtest` and see 404; and POST `/your-turn/remove` with `kind=playtest` and someone else's row id and see 404. New test files only, or `tests/browser/playtest.test.ts`.

**R4.** UNIT: CI at e9f2220, phone profile. VERDICT: red. REQUIREMENT: criterion 15 (browser suites pass in CI); CLAUDE.md Verification (a test that fails once and passes on retry is a defect; pull request runs never retry). REASON: the quick run is red on the phone, and because it stopped there, the playtesting journeys never ran in WebKit. EVIDENCE: job 140941507948, `tabs-show-now.test.ts:153`, clip `tiny-game-40577fc0` on screen instead of `tiny-game-87aa2ce3`; green on main's first try at 7d058b7; this PR changes the Followed load (`src/routes/followed/+page.server.ts` now also awaits `feedStateFor` over every live game and `hasNew`) and `Followed.svelte`, which that journey goes through. EXPECTED: the phone profile passes, the playtesting journeys included. FIX: reproduce on WebKit in CI (run that journey on the phone profile, several times); if the Followed load's extra work is what changes the timing, fix it there; if it is a flake that main also has, record it under "Flaky tests" in `progress.md` with its trigger and fix it in its own change, and get a green phone run of the playtesting journeys at the new head either way. Files: `src/routes/followed/+page.server.ts`, `src/features/feed/` only if the cause is there, `progress.md`.

## Notes (not blocking)

- **N1.** The WCAG AA journey (#451) should list `/make/<game>/playtesters` and `?invite` once both are on main; whichever merges second adds them. Recorded as a follow-up for the coordinator.
- **N2.** The PR body says "Asking is sorted by time, oldest first"; the code (`pageFor`, `askedAt: "desc"`) and the spec say newest first. The body should say newest first. No test checks the order.
- **N3.** The invite sheet is its own `dialog` in `PlaytestersScreen.svelte` with the share sheet's classes, not `ShareSheet.svelte` in an invite form as plan unit 5 named. It looks and works the same (overlap, fit, pad, real buttons pass); the PR body could name it.
- **N4.** "Free until it opens on 30 November." is typed in `words.ts` rather than read from the launch date, as the Wishlist line does. Fine while the date is fixed.

## CI at e9f2220

CI run 46132811948 (quick, draft) is **red**. `verify (quick, draft)` and `postgres (quick, draft)` passed; `commit-authors` and `pr-rules-run` passed. `browser shard 1 of 6 (quick, draft)` failed on the **phone** profile: `tabs-show-now.test.ts:128` "a tab shown from a page asked for ahead takes in what is new without moving the clip on screen", at line 153: the clip on screen was `tiny-game-40577fc0`, expected `tiny-game-87aa2ce3` (128 passed, 1 failed, 1 interrupted, 406 did not run). The draft run stops at the first failure, so shards 2 to 6 were cancelled and **no playtesting journey ran on the phone profile**. The same test passed on its first try in main's full run at 7d058b7 (run 46130716068; its gate lists only `real-buttons.test.ts:201` as passing on try 2), and passed 6 of 6 here on tablet and computer (Chromium, `--repeat-each 3`). WebKit is not installed here, so I could not reproduce it. See R4.

## What I did not check

The phone profile (WebKit) locally; the screens page and design rounds, which are the slice end's.
