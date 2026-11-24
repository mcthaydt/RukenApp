# Plan audit 2: Two more report reasons

- Brief: `docs/superpowers/specs/2026-11-24-two-more-report-reasons-design.md`, pull request #395, branch `claude/project-thread-yqmrq4`. Examined commit: `4977731` (two commits on `3b0a951`, which audit 1 examined; the brief is the only file whose words changed).
- Lane 3. Model: Opus 5.5, medium. Audited 2026-11-24 16:02 UTC.
- Prompt: Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

**Verdict: PASS: 0 red, 3 notes.** Both of audit 1's reds are fixed. Everything audit 1 found holding (the owner's labels, the additive migration, `ADD VALUE` through `prisma migrate deploy` with an empty `migrate diff`, the standing merge permission) is unchanged by this diff.

## What changed since `3b0a951`

`git diff 3b0a951 4977731`: the brief only. "Rolling the site back" becomes "Forward only", and the list's order and its opening sentence change.

## Audit 1's reds

**R1, fixed.** The brief now says the change cannot be safely rolled back once anyone has sent a new reason, and why, in line with audit 1's probe P1: today's generated client knows only the seven old values, so `reports.mine` throws (that person's sheet fails to open on that game) and `forReview` throws (the review command fails for everyone). It names the way out (fix forward, not `wrangler rollback`), the safe window (before the first new-reason report), and that an emergency rollback would first need the new rows changed to `other`, a write of real data that waits for the owner. That matches CLAUDE.md, Risk: a real-data write keeps lane 3 and waits for its permission. The old line "The database test checks that a row with a new reason reads back through the service and the review command" is gone with the claim it backed; criterion 3 still checks the new values are accepted.

**R2, fixed.** The list is now Sexual content, Gambling, Ads, Graphic violence, Hate or bullying, A scam or steals your info, Copied from someone else, It doesn't work, Something else. `REPORT_REASONS.slice(0, 3)` is then `["sexual", "gambling", "ads"]`, so `reasons.test.ts` "puts the owner's three rules first" holds unchanged, and so does the `reasons.ts` comment. The sentence says the owner chose no order for the rest, so no test change needs naming.

## Notes (recorded, not blocking)

- N1 to N3 from audit 1 stand: the server's 400 to an unknown reason is a rule here but in no criterion (existing tests hold it); criterion 2 does not re-open the sheet to read the new reason back; the brief does not quote where "A scam or steals your info" comes from.
