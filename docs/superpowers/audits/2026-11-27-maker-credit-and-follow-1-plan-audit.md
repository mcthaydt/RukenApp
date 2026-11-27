# Plan audit 1: maker credit and follow

- Pull request: #400, branch `claude/project-thread-6790hn`
- Reviewed commit: `c312091` (spec `docs/superpowers/specs/2026-11-27-maker-credit-and-follow-design.md`), on main `67ba234`
- Lane: 3 (adds a table and a migration). Reviewer: Opus 5.5, medium, a fresh session that did not write the brief.
- Verdict: **FAIL: 2 red**, 5 notes

Prompt: Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## What was checked, and held

- **The roadmap items.** Both lines the brief quotes are in the owner's queue (`/mnt/project-files/roadmap.md` lines 44 and 45). The brief covers both; Like/Save/Repost, the top bar and the Following feed are left to their own threads.
- **CRUD (owner rule: e2e covers follow and unfollow).** Create (criterion 1), read (2, and reload in 3), delete (3) are journeys. Update is explained: a follow has nothing to change. Holds.
- **The migration only adds.** `Wishlist`, `GameReport`, `MakerPage` all use `onDelete: Restrict` with rows removed in `src/features/accounts/deletion.ts` (lines 177 to 183); the purge keeps the `User` row as a tombstone, so Restrict on both keys is consistent and the deletion line has a place to go. Criterion 15 pins the SQL kinds. Rollback by `wrangler rollback` with the table left in place holds because no old code reads it.
- **The signed-out way back.** It mirrors `src/routes/g/[game]/wishlist/+server.ts` (a 30-minute HttpOnly Lax cookie set only on a real press, read by GET on the way back from `/sign-up?next=`). `safeNextPath` exists in `src/lib/safe-next.ts`.
- **Glass and look.** `--glass-pay`, `--glass-safe` and `--glass-edge` exist in `src/lib/look.css` (lines 122 to 149) with their fallbacks; `tests/lib/glass.test.ts` exists and checks surfaces and button tints. The badge is custom, icon-only with an `aria-label` (owner: icon-only where clear), and the name link has no underline today (`.makername`). No new dependency.
- **Where the credit is today.** `src/features/feed/Feed.svelte` line 461 draws it in `.band` at the bottom left; `.side` (line 490) holds Share alone. The brief's move matches the code.
- **Who is asking.** `feed.askingOf(caller)` already carries `userId` (`src/features/feed/services.ts` line 48), so `following` and `mine` can be set per person without a new input. `/api/feed` answers `no-store`, so one person's state is not cached for another.
- **The address.** `src/params/handle.ts` matches only handle shapes, and fixed routes win, so `/<handle>/follow` cannot shadow a Ruken screen; `/me/follow` falls to a handle with no page and answers 404.
- **Cookie page.** `tests/routes/privacy/cookies.test.ts` will fail until `rk_follow_pressed` is on `/privacy`, as the brief says.
- **Busy button.** `src/lib/busy-forms.ts` is the shared rule the brief names.

## Red findings

### 1. The way back from sign-up can follow your own page

- UNIT: unit 3, `src/routes/[handle=handle]/follow/+server.ts` (GET).
- VERDICT: red
- REQUIREMENT: the brief's own rules: "you can't follow yourself", "Following your own page answers 400 and saves nothing", and "The site believes nothing the form sends".
- REASON: the self-follow and no-page rules are written for the POST only; the GET way back has no stated guard, and the short sign-up links to sign-in.
- EVIDENCE: Rules, first bullet, names only `POST /<handle>/follow`; criterion 5 tests only "a POST to follow their own page"; criterion 6 tests only a GET without the cookie. A maker signed out on another device presses the plus on their own clip (no `mine` is known while signed out), goes on to sign in to their own account, and the GET finds the cookie naming their own handle. The Wishlist GET this copies (`src/routes/g/[game]/wishlist/+server.ts` lines 57 to 67) has no such case because a game cannot be yourself, so copying it brings no guard.
- EXPECTED: the GET follows only when the cookie names this handle, the handle has a page, and the page is not the caller's own; otherwise it saves nothing and goes on to `back`. A handle with no page answers 404, like the POST.
- FIX: add the GET to the Rules bullet and to criterion 5 ("a GET of the way back with the cookie naming your own page saves nothing"), as a database or route test. Files: the spec only.

### 2. The plan's file list leaves out files the build must change

- UNIT: the Plan table.
- VERDICT: red
- REQUIREMENT: CLAUDE.md, "A check is a test that fails by itself": "the diff touches only files in the plan".
- REASON: two files the build cannot avoid are not owned by any unit, so a correct build fails that check.
- EVIDENCE: (a) `FeedClip` and `FeedServiceDeps` are declared in `src/features/feed/service.ts` (lines 33 to 61), and the clip is built there (lines 173 to 197); the brief names only `services.ts`. (b) `src/features/consent/cookies.ts` keeps `RUKEN_COOKIES` (line 47, with `rk_wish_pressed` at line 58); taking back consent deletes only cookies on that list, and `tests/features/consent/cookies.test.ts` ("knows every cookie the code sets", line 62) fails on a new name missing from it. The brief names only `/privacy` for the new cookie.
- EXPECTED: unit 4 owns `src/features/feed/service.ts` too; unit 3 or 6 owns `src/features/consent/cookies.ts`, with the existing consent test as its check; unit 6 names `src/routes/privacy/+page.svelte` by path.
- FIX: add those paths to the Plan table and the cookie line to "Pages that keep up". Files: the spec only.

## Notes (not blocking, recorded)

1. **Live-state file at the hand-off.** `docs/superpowers/live/claude-project-thread-6790hn.md` is still in `c312091`, though CLAUDE.md and the brief's own last paragraph say it is deleted in the last commit before a hand-off to an audit. On a shared brief-and-build pull request the merging commit comes later, so no harm here; delete it before the implementation audit.
2. **Name the indexes.** "its indexes" is not specified. The unique key `(followerId, makerId)` serves the follower's lookups; the purge's "follows made of them" (`deleteMany where makerId`) wants `@@index([makerId])`, and `followedMakerIds` newest first may want `(followerId, followedAt)`. Naming them keeps the migration's contents reviewable against the brief.
3. **The roadmap citation.** The quoted lines are in the owner's queue `/mnt/project-files/roadmap.md`, not `docs/superpowers/roadmap.md`, whose slice 3 has no follow line. Point the citation at the right file.
4. **The right column is shared.** The Like/Save/Repost thread will add buttons to the same `.side` column and `FeedClip`. Criterion 9 (fits a 667 by 375 sideways phone) is checked against today's column only. Whichever merges second should merge main and run criterion 9 again with all the buttons; say so in the brief.
5. **The script answer.** The brief says the plain form works with no script, but not what the script path answers. The Wishlist route answers JSON when `Accept` asks for it (`{ wished }`, or `{ go }` for sign-up); saying the follow route answers the same way (`{ following }` / `{ go }`) saves the builder a guess.

## Follow-up outside this change

None found.
