# Deploy log host mask: implementation audit 1

- Pull request: #368, head `81b6f461e8521604a6e40b9b437c73efed9272da` (branch `claude/project-thread-b4dhof`)
- Lane: 3 (`.github/workflows/deploy.yml` only)
- Reviewer: fresh session, Opus 5.5, medium. Started 2026-11-23 15:32 UTC.
- Verdict: **81b6f46 FAIL: 1 red** (the PR body only; the code change is sound)

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## What ran

- Read the diff (`git show 81b6f461`, 6 added lines in the `deploy` step) and the whole `deploy.yml` at the head.
- `pnpm exec vitest run tests/deploy-workflow.test.ts` at the head: 1 file, **15 passed**.
- The three extraction lines run in `bash -eo pipefail` (the runner's default shell) on nine URL shapes:

| URL shape | Masked value |
| --- | --- |
| Neon direct, `user:pass@ep-…neon.tech/neondb?sslmode=require` | `ep-cool-name-123456.us-east-2.aws.neon.tech` ✓ |
| `u:p@db.example.com:5432/app` | `db.example.com` ✓ |
| user, no password: `user@host.example.org/db` | `host.example.org` ✓ |
| no user info, no path: `postgresql://host.example.org` | `host.example.org` ✓ |
| encoded `%40`, `:`, `/`, `?` in the password, port, two query keys | `h.example.com` ✓ |
| empty URL | nothing masked, script carries on (the `&&` list is not the last command, so `-e` does not stop it) ✓ |
| IPv6 `[2001:db8::1]:5432` | `[2001` ✗ (note N1) |
| two hosts `h1…:5432,h2…:5432` | `h1.example.com` only (note N1) |
| `@` inside the query string `?options=a@b` | `b` ✗ (note N1) |

- Order: the secret is given only to the `deploy` step (env block, unchanged). `install` and `build` never see it. The mask line runs after the missing-key loop (which prints only the variable's name) and before `pnpm run deploy`, whose first command is `prisma migrate deploy` (package.json:16), which reads `DIRECT_DATABASE_URL` through `prisma.config.ts`. `::add-mask::` takes effect for every later line in the job, so the migration output and the later steps are covered.
- Leak check: nothing echoes the host or URL before the mask. GitHub prints the step's script text with the variables unexpanded, and the `::add-mask::` command line itself is not shown in the log.
- Failure modes: a wrong or short mask only changes what the public log shows. `deploy.log` (read by the version grep) and `$GITHUB_OUTPUT` are not masked, so the deploy and the live check behave as before.

## Acceptance criteria (from the PR body)

1. Mask before `pnpm run deploy`, same step, no other step gains the secret: **met** (diff and file read above).
2. Hosts with or without port, query string, user info cut to the bare host: **met** for every Neon and ordinary shape (table).
3. The 15 workflow tests pass: **met**. A mask-before-deploy test in a later tests-only PR: **acceptable**. The rule-mix hook keeps tests out of a lane 3 workflow push, the property is already checked here by reading and by the shell run, and the later test only pins it against regressions. It should be queued now, not left to memory.
4. The next real Deploy log shows `***`: cannot be checked before merge. It stays open until the first Deploy run after merge is read.

## Findings

### R1: the PR body does not start with the attribution lines

- UNIT: PR #368 body.
- VERDICT: red.
- REQUIREMENT: the project's PR attribution rule, which the coordinator's brief for this review names: the body starts with `<!-- claude-projects-attribution: {"github_login":"mcthaydt"} -->` and then the `_Requested by **McThayDT** · [project thread](…)_` line.
- REASON: the body starts with `## Lane`; neither line is there.
- EVIDENCE: `gh api repos/mcthaydt/RukenApp/pulls/368 --jq .body | head -2` prints `## Lane` and `Lane 3 (...)`. (#363 and #333 carry the lines; #364 and #365 merged without them, so the hooks do not enforce this.)
- EXPECTED: those two lines first, the rest of the body unchanged, last line still `Requested by **McThayDT**`.
- FIX: edit the PR body only (no new commit, so the head and the code review above stay valid). Read it back with `gh api …/pulls/368 --jq .body | head -2` and `| tail -1`.

### Notes (not fixed here)

- N1: the cut does not handle an IPv6 literal (masks `[2001`), a multi-host URL (masks the first host only) or an `@` in the query string (masks the text after it, which would garble the log with `***`). None is a Neon shape, and a bad mask never breaks the deploy, so this is recorded only. If the address ever changes provider, revisit.
- N2: the future tests-only PR should pin that the mask line sits before `pnpm run deploy` in the `deploy` step and that the cut uses the last `@`.
