# Implementation audit 1: Report a game

- Spec: `docs/superpowers/specs/2026-11-24-report-a-game-design.md` (plan PASS at `679fd28`).
- Pull request: #378, branch `claude/project-thread-yqmrq4`. Examined commit: `96c87e6` (merge of `main` at `e2a9d8f` into `c72ad8a`).
- Lane 3. Model: Opus 5.5, medium. Audited 2026-11-24 02:14 UTC.
- Prompt: Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

**Verdict: FAIL: 2 red, 6 notes.** The build is sound and close: the table, the service, the address, the review order, the sheet and the words all match the brief. One journey fails every time on the phone, and criterion 13 has no test.

## What ran, at `96c87e6`, in a cloud container

- `pnpm lint`, `pnpm typecheck`: pass. `pnpm test`: 151 files, 2203 tests pass.
- `pnpm test:pg tests/features/moderation tests/features/accounts/purge.pg.test.ts` on Postgres 16: 24 tests pass.
- `prisma migrate deploy` on an empty database, then `prisma migrate diff --from-config-datasource --to-schema prisma/schema --exit-code`: "No difference detected", exit 0.
- Playwright's image `mcr.microsoft.com/playwright:v1.63.0-noble`, all three devices, `--retries 0`: `report-a-game.test.ts`, `glass.test.ts`, `feed-controls.test.ts`: 104 passed, 1 failed (R1).
- CI quick run on `96c87e6`: lint, typecheck, build, postgres and verify green; browser shard 6 failed on `feed-controls.test.ts:849` [phone] "the feed never ends" (job 138159873940), the known flake recorded at `:832` in `progress.md` (one line moved by this change). It passed on the phone in the run above. The other shards were cancelled by the draft's stop-at-first-failure, so CI has not yet run this change's journeys.

## Red

**R1. The fit-the-window journey fails on the phone, every time.**
- UNIT: `tests/browser/report-a-game.test.ts`, "the sheet fits the window, and the page behind it never scrolls" (line 264).
- REQUIREMENT: criteria 10 and 19 (the sheet fits a 375 by 667 phone; browser suites pass).
- REASON: `page.mouse.wheel` is not supported in mobile WebKit, and `before` is read before the click that scrolls the page to reach Report.
- EVIDENCE: `[phone] ... Error: mouse.wheel: Mouse wheel is not supported in mobile WebKit` at line 280. With the wheel taken out (probe copied to the project's audits folder as `2026-11-24-report-a-game-1-probe.test.ts.txt`), the phone showed `window.scrollY` 380 against `before` 0: Playwright scrolled the game page to press Report, before the sheet opened. Tablet and computer pass.
- EXPECTED: the journey passes on all three devices and still proves the page behind does not move while the sheet is open.
- FIX: in `report-a-game.test.ts` only: read `before` after the sheet is open; replace the wheel with a check that works on a touch device (for example a touch swipe over the sheet, or set the sheet's `.inside` `scrollTop` and assert it moved while `window.scrollY` did not). Run it on the phone in Playwright's image.

**R2. Criterion 13 has no test.**
- UNIT: `tests/browser/report-a-game.test.ts` (or a database test of the route).
- REQUIREMENT: criterion 13: a report on a game that is not live answers 404; on an 18+ game for a person not known to be 18, 403.
- REASON: only an address that names no game is tried (`/g/no-such-game-here/report`, 404). No test uses a real game that is not live, and nothing tries the 403.
- EVIDENCE: `grep -rn "/report" tests` finds no 403 case and no not-live game; `adults-only.test.ts` does not touch `/report`. The code is right (`gameFor` in `src/routes/g/[game]/report/+server.ts` uses `liveGameBySlug` and `adultsOnlyRefusal`), but the criterion asks for a test.
- EXPECTED: a test that a waiting (not live) game answers 404 to GET and PUT, and an 18+ live game answers 403 to GET and PUT for a signed-in person not known to be 18, with nothing saved.
- FIX: add those cases to `report-a-game.test.ts` (`gameWhere(page, { state: "waiting" })` or similar for not live; `changeGame(slug, { ageRating: "age_18", contentMarks: ["none"] })` as `adults-only.test.ts` does for 18+). Test files only.

## Criteria

| # | Result | Evidence |
|---|---|---|
| 1 | pass | journey at `:74`, three devices |
| 2 | pass | same journey, read step |
| 3 | pass | same journey, one report now "Ads" |
| 4 | pass | same journey, game gone from the review list |
| 5 | pass | `:136` from the game's page |
| 6 | pass | `:182`; also the no-cookies visitor at `:191` |
| 7 | pass | `:204` (403 on PUT) and `reports.pg.test.ts` "refuses the maker's own game" |
| 8 | pass | `:215` |
| 9 | pass | `:136` Tab, rings, Escape, focus back to Report |
| 10 | **red R1** | passes on tablet and computer, fails on phone |
| 11 | pass | `tests/lib/glass.test.ts` in `pnpm test`; sheet reads `--glass-bg`, `--glass-filter`, `--glass-edge`, `--glass-ink`, `--dim-bg`, `--dim-filter` |
| 12 | pass | `reports.pg.test.ts`: two at once make one row; past the limit refused, nothing saved; take-back not counted. The 429 comes from the route (`+server.ts`), not tested end to end against the real limiter (the sheet journey holds the answer), as the criterion allows |
| 13 | **red R2** | no test |
| 14 | pass | `purge.pg.test.ts` "removes a person's reports after the 14 days" |
| 15 | pass | `:249` (400 ×3, 401 PUT and DELETE, nothing saved) and `reports.pg.test.ts` (enum and `GameReport_note_length` refuse in the table) |
| 16 | pass | `reports.pg.test.ts` whole-text check of id, phone, name, email; journey checks the phone number and a second person's GET is `{"state":"none"}`. The journey's note ("Slot machines on level 2.") holds no name (plan note N3 kept) |
| 17 | pass | `migration.test.ts`: strips comments, allows only the four adding kinds naming `GameReport`/`ReportReason` (plan note N2 kept); the migration has no ALTER or DROP on another table |
| 18 | pass | `:215`, 500 and 429 held by the test, reason and words kept |
| 19 | open | local suites pass; CI quick run red on a known flake (above) and R1 will fail the full run |

## Focus points

- **Additive migration, rollback.** `20261124013000_game_reports/migration.sql`: one `CREATE TYPE`, one `CREATE TABLE`, two indexes, two foreign keys (`ON DELETE RESTRICT`) and the note-length `CHECK`, all on `GameReport`. The back-relations on `User` and `Game` write no SQL (diff empty after deploy). Old code runs on it; `wrangler rollback` is a safe way back.
- **Server checks.** `readReport` refuses an unknown reason and a note over 500 code points (400); `char_length` in Postgres counts the same way. PUT and DELETE answer 401 signed out. `request.json()` failures read as `{}` and answer 400.
- **Privacy.** GET answers only `mine(caller.userId, …)`; `forReview` selects no user field; GET sends `cache-control: no-store` (plan note N1 kept). `/privacy` updated with its date; `/about` has the line.
- **Limits seam.** `limits.ts` alone holds 10 an hour and 30 a day, handed to `createReports` as `limits`; keys `api:report:<name>:<user>` on the shared `RateLimit` table; the own-game refusal and bad input are not counted; withdraw is not counted.
- **The sheet.** A `<dialog>` with `showModal`, no `alert`/`confirm`/`prompt`; glass tokens; `.quiet` for take-back; no underlines (`real-buttons` rules: `.button.main` link, buttons elsewhere); loading is a spinner with no words; the inner `.inside` scrolls with `overscroll-behavior: contain`. On tablet and computer it sits inside the window (probe: computer 448×688 in 1280×720, tablet 448×758 in 810×1080); on the phone it rises from the bottom, 375×635 in 375×667.
- **CRUD.** Create, read, update and delete are all in the one journey at `:74`, including take-back.
- **Review order.** `{"do":"reports"}` read by `readReviewOrder` (unit test), answered in `jobs/review/+server.ts` with `says` and `reported`, most reported first; the "what to do" words updated in both tests that hold them.
- **Main merge.** `96c87e6` = `c72ad8a` + `e2a9d8f`. Git's own merge conflicts only in `docs/superpowers/progress.md` (two new "Flaky tests" lines); the commit keeps both and differs from git's merge in nothing else. No live file at `96c87e6`.
- **Layers.** `moderation` is in `FEATURE_ORDER`; `feed` takes an `onreport` callback and never imports `moderation`; the routes own the sheet.

## Notes (recorded, not blocking)

- **N1. Phone WebKit in Playwright's Linux image draws no blur.** The sheet's computed `-webkit-backdrop-filter` (`blur(28px) …`) and the dim's `blur(6px)` are set, but the phone screenshots show the game page behind sharp, which makes the sheet hard to read there. The bar shows the same, so it is the emulator, not this change; Chromium draws the frosting properly. The owner's real-phone look is the evidence for Safari.
- **N2. Busy words.** The send shows "Sending…" and take-back "Taking it back…" beside the spinner. That follows today's `this-repo` rule for a scripted form; the queued owner item "show ONLY the spinner" (after-merges list, 2026-11-22 22:10) will change it with the rest.
- **N3. Opening the sheet shows a spinner** (brief), but no journey holds the GET back to see it, and `this-repo` asks a new kind of wait for a journey in `loading.test.ts`.
- **N4. A take-back racing a change** (`createMany` skips the duplicate, then the row is deleted before `update`) throws, answers 500, and the sheet says "That didn't work. Try again." Rare and harmless.
- **N5. A refused send still counts** toward the hour rule when the day rule refuses it (the limiter counts refused hits by design). Harmless at these numbers.
- **N6. Signed out on an 18+ game,** PUT and DELETE answer 403 (the game's own refusal comes first), not 401. Nothing is saved either way.
