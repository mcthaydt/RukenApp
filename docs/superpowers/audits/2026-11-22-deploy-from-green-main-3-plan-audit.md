# Plan audit 3: Deploy from a green main

- Spec: `docs/superpowers/specs/2026-11-22-deploy-from-green-main-design.md`
- Branch: `claude/project-thread-mqcz6h`. Examined commit: `3e5d939` (the fix of plan audit 2, `8022bd7`, FAIL 1 red at `30827c7`).
- Also read: `git diff 30827c7 3e5d939`, the owner steps at `/mnt/project-files/owner-steps/2026-11-22-deploy-from-green-main.md`, and the source of the Neon CLI that `npx -y neonctl` runs today (`neonctl` 9.9.3, which loads `neon` 9.9.3: `dist/_chunks/branches-Bp-5z1lM.js`, `computes-Cgc9-J33.js`, `projects-*.js`, `connection_string-6WhV4WFx.js`, fetched with `npm pack`).
- Lane 3. Model: Opus 5.5, medium.

**Verdict: FAIL: 1 red, 2 notes.** R5's role, database name, branch argument and loud check are all in, and N8 to N11 are taken. But the command R5's fix added to find the branch cannot show it: `neonctl branches list` prints no host. That is R6. Everything else from audits 1 and 2 still holds.

## R5 and the four notes of audit 2

- **R5: mostly fixed.** Both `connection-string` lines (spec lines 73 and 85, owner steps lines 16 and 28) now pass `<branch> --project-id --database-name --role-name`, with the same arguments, so the checked string and the stored string are the same. The check line is a real command: it takes the host from the string, compares it with the origin host minus `-pooler`, and prints "same database" or "STOP: different database (…)". Checked against the CLI source: `connection-string` writes the bare URI and a newline to stdout (line 153), takes a branch name or id as its positional argument, and without `--pooled` gives the direct host, which is the endpoint host; the pooled host is that host with `-pooler` added after the endpoint id (line 118), so removing `-pooler` is right. If `neonctl` fails, `HOST` is empty and the line prints STOP. "Go on only if it printed "same database"" comes before any secret is set. The one gap is how the owner finds `<branch>`: R6.
- **N8: done.** 3.1 says the target's "deploy" output is `false` and later steps skip; criterion 2 now tests an `if` on that output for every step after the target.
- **N9: done.** 3.3 adds "a grey "cancelled" Deploy run is normal" to `this-repo`.
- **N10: done.** Step 2 says the first `neonctl` command opens the browser once.
- **N11: done.** 3.1 says the implementer reads `ci.yml` on `main` again at build time.

## Owner steps: same as the spec?

Yes. Section 4 of the spec and the owner steps file differ only in the file's two-line header ("Held until the plan re-check passes…"), checked with `diff`. Order is still right. Hold it until R6 is fixed and re-checked.

## Red finding

### R6. `neonctl branches list` does not show which branch has the origin host
- UNIT: spec section 4 step 2, line 72 (and line 71's comment), and the owner steps file lines 14 and 15 (same text).
- VERDICT: red.
- REQUIREMENT: plan audit 2 R5's EXPECTED ("the command names the branch and role that match the Hyperdrive origin") and its REASON (the owner must not be left stuck with no command to get the right one); CLAUDE.md "CLI first" (give the owner CLI commands).
- REASON: the step says "note the branch whose endpoint is that host", but `branches list` prints no endpoint or host, so the owner can only guess the branch; and `projects list` prints no host either, so "note the id of the project with that host" is also a guess.
- EVIDENCE: in `neon` 9.9.3, `branches list` writes `BRANCH_FIELDS` = `name, id, current_state, expires_at, created_at` (`branches-Bp-5z1lM.js` lines 24 to 30 and 223 to 231); `projects list` writes `PROJECT_FIELDS` = `id, name, region_id, created_at` (`projects-*.js` lines 25 to 30). The command that ties a host to a branch is `computes list` (alias `endpoints`), which prints `id, branch_id, type, current_state, …` (`computes-Cgc9-J33.js` lines 23 to 30 and 53 to 55); a Neon host's first label is that endpoint id (`ep-…`), as `connection_string` line 118 shows. With one project and one branch the guess is right; with a second branch (Neon makes preview branches easily) the check prints STOP and the steps give no command to find the right branch, which is the stuck owner R5 was raised to prevent. Nothing is migrated on the wrong database, because the check still guards.
- EXPECTED: the owner finds the project and the branch from the origin host with commands whose output shows it, before the check line.
- FIX: in section 4 step 2 and the owner steps file only: change line 71's comment to "note the id of each project"; replace the `branches list` line with `npx -y neonctl computes list --project-id <project id>   # find the id that starts the origin host (the part before the first "." with any "-pooler" removed); note its branch_id` and say in one line to run it for each project id until one matches; use that `branch_id` as `<branch>` on both `connection-string` lines. No other file.

## Notes (recorded, not blocking)

- N12. On a Mac the owner's shell is zsh, where `HOST` is a shell variable set to the computer's name. The check line overwrites it for that terminal. Harmless, but `DB_HOST` would avoid it; change only if R6's fix touches the line anyway.
- N13. The check passes if both sides are empty (owner leaves `ORIGIN_HOST=` blank and `neonctl` prints nothing). Unlikely, since the placeholder `<origin host>` left in place is a shell syntax error; adding `[ -n "$HOST" ] &&` before the comparison closes it.
