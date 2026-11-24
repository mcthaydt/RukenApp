# Implementation audit 1: Two more report reasons

- Brief: `docs/superpowers/specs/2026-11-24-two-more-report-reasons-design.md` (plan PASS at `4977731`, plan audit 2).
- Pull request: #395, branch `claude/project-thread-yqmrq4`. Examined commit: `da4da1e` (two commits on `4977731`: the build `330f57b`, then the live file's removal).
- Lane 3. Model: Opus 5.5, medium. Audited 2026-11-24 16:29 UTC.
- Prompt: Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

**Verdict: PASS: 0 red, 1 note.** (and two plan-audit notes that stand) The build matches the brief: the owner's two labels, the order with the owner's three rules first, a migration of exactly two `ADD VALUE` statements, and a journey that sends, reads back, changes and takes back a report with the new reasons. Every check passes here and in CI.

## What changed since `4977731`

`git diff --stat 4977731 da4da1e`: 8 files, 96 added, 2 removed.

- `prisma/migrations/20261124160301_more_report_reasons/migration.sql`: a comment and `ALTER TYPE "ReportReason" ADD VALUE 'violence';` and `... 'scam';`, nothing else.
- `prisma/schema/moderation.prisma`: `violence` and `scam` added at the end of `enum ReportReason`, the order Postgres appends them in. Prisma does not compare enum order (plan audit 1, P2), and the order people see lives in `reasons.ts`.
- `src/features/moderation/reasons.ts`: `REPORT_REASONS` is sexual, gambling, ads, violence, hateful, scam, copied, broken, other; `REASON_WORDS` gives violence "Graphic violence" and scam "A scam or steals your info". These are the only places the words appear (`grep -rn "Graphic violence\|steals your info" src`).
- Tests: `reasons.test.ts` (the nine words in order), `migration.test.ts` (the new migration's statements are exactly the two), `reports.pg.test.ts` (save, read back and change with the new values, read in words through `forReview`), `report-a-game.test.ts` (a new journey). No existing test was changed.

## Against the brief

| Brief | Result | Evidence |
|---|---|---|
| Labels "Graphic violence", "A scam or steals your info" | pass | `reasons.ts`; unit test; the journey checks them by label |
| Order: the owner's three rules first, then Graphic violence, Hate or bullying, A scam…, Copied, It doesn't work, Something else | pass | `reasons.test.ts` "shows the nine reasons in order" and "puts the owner's three rules first" (unchanged); journey counts 9 radios |
| The server still refuses an unknown reason (Rules) | pass | `readReport` accepts only `REPORT_REASONS`; `report-a-game.test.ts` "the site believes nothing the sheet sends" (`"boring"` gets 400) and `reasons.test.ts` (`"boring"`) pass |
| 1. Nine reasons, in order, in words | pass | unit test; journey |
| 2. Send "Graphic violence", change to "A scam…", read in the review command | pass | new journey, three devices; it also re-opens the sheet and finds "Graphic violence" checked (plan audit's N2, now covered) |
| 3. The table accepts `violence` and `scam`, still refuses an unknown reason | pass | `reports.pg.test.ts`: the new test, and "refuses an unknown reason in the table too" (`'boring'`) |
| 4. The migration only adds the two values | pass | `migration.test.ts` "the more-reasons migration" |
| 5. `migrate diff` empty | pass | `tests/lib/server/migrations.pg.test.ts` passes; with the new migration taken away it fails ("match the schema"), so it really checks this migration |
| 6. Suites green, report journeys on three devices | pass | below |
| Forward only | holds | the migration only adds; the brief states the rollback limits; no code path changed beyond the list |

**CRUD.** The new journey creates a report with "Graphic violence", reads it back (the sheet shows it checked, the review command shows it in words), updates it to "A scam or steals your info" and reads that back, then takes it back with a DELETE to `/g/<game>/report` (200), so the review list is left as other journeys expect. The press on "Take back my report" is already covered in the main journey. The journey uses the file's own `other` game, made fresh in `beforeAll` per worker, and the tests in the file run one at a time, so its `count: 1` cannot see another journey's report.

## What ran, at `da4da1e`

- `pnpm lint`: pass (in Playwright's image).
- Typecheck (`svelte-check`): no errors in source. The only errors are in `.svelte-kit/` build output left in the folder by journey runs; CI's `verify` on a clean checkout is green.
- Unit: `reasons.test.ts` and `migration.test.ts`, 23 of 23.
- Database, Postgres 16: `tests/features/moderation/` and `tests/lib/server/migrations.pg.test.ts`, 13 of 13. Mutation: with the new migration folder moved away, "match the schema, so the generated client and the database agree" fails (undone; not committed).
- Journeys, Playwright's image `mcr.microsoft.com/playwright:v1.63.0-noble@sha256:eff16c30…a4a27`, `--retries 0`: `report-a-game.test.ts` on phone, tablet and computer, 30 of 30.
- CI on `da4da1e` (quick draft run): gate, verify, postgres, browser shards 1 to 6, pr-rules and commit-authors green.

## Notes (recorded, not blocking)

- **N4. The new pg test clears every report first.** "keeps the two later reasons…" starts with `db().gameReport.deleteMany({})` so `forReview()[0]` is its own game. It is safe because each test file gets its own fresh database (`startTestDatabase`), but a filter on the test's game would not depend on that.
- Plan audit notes N1 (the server's 400 is in Rules, not a criterion; the existing tests hold it, above) and N3 (the source of "A scam or steals your info" is not quoted in the brief) stand. N2 is resolved by the journey's read-back.
