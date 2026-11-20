# Decision day, unit D: implementation audit, cycle 1

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

- **Examined:** pull request #208, head `4a809e7` (branch `claude/project-thread-d01syc`), against `main` at `949ffb5`.
- **Against:** `docs/superpowers/specs/2026-11-20-decision-day-design.md` (sections 1.2, 1.3, 4, 7 "Unit D"), its plan audit `audits/2026-11-20-decision-day-1-plan-audit.md`, and the Owner's picks (Friday noon New York time; 10 seats a week; half again every 3 months; 500 a week at most).
- **Lane:** 3 (`prisma/schema/`, `prisma/migrations/`). Merging needs the Owner's OK, since the deploy runs the migration on the test site's database.
- **Result: nothing red. 5 notes**, none of them blocking D; N2 and N4 are for H.

## What ran

All on `4a809e7`, in a cloud container with Postgres 16 (Node 22 here, 24 in CI).

| Check | Result |
|---|---|
| `pnpm lint` | pass |
| `pnpm typecheck` | pass, 0 errors |
| `seats.test.ts` | 22 of 22 pass |
| `pnpm test:pg` | 40 files, 593 of 593 pass |
| The spec's empty-diff check as written: `prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema --script --exit-code`, with the shadow database given as `datasource.shadowDatabaseUrl` in a scratch Prisma config | `-- This is an empty migration.`, exit 0 |
| The same check after deleting `changedAt` from `games.prisma` (does it fail by itself?) | `ALTER TABLE "Game" DROP COLUMN "changedAt";`, exit 2 |
| The backfill test after changing the backfill to set nothing (does it fail by itself?) | 3 of 5 fail: live, taken off, sent back then accepted |
| `prisma migrate deploy` of every migration before D on an empty database, then a live accepted game and a waiting game, then `migrate deploy` of D | applied; the live game marked seen, the waiting game left null, `updatedAt` untouched |
| CI on `4a809e7` at 01:04 UTC | verify, postgres and commit-authors green; browser shards still running |

## Migration safety on the test site's data

Checked line by line against the earlier migrations:

- **Additive only.** Two nullable `TIMESTAMPTZ` columns on `Game` and one nullable `DATE` on `GameReview`, with no default: in Postgres 16 that is a catalogue change, no table rewrite. Two new tables, one enum, two unique indexes, one foreign key, one CHECK, two triggers. Nothing is dropped or renamed, and no existing constraint is changed.
- **`GameReview` is add-only** (`GameReview_append_only`, `20261114091000_review/migration.sql:67`). `ALTER TABLE ... ADD COLUMN` does not fire row triggers, and the backfill never writes `GameReview`, so the trigger cannot refuse the migration. The same trigger is what keeps `goesOutOn` fixed once written, and `schema.pg.test.ts` proves it.
- **`Game` has no triggers**, only CHECKs (`20261114030000_games/migration.sql:97-120`). The backfill's `UPDATE` sets only `acceptedSeenAt`, so every row that passes them today passes them after.
- **The new triggers** call `reject_append_only_change`, made in `20261113230000_membership/migration.sql:175`, so they exist on the test site already.
- **One transaction.** Prisma sends the file as one script, so a failure part way leaves nothing behind and the migration can be retried.
- **The running Worker during the deploy.** `deploy` runs `prisma migrate deploy` before `wrangler deploy`; the old Worker's Prisma client names its columns, so the new nullable columns and tables do not break it.
- **Undo** is a second migration, as the PR body says.

## The backfill

`UPDATE "Game" SET "acceptedSeenAt" = now() WHERE EXISTS (an accepted GameReview for that game)` matches section 4 exactly: every game with an `accepted` review, whatever its state. `now()` is the transaction's start, "the migration's time". The test (`decision-days-migration.pg.test.ts`) runs the earlier migrations, makes one game in each state, then runs D, the way a deploy meets real rows, and covers live, taken off, sent back then accepted, sent back only and waiting. It fails by itself (above).

A live game with no review at all (a game put live without the review command) is left null. That is harmless: section 5.2 shows the Accepted screen only when the newest decision that took effect is a gone-out `applied` yes, which such a game does not have.

## The empty-diff check

The spec asks for `--from-migrations ... --shadow-database-url`. Prisma 7.10 dropped the flag; the shadow database moved to `datasource.shadowDatabaseUrl` in `prisma.config.ts`, and `--from-migrations` still works with it. The builder ran `--from-config-datasource` against a database migrated from the migrations instead. That proves the same property, schema equals migrations, provided that database was built only by `migrate deploy` from empty, which the PR body says. To leave no doubt, this audit ran the spec's own form (table above): empty, and it fails when the schema drifts. Nothing to fix. See N1.

## Seat schedule

`seats.ts` checked against section 1.2:

- Rounding: `floor((2·start·3ⁿ + 2ⁿ) / (2·2ⁿ))` is `start × 1.5ⁿ` rounded half up once, in whole numbers. Probed from first day 2026-11-27, every 3 months: 10, 15, 23, 34, 51, 76, 114, 171, 256, 384, 500 (step 10, Friday 1 June 2029), then 500. Matches the spec's list.
- Clamping: `addMonths` gives 2026-11-30 + 3 = 2027-02-28, 2027-11-30 + 3 = 2028-02-29 (leap), 2026-01-31 + 1 = 2026-02-28.
- The moment: noon in `America/New_York` by the zone, not a fixed offset; tests cross both daylight saving changes and the 11:59 / 12:00 edge; strictly after, as section 1.1 says.
- Off while `firstDay` is null: `nextDecisionDay` gives null, `seatsOn` gives 0, and the shipped file is null.
- `DecisionDay_seats_check` (1 to 500) agrees: no day before the first goes out, and the schedule never passes 500.

## Spec coverage, unit D

| Spec item | Where | Status |
|---|---|---|
| `DecisionDay`: day unique, seats, wentOutAt, add-only | migration, `games.prisma`, `schema.pg.test.ts` | done (adds `id` and `createdAt`, as the other tables do) |
| `GameReview.goesOutOn` date, never changed | migration, existing trigger, test | done |
| `DecisionOutcome`: reviewId unique, applied or lapsed, add-only | migration, enum, test | done |
| `Game.changedAt`, `Game.acceptedSeenAt` | migration, test | done |
| Backfill of `acceptedSeenAt` | migration, `decision-days-migration.pg.test.ts` | done |
| `decision-days.json` with `firstDay: null`; `seats.ts` with the next day, a day's seats, `dayWords` | both files, `seats.test.ts` | done |
| Step 1 tests listed in the spec | the three test files | all present |
| Nothing a maker or staff sees changes | no file under `src/routes/` or in `service.ts` changed | done |
| PR says merging applies the migration and undo is a second migration | PR body | done |
| Live-state file deleted before the audit | `4a809e7` | done |
| Commits by McThayDT, no AI credit | `git log` | done |

## Findings

### N1: the spec's diff command for Prisma 7

UNIT: `docs/superpowers/specs/2026-11-20-decision-day-design.md` section 7, unit D step 2. VERDICT: note. REQUIREMENT: the spec's check. REASON: the command names a flag Prisma 7.10 no longer has, and the PR body says the check cannot be run as the spec meant. EVIDENCE: `prisma migrate diff --help` lists no `--shadow-database-url`; with `shadowDatabaseUrl` in a Prisma config, `--from-migrations` runs and gives an empty diff on `4a809e7` (above). EXPECTED: the next migration units (H has none; K, P, and the server spec's) use the form that works. FIX: none in D. The coordinator carries the Prisma 7 form into later migration specs: `datasource: { url, shadowDatabaseUrl }` in a scratch config, then `prisma migrate diff --config <it> --from-migrations prisma/migrations --to-schema prisma/schema --script --exit-code`.

### N2: a first day that is not a Friday is taken silently

UNIT: `src/features/games/seats.ts`, for H. VERDICT: note. REQUIREMENT: section 1.2, "the first Friday after H's last commit". REASON: nothing checks that `firstDay` falls on the schedule's weekday, and H writes it by hand in its last commit. EVIDENCE: with `firstDay: "2026-11-26"` (a Thursday), `nextDecisionDay(2026-11-01)` names 2026-11-26 with 10 seats. EXPECTED: a wrong date fails a test before it merges. FIX: in H, replace `seats.test.ts`'s "is off until the first decision day is written" (it will fail once the date is written) with "the first day, once written, is a Friday", and name that changed test in H's pull request. Files: `tests/features/games/seats.test.ts`.

### N3: 500 lives in two places

UNIT: `migration.sql` (`DecisionDay_seats_check`) and `decision-days.json` (`maxSeats`). VERDICT: note. REQUIREMENT: section 1.2, the schedule lives in code. REASON: raising `maxSeats` alone would make the release's insert fail at the check. EVIDENCE: `CHECK ("seats" BETWEEN 1 AND 500)` and `"maxSeats": 500`. EXPECTED: none now; 500 is the Owner's settled number. FIX: none. If the Owner ever changes the top, that change includes a migration.

### N4: Prisma reads a `@db.Date` as midnight UTC

UNIT: `goesOutOn` and `DecisionDay.day`, for H. VERDICT: note. REQUIREMENT: section 1.1, a day in its own zone. REASON: `seats.ts` speaks in `"YYYY-MM-DD"` strings and Prisma gives and takes a `Date`. A conversion through local time, or through the New York zone, would shift the day by one. EVIDENCE: `games.prisma` `goesOutOn DateTime? @db.Date`, `day DateTime @unique @db.Date`. EXPECTED: H converts only as `new Date(day + "T00:00:00Z")` and `date.toISOString().slice(0, 10)`. FIX: in H, one test that a held decision's `goesOutOn`, read back, equals the `day` that `nextDecisionDay` named. Files: H's `service.pg.test.ts`.

### N5: no index on `GameReview.goesOutOn`

UNIT: migration. VERDICT: note. REQUIREMENT: none broken. REASON: H counts a day's seats and the release finds a day's held decisions by `goesOutOn`. EVIDENCE: only `GameReview_gameId_idx` exists. EXPECTED: at up to 500 held decisions a week the table stays small enough to scan for a long time. FIX: none now; add one only if a measured query is slow, in a later migration.

## Hand-back

D can merge once its browser shards are green and the Owner says yes to running the migration on the test site. The implementer has nothing to fix from this audit.
