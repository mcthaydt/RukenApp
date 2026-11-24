# Two more report reasons

The owner, 2026-11-24 14:22 UTC, on the reasons card ("Add two more report reasons: violence and scams?"): "Add both", and in the timeline at 14:22 UTC: "Graphic violence but yes". The Report sheet (report-a-game spec, `2026-11-24-report-a-game-design.md`) gains two reasons, "Graphic violence" and "A scam or steals your info". Nothing else about reporting changes.

## Lane

Lane 3: the reasons are a Postgres enum (`ReportReason`), so adding two is a migration (`prisma/migrations/`). It also touches `prisma/schema/` (lane 2). Plan audit on this brief, implementation audit on the build, both in one pull request. Merge permission: the owner's standing permission of 2026-11-21 19:16 UTC once the audits pass and CI is green. No new dependency, tool, service or spend.

**The migration only adds.** Two statements, `ALTER TYPE "ReportReason" ADD VALUE 'violence';` and `ALTER TYPE "ReportReason" ADD VALUE 'scam';`, nothing else. Postgres cannot drop an enum value, so the values stay in the type either way.

**Forward only.** This change cannot be safely rolled back once anyone has sent one of the new reasons. Today's code (the `main` before this change) reads a report's reason through the generated client, which knows only the seven old values. A `violence` or `scam` row makes it throw in `reports.mine` (the sheet would fail to open for that person on that game) and in `forReview` (the review command would fail for everyone). So the way out of a bad deploy is a fix forward, not `pnpm exec wrangler rollback`. A rollback is safe only in the window before the first new-reason report. After that it would first need the new-reason rows changed to `other`, a write of real data that waits for the owner. The change is small (two enum values, two words) and is checked on three devices before it merges, so fixing forward is the plan.

Expected duration: about 1 hour of building, plus the audits.

## What a person sees

The sheet's list, in this order. The owner's three rules (no porn, gambling or ads) stay first, as `reasons.test.ts` holds; the owner did not choose an order for the rest:

1. Sexual content
2. Gambling
3. Ads
4. Graphic violence (new)
5. Hate or bullying
6. A scam or steals your info (new)
7. Copied from someone else
8. It doesn't work
9. Something else

The sheet already scrolls inside itself when its list is taller than the window, so two more rows need no new layout.

## Rules

- The stored values are `violence` and `scam`. The words people see are only in `src/features/moderation/reasons.ts`.
- The site still believes nothing the sheet sends: an unknown reason still answers 400, and the table still refuses one.
- The review command (`{"do":"reports"}`) shows the new reasons in words, as it does the others.

## Acceptance criteria

1. The sheet shows the nine reasons above, in that order, with those words. (unit test on `REPORT_REASONS` and `REASON_WORDS`; journey)
2. A player picks "Graphic violence" on a game's page and sends; the review command lists that game with "Graphic violence". Changing it to "A scam or steals your info" and saving shows that instead. (journey)
3. The database accepts `violence` and `scam` and still refuses an unknown reason. (database test)
4. The new migration holds only `ALTER TYPE "ReportReason" ADD VALUE` statements, for these two values. (unit test)
5. `prisma migrate diff` from the migrations to the schema is empty. (the CI migrations check)
6. Lint, typecheck, unit, database and browser suites pass in CI, and the report journeys pass on phone, tablet and computer.

## Plan

| # | Unit | Files it owns | Check |
|---|---|---|---|
| 1 | Enum and migration | `prisma/schema/moderation.prisma`, `prisma/migrations/<stamp>_more_report_reasons/migration.sql` | criteria 4, 5; `migration.test.ts` extended |
| 2 | Words and order | `src/features/moderation/reasons.ts` | criterion 1; `reasons.test.ts` |
| 3 | Tests | `tests/features/moderation/reports.pg.test.ts`, `tests/browser/report-a-game.test.ts` | criteria 2, 3 |
| 4 | Notes | `docs/superpowers/progress.md` | none |

Units run in order on one branch. The live-state file is deleted in the last commit before each hand-off to an audit.
