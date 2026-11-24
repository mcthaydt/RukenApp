# Plan audit 1: Report a game

- Spec: `docs/superpowers/specs/2026-11-24-report-a-game-design.md`
- Pull request: #378, branch `claude/project-thread-yqmrq4`. Examined commit: `9875829`.
- Also read, on `origin/main` (`715b88a`): the design (`2026-11-13-ruken-reels-linktree-design.md` 5.1, 5.3, 5.5, 7.1 and the admin section), `prisma/schema/*.prisma` (`Wishlist`, `RateLimit`, the `onDelete` rules), `src/lib/server/rate-limit.ts`, `src/features/accounts/deletion.ts`, `src/features/games/review-order.ts`, `src/routes/jobs/review/+server.ts`, `src/routes/g/[game]/wishlist/+server.ts`, `src/routes/g/[game]/+page.svelte`, `src/features/feed/Feed.svelte`, the button kinds in `src/lib/look.css`, `tests/architecture.test.ts`, `tests/lib/glass.test.ts`, and the owner's rules in project memory.
- Lane 3. Model: Opus 5.5, medium.

**Verdict: FAIL: 4 red, 9 notes.** The design is sound and the right size for launch: one additive table, the wishlist's own shape (one row per person and game, `Restrict` keys, deleted at purge), the game page's own gate, the shared rate limiter, the existing review command, and the sheet owned by the route so `feed` never imports `moderation` (which already sits above `feed` and `make` in `FEATURE_ORDER`). CRUD is complete in the journeys (criteria 1 to 4). The reds are bounded spec edits: the server's own checks on what a send may hold, a check that the review answer names no reporter, the migration's safety stated and checked, and the live file.

## Red

**R1. The server's checks on a send have no criterion.**
UNIT: spec, "Rules" and "Acceptance criteria"; plan units 2 and 3.
VERDICT: red.
REQUIREMENT: CLAUDE.md "A check is a test that fails by itself"; `build`'s quality bar (input from outside is never believed, as `review-order.ts` says of its own body).
REASON: the 500-character limit and the reason list are only described as what the sheet shows; nothing says the address refuses an unknown reason, a note over 500 characters, or a send from someone signed out, and no criterion checks it.
EVIDENCE: spec "The sheet": "500 characters at most" (UI only); criteria 1 to 15 test no malformed body and no signed-out PUT or DELETE.
EXPECTED: `PUT /g/<game>/report` with a reason outside `reasons.ts`, or a note over 500 characters, answers 400 and saves nothing; PUT or DELETE signed out answers 401 and saves nothing; the reason is stored so the database itself refuses anything else (a Postgres enum or a `CHECK`, as `SignInGuard` does), and the note's length is checked in SQL too.
FIX: add one rule and one database-test criterion saying the above; the table unit (1) names the enum or `CHECK`. Spec only.

**R2. "It names no reporter" has no check.**
UNIT: spec, "Rules" (the review order) and criterion 1.
VERDICT: red.
REQUIREMENT: the brief's own rule, and the coordinator's ask that no reporter's identity reaches anyone but the owner.
REASON: the rule is stated but nothing fails if the answer later grows a user id, handle, phone or name, or if the address answers anyone but the caller's own report.
EVIDENCE: criterion 1 checks the game, count, reason and note are listed; no criterion checks what is absent.
EXPECTED: a test reads the `{"do":"reports"}` answer and finds none of the reporter's id, handle, phone number or name in it (as a whole-text search, so a new field cannot slip past); and a second signed-in person's `GET /g/<game>/report` on the same game answers "no report", never the first person's.
FIX: add both to criterion 1 (or a new criterion) as database or journey tests. Spec only.

**R3. The migration's safety and its way back are not stated or checked.**
UNIT: spec, "Lane" and plan unit 1.
VERDICT: red.
REQUIREMENT: lane 3 (`prisma/migrations/`); `deploy.yml` runs migrations before the site, and the stated way back is `pnpm exec wrangler rollback` (deploy-from-green-main spec), which is only safe when old code runs on the new schema.
REASON: the brief does not say the migration only adds (a new table, its indexes and its keys to `User` and `Game`) and changes no existing table, which is what makes a site rollback safe and the change easy to undo (a later forward migration drops the table). Nothing checks it.
EVIDENCE: plan unit 1's check is "`prisma migrate diff` empty after deploy; schema test", which proves no drift, not that the SQL is additive.
EXPECTED: the brief says: additive only; the back-relations on `User` and `Game` are Prisma-only and write no SQL to those tables; the keys are `onDelete: Restrict` like `Wishlist` (games are never deleted; a purged person's reports are deleted first in `deletion.ts`); rolling back the site is `wrangler rollback` with the table left in place; removing it is a forward migration. Unit 1's check adds: the migration's SQL holds only `CREATE TABLE`, `CREATE [UNIQUE] INDEX`, `CREATE TYPE` (if an enum) and `ALTER TABLE "Report…" ADD CONSTRAINT`, with no `ALTER` or `DROP` of any other table.
FIX: add the paragraph to "Lane" and the check to unit 1 (a unit test reading the migration file is enough). Spec only.

**R4. The live-state file is on the branch handed to the audit.**
UNIT: `docs/superpowers/live/claude-project-thread-yqmrq4.md`.
VERDICT: red.
REQUIREMENT: CLAUDE.md "Live state in a file": the session deletes it in its last commit before it hands the branch to the audit, so the commit the audit names is the one that merges. Same finding as R4 of the deploy-from-green-main plan audit 1.
EVIDENCE: `git diff --stat origin/main...9875829` lists `docs/superpowers/live/claude-project-thread-yqmrq4.md` (7 lines).
EXPECTED: no file under `docs/superpowers/live/` in the commit handed to each audit.
FIX: delete it in the last commit before each hand-off; write it again while working, as the rule says.

## Notes (recorded, not blocking)

- **N1. The icon departs from design 5.1 without saying why.** The design's sketch puts "⋯ report" last in the rail and gives ⚑ to Save (queued in Unit G). A flag for Report is the clearer sign, so keep it, but say so in the brief and note that Save should then take a bookmark, not a flag. Also say "labelled" means `aria-label` only, as Share is: design 5.1, "the only button with words on it is Play".
- **N2. "Take back my report" as an outline button.** In `look.css`, `.outline` is "a second forward action"; taking something back is the `.quiet` kind ("Sign out, Not now"). Use `.quiet` unless the design review says otherwise.
- **N3. Built ahead of the plan audit.** The live file says units 1 to 7 are being built meanwhile. Fine to keep going, but R1 to R3 change units 1 to 3: read this audit before those units are called done.
- **N4. Spec and build on one pull request.** `staged-path` merges the spec on its own and builds from `main`. One pull request for both is workable here (both audits land on #378) but say so in the PR body so the implementation audit knows what it covers.
- **N5. `GET /g/<game>/report` answers `cache-control: no-store`**, as `/api/feed` does, since it is one person's own data.
- **N6. A report on a game that later goes off can no longer be read or taken back** (the address answers 404). It still goes at account deletion. Acceptable for launch; slice 5 (take-downs) should decide what happens to reports on a game that goes off.
- **N7. Nobody is told when a report arrives.** The owner must run the review command to see any. That is the brief as asked (the portal is slice 5), but give the owner the one-line CLI command to read reports in the pull request when it is ready (CLI first), reading the secret from the Keychain item as the other review commands do.
- **N8. Maker pages.** Design 5.3 and the admin section put Report on every maker page too. Out of this brief (the owner asked about games); slice 4 Pages should carry it.
- **N9. More criteria worth having, cheap:** the "That didn't work. Try again." and "too many" states keep what was picked (one journey with a routed failure); the rail with the new button still clears the name and Play on the 375 by 667 phone (the changed-screens shot covers it if the journey looks).

## What holds

- Scope for 30 November: about 4 hours, no new dependency or spend, nothing taken down automatically, so report-bombing can only reorder the owner's list. Dedupe per person and game plus per-person limits (10 an hour, 30 a day, inside the limiter's one-day cap) is enough while nothing acts on counts. Any later automatic action must revisit this.
- Privacy: reporters' notes reach only the owner through the jobs secret; makers see nothing; the purge deletes the person's reports; `/privacy` is updated with its date.
- Owner rules: custom frosted sheet built on the glass tokens with `glass.test.ts`, no browser dialogs, spinners only, the page behind never scrolls and the sheet scrolls within itself, no underlined words, keyboard and focus return, grandma-plain words. Reasons include sexual content, gambling and ads (owner rule, 2026-11-22 19:56 UTC).
- Layers: `moderation` is already in `FEATURE_ORDER` above `feed` and `make`; the route owns the sheet; the review route may import `moderation`.
- Limits seam: one `limits.ts`, passed in, as the owner asked (mechanism public, numbers private later).
