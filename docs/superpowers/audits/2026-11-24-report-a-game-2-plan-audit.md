# Plan audit 2: Report a game

- Spec: `docs/superpowers/specs/2026-11-24-report-a-game-design.md`
- Pull request: #378, branch `claude/project-thread-yqmrq4`. Examined commit: `679fd28`.
- Round 1: `9875829` FAIL, 4 red (`2026-11-24-report-a-game-1-plan-audit.md`, branch `claude/project-thread-rt257c`, `ef442d1`).
- Read: `git diff 9875829 679fd28`, the whole spec at `679fd28`, `git diff --stat origin/main...679fd28`, `git ls-tree 679fd28 docs/superpowers/live/`, `tests/architecture.test.ts` (`FEATURE_ORDER`).
- Lane 3. Model: Opus 5.5, medium.

**Verdict: PASS: 0 red, 3 notes.** All four reds are fixed in the spec, each with an observable criterion; nothing new blocks.

## Round 1 reds

**R1. Server checks on a send: fixed.** New rule "The site believes nothing the sheet sends": unknown reason or note over 500 characters answers 400, signed-out PUT or DELETE answers 401, nothing saved; the reason is the Postgres enum `ReportReason` and the note length is the `CHECK` `GameReport_note_length`. Criterion 15 checks all of it in journey and database tests; plan unit 1's check names it.

**R2. No reporter named, no cross-person read: fixed.** New rule "Nobody sees another person's report". Criterion 16: the `{"do":"reports"}` answer, read as one text, holds none of the reporter's id, phone, handle or name; a second signed-in person's `GET` on the same game answers "none".

**R3. Additive migration and the way back: fixed.** "Lane" now says the migration only adds (type, table, indexes, its own keys and checks), the `User`/`Game` back-relations write no SQL, keys are `onDelete: Restrict` with reports deleted first in `deletion.ts`, the way back is `pnpm exec wrangler rollback` with the table left, removal is a forward migration. Criterion 17 is a unit test on the migration SQL; unit 1's check names it.

**R4. Live file in the handed-off commit: fixed.** `679fd28` deletes `docs/superpowers/live/claude-project-thread-yqmrq4.md`; `git ls-tree 679fd28 docs/superpowers/live/` is empty and `git diff --stat origin/main...679fd28` lists only the spec. Plan footer now says the live file is deleted before each hand-off.

## Round 1 notes

N1 (icon and `aria-label` only), N2 (`.quiet` for "Take back my report"), N4 (spec and build on one PR, said in "Lane") and N9 (criterion 18, failure and too-many keep what was picked) are folded in. N6, N7 and N8 are recorded under "Left for later". N3 is moot now the brief passes. N5 stands (below).

## Notes (recorded, not blocking)

- **N1. `cache-control: no-store` on `GET /g/<game>/report`** (round 1 N5, not taken up). It is one person's own data; the implementation audit will look for it.
- **N2. Criterion 17's SQL test should skip comment lines and allow a `CHECK` inside `CREATE TABLE`.** Prisma writes `-- CreateEnum`-style comments, and a hand-added `CHECK` may sit inline or as `ALTER TABLE "GameReport" ADD CONSTRAINT`; either is additive. The test must still fail on any `ALTER` or `DROP` naming another table.
- **N3. Criterion 16's test note must not contain the reporter's own name or handle,** or the whole-text search fails on the reporter's own words rather than on a leak.

## What holds

Everything under "What holds" in round 1 still holds at `679fd28`: scope and no new dependency or spend; privacy (owner-only via the jobs secret, purge deletes reports, `/privacy` updated); owner rules (custom glass sheet, no browser dialogs, spinners, inner scroll only, no underlines, keyboard and focus, plain words, reasons cover sexual content, gambling and ads); layers (`moderation` in `FEATURE_ORDER`, the route owns the sheet); the limits seam. CRUD stays complete in criteria 1 to 4.
