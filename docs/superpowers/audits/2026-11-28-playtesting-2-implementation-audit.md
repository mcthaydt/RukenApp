# Playtesting, implementation audit 2

Examined: `84fe4a0eeb3c072c58a6dbf18d6904256bd8cab3` (branch `claude/project-thread-dndr0a`, PR #460), against `docs/superpowers/specs/2026-11-28-playtesting-design.md`, audit 1 (`aef792c` on `claude/project-thread-lqfq06`, FAIL with 4 red at `e9f2220`) and the owner's design. Lane 3. Opus 5.5, medium. Read only: nothing on the PR branch changed.

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## Verdict

**PASS: 0 red, 3 notes.** All four reds from audit 1 are fixed and each fix is checked by a test that fails without it. The owner's design holds, nothing leaks a maker's no or a player's age, every journey passes, and CI's quick run is green on its first try. The merge still needs the full run that marking the PR ready starts.

## What ran (in this cloud container, at 84fe4a0)

- `pnpm lint`: exit 0. `pnpm typecheck`: 2416 files, 0 errors, 0 warnings.
- `pnpm test`: 171 files, 2460 tests passed.
- `pnpm test:pg` on Postgres 16: 57 files, 992 tests passed.
- Browser, tablet and computer profiles (Chromium), with the config's WebKit warm-up dropped (no WebKit here): `playtest.test.ts` (4), `playtest-refusals.test.ts` (2), the playtesting cases of `controls-overlap`, `fits-the-screen`, `gamepad`, `glass`, `real-buttons`, and `tabs-show-now.test.ts:128` and `:168`: 25 passed, 1 skipped (`controls-overlap` playtesting case on computer, phone sizes only by design), 0 failed, no retries.
- Node 22 here; the repo asks for 24. Nothing failed for it.

## Audit 1's reds

**R1 (old invite link): fixed.** `newLink` now moves the old token to `PlaytestOldLink` in the same transaction (`service.ts`, `skipDuplicates` for two presses at once); `openLink` falls back to it and returns the slug without writing anything; `/p/[token]` sends it to `/g/<slug>`; `deletion.ts` deletes old links with the maker's links; the privacy page says old links are kept. The migration only adds (`migration.test.ts` allows exactly the new table, index and foreign key). Mutation: making the old-link branch return null fails 2 tests in `playtest.pg.test.ts` ("the old one leads to the game and does nothing", "an old link leaves a waiting ask waiting"). The invite journey now expects the game's page, and no Play tag, after the old link. Games are never deleted (purge only takes them off), so the `Restrict` foreign key blocks nothing.

**R2 (badge never measured): fixed.** `controls-overlap.test.ts` now brings the asker and a signed-out person to the badged clip, asserts the badge is shown, and runs the check on `/` and the game page at the three sizes. `fits-the-screen.test.ts` asserts the badge is whole in view, the page does not scroll, and the badge is clear of the bar. See note N1 on what the overlap check does and does not count. My probe (`2026-11-28-playtesting-2-probe-badge.test.ts.txt`) measured the badge box against every control, the bar and the friends' faces at 320×568, 375×667 and 667×375, for an asker, a signed-out person, a signed-out person who has not said yes to cookies, and an asker in Home Screen mode: clear in all 12.

**R3 (refusals not tested at their addresses): fixed.** `tests/browser/playtest-refusals.test.ts`: as the asker, GET the Playtesters page and `?invite` and POST `asking`, `answer`, `remove`, `invite`, `newLink`: each 404, then the maker's page shows asking still on, the ask still waiting, the player still playing and the same link. The maker's own ask is 404 and does not appear under Asking. Another person's Remove on a playtester's Your turn row is 404 and the row stays. Both pass on tablet and computer.

**R4 (phone red in CI): fixed.** `:128` now has main's #466 fix; `:169` keeps this PR's `about:blank` step so it waits for its own page's answer. Both pass here. CI run 46146009121 (quick, draft) at 84fe4a0 passed `verify`, `postgres`, all six browser shards (phone included) and the gate on its first try; pull request runs never retry. The flake is recorded under "Flaky tests" in `progress.md`.

The fix commit `457f6bb` also narrows `feedStateFor` to live games with asking on, or that the viewer plays. I checked it against `lookOf`: a game with asking off gives no badge to anyone and Play only to someone `in`, so the narrower read gives the same answer for every row.

## The owner's design and privacy

- **By request or invite only:** only a maker's yes, an invite or the link makes `in`; `ask` makes `asked` and is refused with the switch off, for the maker and for an 18+ game the person may not see.
- **Feed badge only:** `Feed.svelte` adds only the badge and, for a playtester, Play with the free line. Ask, You asked and Take back are only in `PlaytestAsk` on the game page.
- **Maker dashboard:** Playtesters on Live has the switch, Invite (faces and link), Let play, say no, and Stop with a Keep or Stop card.
- **Non-members free until launch:** `playBasis` returns `playtest` before `member`; every service call does nothing from launch on; the journey's last step sees nothing playtest from launch.
- **Your turn stays a list:** playtest rows join the list with their own line and Remove; no Stop (main's #463).
- **Never toward the pool:** the money roll-up counts only `member` plays, and `play-rollup.pg.test.ts` has a `playtest` play that never counts.
- **A no never leaks:** `lookOf` shows a declined ask as asked until taken back, then as no row; no Your turn row for a no or a removal. The badge, the invite link and Your turn give the same picture as an ask still waiting.
- **Age never leaks:** an invite is made for any friend whatever their age, and the maker's page shows them under Playing like anyone else; an 18+ game is hidden on the player's side (Your turn rows, the link, Ask, Play).
- **Nothing the owner did not ask for:** the only additions beyond the screens are the old-link table (asked for by audit 1, to keep the spec's "lands on the game's page"), the privacy lines and the parity file entries for the five maker actions.

## CRUD

Ask (create), read on the page and the maker's list, Take back (delete) and ask again; Let play and say no (update); the switch on and off; invite and the link (create), new link (update), the old link; Stop (delete); Your turn's Remove (delete) and the reload that reads it back. All in `playtest.test.ts`, all passing.

## Input devices

Gamepad: `gamepad.test.ts:515` reaches everything on Playtesters, the invite sheet and both game pages. Keyboard and pad A press a playtester's Play on the feed (`playtest.test.ts`). Mouse: every journey clicks. Touch: audit 1's tap probe; since `e9f2220` no playtest screen changed (`git diff e9f2220 84fe4a0` on the playtest components and the make and game routes shows only main's Join button from #453 on the game page). Trackpad: the PR adds no swipe of its own, and the badge is not a control. Nothing stuck: the pad case reaches every control on the four screens, the sheet included, and the journeys close the sheet and the Stop card with their own buttons.

## Notes (not blocking)

- **N1.** The overlap check (`expectNothingOverlaps`) counts buttons, links and positioned painted boxes. The badge is a plain paragraph in the band's flow, so it is never itself one of the boxes it compares; the check proves the band's buttons do not overlap with the badge in place. The fit check covers the badge against the bar, and my probe covers it against every control. The PR body's "the overlap check now measures the feed's Playtest badge" says a little more than the check does. If the badge ever becomes positioned, the overlay rule picks it up by itself.
- **N2.** `feedStateFor` sends every badged game's address to every viewer, including 18+ games a teen's feed never shows. It says nothing about the viewer and nothing reaches a maker, so it is not an age leak, but the list could be filtered by `mayShow` with the feed's own rule.
- **N3.** Carried from audit 1: #451's WCAG contrast journey should list `/make/<game>/playtesters` and `?invite` once both are on main.

## Main since 84fe4a0

Main is at `0ceeb12` (#464). `git merge-tree` of the head with it is clean; it changes only `progress.md` and `tests/browser/join-and-help-look.test.ts`, neither of which this audit relied on. A clean merge of it keeps this PASS.

## What I did not check

The phone profile (WebKit) locally; CI's quick run is the evidence for it. The full CI run, which starts when the PR is marked ready and gates the merge. The screens page and design rounds, which are the slice end's.
