# Plan audit 1: Two more report reasons

- Brief: `docs/superpowers/specs/2026-11-24-two-more-report-reasons-design.md`, pull request #395, branch `claude/project-thread-yqmrq4`. Examined commit: `3b0a951` (two commits on `main`; docs only).
- Lane 3. Model: Opus 5.5, medium. Audited 2026-11-24 16:01 UTC.
- Prompt: Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

**Verdict: FAIL: 2 red, 3 notes.** The labels are the owner's, the migration only adds, and `ALTER TYPE ... ADD VALUE` applies cleanly through `prisma migrate deploy` with an empty `migrate diff` afterwards (probe below). But the brief's claim that rolling the site back is safe is wrong: today's code throws on a row with a reason it does not know, so the review command fails for every game, not just the one with the new reason. And the new order breaks the brief's own stated rule and an existing test the plan does not name.

## What ran

All against Postgres 16 in a cloud container, from `3b0a951` (today's `main` code), with throwaway changes undone after each probe (none committed):

- **P1, rolling back.** A database test on today's code: migrated database, then `ALTER TYPE "ReportReason" ADD VALUE 'violence'`, then one `GameReport` row with reason `violence`. `reports.mine(player, game)` threw `PrismaClientKnownRequestError ... Value 'violence' not found in enum 'ReportReason'` (`reports.ts:51`). `reports.forReview()` threw the same (`reports.ts:88`).
- **P2, the migration.** `prisma/migrations/<stamp>_more_report_reasons/migration.sql` holding exactly the brief's two statements, and the enum in `moderation.prisma` in the brief's order (`violence` second, `scam` sixth). `tests/lib/server/migrations.pg.test.ts` (which builds the database with `prisma migrate deploy` and checks `prisma migrate diff --from-config-datasource --to-schema prisma/schema --exit-code`): 3 of 3 pass. So `ADD VALUE` runs inside the migration tool's run on Postgres 16 (allowed in a transaction since Postgres 12; the migration never uses the new values in the same run). Prisma also does not compare enum order, so values appended at the end of the type match a schema that lists them mid-list.
- Read: `reasons.ts`, `reports.ts`, `moderation.prisma`, `tests/features/moderation/{reasons,migration}.test.ts`, `reports.pg.test.ts`, `tests/browser/report-a-game.test.ts`, the standing permissions in `progress.md`.

## Checked and holding

- **Labels.** "Graphic violence" and "A scam or steals your info", in the list and in the opening paragraph, as the coordinator relayed the owner's approval. The brief quotes "Graphic violence but yes" (N3).
- **Additive migration.** Two `ALTER TYPE "ReportReason" ADD VALUE` statements and nothing else; criterion 4 holds it with a unit test, the plan extends `migration.test.ts` (which today reads only the `game_reports` migration, by path).
- **Unknown reasons.** `readReport` accepts only `REPORT_REASONS`, so the server's 400 follows the list; `report-a-game.test.ts:270` sends `"boring"` and `reasons.test.ts` tries `"boring"`, neither of which becomes valid. The table refuses unknown values (criterion 3).
- **Merge permission.** The 2026-11-21 19:16 UTC standing permission in `progress.md` covers every pull request, lane 3 included, once its audits pass and CI is green.
- **Generated client.** `tests/support/generated/` is ignored and rebuilt by `pnpm generate`, so no generated file needs committing.

## Red

**R1. Rolling the site back is not safe the way the brief says.**
- UNIT: the brief's "Rolling the site back" paragraph.
- REQUIREMENT: CLAUDE.md, Report honestly; lane 3's requirement that the way back is known before a migration ships.
- REASON: the brief says old code on the new schema shows an empty reason in the review command and an unpicked sheet, and "nothing breaks". In fact the Prisma client of today's code throws on any row holding a value its schema does not list.
- EVIDENCE: P1. `mine` and `forReview` both throw `Value 'violence' not found in enum 'ReportReason'`. So after a rollback, once anyone has sent one of the new reasons: `GET /g/<game>/report` for that person answers 500 (the route does not catch it), and `{"do":"reports"}` fails for every reported game, since `forReview` reads all rows in one query. No data is lost; it all reads again once the site rolls forward.
- EXPECTED: the brief states what really happens on a rollback, and how the build makes it acceptable.
- FIX: rewrite that paragraph with P1's result. Then pick one of these (the brief author's choice; none is a product choice): (a) the way back is forward only: a rollback breaks the review command and those people's sheets until the site rolls forward, and that is accepted and written down; or (b) the build makes today's failure impossible to reach after this ships, for example by reading `reason` as text (`$queryRaw` with `reason::text`) or catching the error per row, and a database test proves an unknown value reads back as "Something else" or is left out, not thrown. Whichever is chosen, criterion 3's database test covers it. File: the brief only (plus the code and test files if (b)).

**R2. The new order breaks the brief's own rule and an existing test the plan does not name.**
- UNIT: "What a person sees" (the numbered list) and plan unit 2.
- REQUIREMENT: the brief's sentence "the owner's rule about porn, gambling and ads comes first, harm next"; `reasons.ts`' comment "The owner's rule (no pornography, gambling or ads) comes first"; CLAUDE.md and `review`: a change to an existing test is named with its reason.
- REASON: the list puts "Graphic violence" second, between "Sexual content" and "Gambling", so the owner's three rules no longer come first, which the brief's own sentence says they do.
- EVIDENCE: `tests/features/moderation/reasons.test.ts`, "puts the owner's three rules first": `expect(REPORT_REASONS.slice(0, 3)).toEqual(["sexual", "gambling", "ads"])`. With the brief's order it gets `["sexual", "violence", "gambling"]` and fails. The plan's unit 2 names `reasons.test.ts` only for criterion 1, not as a test being changed.
- EXPECTED: an order that matches the stated rule, or a stated rule that matches the order, with any changed test named.
- FIX: either order the list 1 Sexual content, 2 Gambling, 3 Ads, 4 Graphic violence, 5 Hate or bullying, 6 A scam or steals your info, 7 Copied from someone else, 8 It doesn't work, 9 Something else (which keeps the existing test and the comment), or keep the brief's order, rewrite the sentence and the `reasons.ts` comment to say so, and name the change to "puts the owner's three rules first" in the plan and the pull request. Unless the owner chose the order (the brief does not say so), the first is the smaller change. File: the brief only.

## Notes (recorded, not blocking)

- **N1. The server's 400 is a rule, not a criterion.** "An unknown reason still answers 400" is in Rules, and existing tests hold it (`report-a-game.test.ts:270`, `reasons.test.ts`), but no criterion here names it. Adding "and the site still answers 400 to an unknown reason" to criterion 3, with those tests as its check, makes it part of what the build is judged on.
- **N2. Criterion 2 does not read the new reason back.** It sends "Graphic violence" and changes to "A scam or steals your info", checked in the review command. Re-opening the sheet and seeing the new reason picked (the step that reads by value) would complete create, read and update for the new values; delete is already covered by the existing journey.
- **N3. Only one label is quoted.** The brief quotes "Add both" and "Graphic violence but yes", but not where the words "A scam or steals your info" come from. Quoting the card's option text, or the owner's message, would let a later reader check it.
