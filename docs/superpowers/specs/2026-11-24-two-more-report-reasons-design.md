# Two more report reasons

The owner, 2026-11-24 14:22 UTC, on the reasons card ("Add two more report reasons: violence and scams?"): "Add both", and in the timeline at 14:22 UTC: "Graphic violence but yes". The Report sheet (report-a-game spec, `2026-11-24-report-a-game-design.md`) gains two reasons, "Graphic violence" and "A scam or steals your info". Nothing else about reporting changes.

## Lane

Lane 3: the reasons are a Postgres enum (`ReportReason`), so adding two is a migration (`prisma/migrations/`). It also touches `prisma/schema/` (lane 2). Plan audit on this brief, implementation audit on the build, both in one pull request. Merge permission: the owner's standing permission of 2026-11-21 19:16 UTC once the audits pass and CI is green. No new dependency, tool, service or spend.

**The migration only adds.** Two statements, `ALTER TYPE "ReportReason" ADD VALUE 'violence';` and `ALTER TYPE "ReportReason" ADD VALUE 'scam';`, nothing else. Postgres cannot drop an enum value, so the way back is forward only; the values stay in the type either way.

**Rolling the site back.** Old code (today's `main`) on the new schema is safe until someone sends one of the new reasons. After that, old code would read a row it has no words for: the review command would show an empty reason for it, and the sheet would open that person's report with nothing picked. Nothing breaks and nothing is lost. A rollback (`pnpm exec wrangler rollback`) is safe, and those few reports show their full words again once the site rolls forward. The database test checks that a row with a new reason reads back through the service and the review command.

Expected duration: about 1 hour of building, plus the audits.

## What a person sees

The sheet's list, in this order (the owner's rule about porn, gambling and ads comes first, harm next, then the rest):

1. Sexual content
2. Graphic violence (new)
3. Gambling
4. Ads
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
