# Drop the old stops

The owner, 2026-11-28 04:09 UTC: "I never asked for that, drop it and let unfollow do the job". #463 (merged as `d4a43d4`, live 12:40 UTC) took the Stop button, the "Friends who can't send you games" page and every read of the stops out of Ruken; the `SendStop` table and its rows stayed, to be cleared with the owner's yes. The owner, 14:52 UTC: "Ok to merge okay to delete". This brief drops the table and every row in it.

## Lane

Lane 3: a migration (`prisma/migrations/`) that deletes rows git cannot restore, plus lane 2 paths (`prisma/schema/`). It takes a plan audit on this brief and an implementation audit on the build. Merge permission: the owner's yes above, which covers this exact action (dropping `SendStop` and its rows) and nothing else.

Expected duration: about 1 hour of building, plus the two audits.

## What changes

- A new migration, `<stamp>_drop_send_stops`, holds one statement: `DROP TABLE "SendStop";`. The table's index, unique index, foreign keys and `CHECK` go with it. No other table is touched.
- `prisma/schema/sends.prisma` loses the `SendStop` model, and `User` (`prisma/schema/accounts.prisma`) loses its `sendStops` and `stoppedBy` relations. The client every check makes from the schema (`pnpm generate`, not committed) then has no way to name the table.
- The account purge (`src/features/accounts/deletion.ts`) no longer deletes stops: there are none.
- Tests that made stops to show they do nothing, or that the purge removes them, lose those steps; a migration test checks the new SQL is that one drop and nothing else.

## The deploy window

The deploy runs `prisma migrate deploy`, then `wrangler deploy` (`package.json`, `deploy`). Between the two, for well under a minute, the site still runs the code before this change, whose purge deletes stops. A purge in that window fails its transaction on the missing table and deletes nothing; the next purge run, on the new code, does the work. No page, button or send reads the table since #463, so nothing a person sees changes. Rolling the code back after the drop leaves the purge failing in the same way until the code rolls forward again; the deploy's own rollback notes already say to look at the database first.

## Acceptance criteria

1. `prisma/migrations/<stamp>_drop_send_stops/migration.sql`, with comments taken out, is exactly `DROP TABLE "SendStop";` (unit test).
2. On a database migrated from nothing (`prisma migrate deploy`), there is no `SendStop` table (`to_regclass('"SendStop"')` is null), and `prisma migrate diff --from-config-datasource --to-schema prisma/schema` says "No difference detected". No test in the repo runs this diff, so the build runs it by hand and says so in the pull request; every postgres test file starts from such a database.
3. `grep -rn "SendStop\|sendStop\|stoppedBy" src prisma/schema tests` finds nothing but the new migration test and the older migration and its test.
4. The account purge still removes a leaving person's sends both ways and leaves everyone else's (`purge.pg.test.ts`).
5. Sending still needs a friend, and unfollowing still stops sends (`sends.pg.test.ts`).
6. Lint, typecheck, unit, postgres and browser journeys pass.

## Plan

| # | Unit | Waits on | Files | Output | Check |
|---|---|---|---|---|---|
| 1 | Migration and schema | none | `prisma/migrations/<stamp>_drop_send_stops/`, `prisma/schema/sends.prisma`, `prisma/schema/accounts.prisma` | the drop, and a client without the table | criteria 1 to 3 |
| 2 | Purge and tests | 1 (the client) | `src/features/accounts/deletion.ts`, `tests/features/accounts/purge.pg.test.ts`, `tests/features/sends/sends.pg.test.ts`, `tests/features/sends/drop-send-stops-migration.test.ts` | the purge and tests on the new client | criteria 4 to 6 |

Both units are one pull request on `claude/project-thread-9jsisq`.
