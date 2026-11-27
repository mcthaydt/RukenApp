# Plan audit 1: games sent to you

- Examined: `1c68797` (branch `claude/project-thread-vtpb30`, draft pull request #407), brief `docs/superpowers/specs/2026-11-27-games-sent-to-you-design.md`. The branch differs from `main` (`16f8996`) only in the brief, one `progress.md` row and the live-state file.
- Read against: CLAUDE.md, the `review` and `build` skills, `this-repo`, the owner's rules in `progress.md`, `main` at `16f8996`, Follow (#400) at `bdba4e5` (`origin/claude/project-thread-6790hn`), and the top bar (#402) at its passed head `a4dd09a` (`origin/claude/project-thread-iuhd8j`).
- Reviewer: Opus 5.5, medium. Written 2026-11-27 02:14 UTC; retargeted from `9a341e6` to `1c68797` at 02:14 UTC (the only change: the owner named it "Your turn" and the addresses became `/your-turn`; every finding below still holds there).

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## Verdict

**FAIL: 5 red, 7 notes.**

What holds: the owner's D2 (friends are two people who follow each other; only friends send) is written as one rule, `canSend`, and the sheet's faces use the same rule (criterion 11). `MakerFollow` on #400 is user to user (`followerId`, `makerId` both `User`), so `canSend(fromUserId, toUserId)` can read it as written. CRUD is covered by plan steps: a send is created (1), read (2), updated (`seenAt`, 2) and deleted (3); a stop is created, read and deleted (4). The migration only adds, with a test that fails on anything else (15). Restrict keys plus rows deleted in `deletion.ts` match `MakerFollow` and the purge (10). Games are never hard-deleted (`takeGamesOff` sets `taken_off`), so `gameId` Restrict cannot block a purge, and a taken-off game leaving every list (9) covers a deleted maker's games. No new cookie; `/your-turn` needs a sign-in, which sits behind the cookie yes. Glass, the spinner, 48px buttons, fit with no page scroll and no underline are criteria (13, 14). The bar of places shows on `/your-turn` with no change (`+layout.svelte` `NO_BAR`). The 2-second spinner delay is for page loads only (`this-repo`, "for pages only"), so the face's spinner is right as written.

## Red

### R1. The live-state file is still on the branch at hand-off

- UNIT: `docs/superpowers/live/claude-project-thread-vtpb30.md`.
- VERDICT: red.
- REQUIREMENT: CLAUDE.md, "Live state in a file": the session deletes the file in its last commit before it hands the branch to the audit, so the commit the audit names is the one that merges.
- REASON: the file is present at `1c68797`.
- EVIDENCE: `git show 1c68797:docs/superpowers/live/claude-project-thread-vtpb30.md` prints it.
- EXPECTED: no live-state file at the commit handed to the plan audit.
- FIX: delete the file in the commit that fixes these findings. Files: that one file.

### R2. The exact spam numbers are written in the public repo

- UNIT: the brief's Rules, "A limit on sending", and `src/features/sends/limits.ts` in unit 2.
- VERDICT: red.
- REQUIREMENT: the owner, 2026-11-22 20:25 UTC (`progress.md` line 80): "Yeah let's move all of those private": "the exact rate-limit and spam numbers ('the mechanism can stay public')". RukenApp is public.
- REASON: the brief prints the numbers ("30 an hour, 100 a day for each sender") and puts them in a public file "so they can move to the private Worker ... later". That is new work written against the owner's rule, not old work waiting to move.
- EVIDENCE: brief, Rules, "A limit on sending". The deploy already has a private seam: `src/private-env.d.ts` declares `env.PRIVATE` (the private Worker `ruken-private`, deploy only, optional), read by `cloudflarePrivateFeed` in `src/lib/server/cloudflare.ts:38`, with the open order as the fallback when it is absent.
- EXPECTED: the public repo holds the mechanism and only stand-in numbers for dev and the journeys; the deploy's numbers come from RukenPrivate and appear nowhere public, the brief included.
- FIX: in the brief, take the numbers out; say `limits.ts` holds stand-ins used when `env.PRIVATE` has no send limits, and the deploy reads them from the private Worker the way the feed's order is read (`env.PRIVATE`), with a test that the stand-ins are used when it is absent. Name the RukenPrivate change (a limits answer on `ruken-private`, which the owner merges) as a dependency of unit 2's deploy, not of its build. Files: the brief, and `progress.md`'s row if its wording changes.

### R3. The top-bar button sits where the sound speaker is

- UNIT: "Where they land" and unit 5 (`src/features/feed/FeedTop.svelte`).
- VERDICT: red.
- REQUIREMENT: the owner's top bar (#402, "search icon on the right; For You | Following in the middle"), with the speaker kept in the top left; criterion 13 (48px targets, nothing overlaps on a 375 by 667 phone).
- REASON: the brief puts the "Your turn" button "on the left of the feed's top bar (opposite Search)". The top left is the speaker's: each clip's `.sound` button is `position: absolute; top: 0.75rem; left: 0.75rem` (`src/features/feed/Feed.svelte:593-596`), and #402's own header says "The speaker for sound stays in the top left corner (Feed.svelte), so the bar keeps clear of it" (`FeedTop.svelte` lines 4-5 at `a4dd09a`). The two 48px buttons would stack on each other.
- EXPECTED: a place for the button that clears the speaker, the tabs and Search at 375px wide and on a sideways phone (the bar's column on the right edge).
- FIX: in the brief, move the button beside Search on the right (Search outermost), and say how it sits in the sideways column; add to criterion 13 that the speaker, the tabs, Search and the new button do not overlap at 375 by 667, tablet, computer and sideways. If the owner prefers another spot, that is a words-and-place change only. Files: the brief.

### R4. The faces and names have no source and no fallback

- UNIT: "Sending" (faces "with the first name under it") and "The list" ("From <sender's name>"), units 2 and 4.
- VERDICT: red.
- REQUIREMENT: `build`'s quality bar (criteria a program or person can observe); the drunk-grandma test (every face must read as a person).
- REASON: Ruken keeps no first name. A person has `User.name` and, as a maker, `MakerPage.name` (a page name such as a studio's), and a photo only once they add one (`MakerPage.photoKey String?`, `prisma/schema/pages.prisma:25`). The brief does not say which name shows, how a long name is cut under a 48px face, or what a face is when there is no photo. A builder must guess, and criterion 1's "presses the friend's face" cannot be checked for a friend with no photo.
- EXPECTED: one stated source for the face and the name, used the same in the sheet and on `/your-turn`, and a stated face for a person with no photo.
- FIX: in the brief, say the face is the page's photo (`photoKey`, through the existing still or photo route) and, with no photo, the first letter of the page's name on the page's theme colour; the name is the page's `name`, on one line, cut with an ellipsis under the face; "From <name>" uses the same name. Add a journey step with a friend who has no photo. Files: the brief.

### R5. The new addresses are missing from the cookie-yes list in the plan

- UNIT: plan unit 3, "Files it owns".
- VERDICT: red.
- REQUIREMENT: strict cookie consent; `src/features/consent/routes.ts` ("a test fails for a route in none of them, so a new route must be named here before CI passes"); the plan's check "the diff touches only files in the plan".
- REASON: unit 3 adds `/your-turn`, `/your-turn/send`, `/your-turn/stopped` and its actions, but no unit owns `src/features/consent/routes.ts`, where they must be named `GATED` (they keep things and need a sign-in). Either CI fails or the builder edits a file outside the plan.
- EVIDENCE: `routes.ts` `GATED` holds `/me`, `/make`, `/g/[game]/wishlist`, but nothing for `/your-turn`; `tests/features/consent/routes.test.ts` fails on an unnamed route.
- EXPECTED: unit 3 names `routes.ts` (one line, `"/your-turn"`, which covers everything under it) and its test.
- FIX: add `src/features/consent/routes.ts` to unit 3's files and say `/your-turn` is gated. Files: the brief.

## Notes (not blocking)

- N1. **Stop deletes or hides?** "Stop removes their games from the list" and "only games sent after the undo show" agree only if Stop deletes that sender's `GameSend` rows to this person. Say so, and that criterion 4 checks the rows are gone.
- N2. **A friendship that ends.** If one unfollows, does a game they already sent stay on the list? Say yes (it was sent while they were friends), or say it goes.
- N3. **A row that is a link holding buttons.** "The whole row opens the game's page" with Remove and the Stop link inside it would nest press targets inside a link. Say the row's link and its two buttons are siblings.
- N4. **The Stop link's target.** It is "smaller", but it is still pressed; say it is at least 48px tall to press, like every target.
- N5. **The Following tab.** #402 adds `/following`; today it shows no clips (`Following.svelte`). When it shows clips with Share, its load must carry the faces too. Not this brief's work until then.
- N6. **The game page's "asks the database once" tests.** Adding the faces to `src/routes/g/[game]/+page.server.ts` adds a question to its `Promise.all`; keep it to one statement so those tests hold, and name any changed test in the pull request body.
- N7. **Follow-up outside this change:** the report limits (`src/features/moderation/limits.ts`, 10 an hour, 30 a day) are exact spam numbers in the public repo from before R2's reading; reported, not fixed here.
