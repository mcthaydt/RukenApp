# Drop the old stops: plan audit 1

- Examined: `docs/superpowers/specs/2026-11-28-drop-send-stops-design.md` at `5409dd815e68143cbd8eae131887a184535e1824` (draft #471, branch `claude/project-thread-9jsisq`).
- Reviewer: fresh session, Opus 5.5, medium. Lane 3 plan audit.
- Verdict: **5409dd8 FAIL: 1 red**

The brief was read as the work to judge. Its factual claims were checked against the repo (at `5409dd8`, `origin/main` `2a88be3`, the open pull request branches) and against RukenPrivate `main` (`394b6c1`), read only.

## What the brief had to cover

| Ask | Covered? | Evidence |
|---|---|---|
| Drops only `SendStop` | Yes | "What changes": one statement, `DROP TABLE "SendStop";`, "No other table is touched"; criterion 1 tests the SQL is exactly that. The drop takes the table's index, unique index, two foreign keys and `SendStop_not_self` with it, which matches what `prisma/migrations/20261127131242_game_sends/migration.sql` lines 14-58 made. |
| Says nothing else changes | Yes | "No page, button or send reads the table since #463, so nothing a person sees changes." Criteria 4 and 5 hold the purge and the friends-only, unfollow-stops-sends rules in place. |
| Owner's permission and its scope | Yes | Quotes 14:52 UTC "Ok to merge okay to delete" and limits it to dropping `SendStop` and its rows. |
| Account deletion | Yes | The purge's `tx.sendStop.deleteMany` (`src/features/accounts/deletion.ts:194`) goes; criterion 4 keeps sends removed both ways. The stops' foreign keys are `ON DELETE RESTRICT`, so they leave with the table and nothing new blocks a user delete. |
| Migration order on a live database | Yes | "The deploy window": `package.json:16` runs `prisma migrate deploy && wrangler deploy`, as the brief says. An old-code purge in the gap fails its transaction and the next run redoes it. Correct and complete. |
| Code rollback | Yes | Says a code rollback after the drop leaves the purge failing until rolled forward; matches `this-repo` ("nothing rolls back by itself, because a migration may already have run"). |
| Backups / getting the rows back | **No** | See R1. |
| Proof nothing still reads the table | Yes, narrow | Criterion 3's grep, plus regenerating the client (typecheck fails on any `sendStop` left). See N1. |

## Red

**R1.** UNIT: the brief, "The deploy window". VERDICT: red. REQUIREMENT: lane 3 "deleting anything git cannot restore" (Risk in CLAUDE.md) and this audit's ask that the brief cover backups. REASON: the brief never says what happens to the rows: that no copy is taken, that the drop cannot be undone by a code rollback or a later migration, and that the owner's yes accepts losing them. EVIDENCE: the only rollback text is about code ("Rolling the code back after the drop…"); the words backup, copy, restore or "cannot be undone" do not appear. EXPECTED: one or two sentences saying the rows are gone for good once the migration runs, no copy is kept (none is needed, since nothing reads them and the owner said "okay to delete"), and the only way back would be the database host's own restore, if it has one. FIX: add those sentences to "The deploy window" (or a short "Getting it back" section). Touches only `docs/superpowers/specs/2026-11-28-drop-send-stops-design.md`.

## Notes (not blocking)

- **N1. Criterion 3 searches `src prisma/schema tests` only.** Checked today: `git grep -i "sendstop\|stoppedBy"` over all of RukenApp outside `docs/` at `5409dd8` finds only those three trees plus the old migration, and RukenPrivate `main` (`394b6c1`) has no hit. So the narrow grep is enough now; widening it to the whole repo minus `docs/` (`git grep -n -i "sendstop\|stoppedBy" -- . ':!docs'`) would also catch `cloudflare/`, `scripts/` and config without costing anything.
- **N2. Open branches still carry the model.** Every open pull request branch (#454, #459, #460, #462, #465, #467, #470) still has `model SendStop`, the `User` relations and the purge's `tx.sendStop` call, as `main` does until #471 merges. #459 (`claude/project-thread-b0417u`) is older than #463 and still reads stops in `src/features/sends/service.ts` (4 lines). None of them edits those lines itself, so merging `main` after #471 removes them cleanly, and the one-at-a-time integration with `main` before each merge runs typecheck on the result. Nothing for this brief to do.
- **N3. Migration stamps.** #460 (`20261128082353_playtesting`) and #465 (`20261128093000_page_listed`) carry migrations stamped earlier than #471's will be. They touch other tables, and `prisma migrate deploy` applies whatever has not run yet, so merge order does not matter. Worth one line in the brief if the builder wants it.
- **N4. `progress.md`.** The plan's file list leaves out `docs/superpowers/progress.md`, which the feature pull request updates by the project's prompt rules.

## Not checked

- The claim that every postgres test file starts from a database built by `prisma migrate deploy` (criterion 2) was not opened; it is the implementation audit's to confirm.
- No command was run against a database; this is a plan audit.
