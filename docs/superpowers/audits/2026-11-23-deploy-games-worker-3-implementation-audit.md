0d10ee4 PASS

# Implementation audit 3: deploy the games Worker, PR 4b (#358)

Examined: head `0d10ee4` (0d10ee4b9a19f107689c5555ec6a2f6ec7e8e0a9) of `claude/project-thread-b4dhof`, against `origin/main` at `e710f79` (includes #359).
Prior audit: round 2 at `45ba9ef`, FAIL 1 red (commit d4d8a28 on `claude/project-thread-6clq8f`).
Spec: `2026-11-23-deploy-games-worker-design.md` (plan audit 2 PASS at 2169a5c). Lane 3 (`.github/workflows/deploy.yml`).
Reviewer: fresh session, Opus 5.5, medium. Written 2026-11-23 06:14 UTC (from `date`).

**Verdict: PASS.** R1 is fixed; the hint change is right; nothing regressed against round 2.

## What ran (on 0d10ee4)

| Check | Result |
|---|---|
| `pnpm exec vitest run tests/deploy-workflow.test.ts tests/games-check.test.ts` | 2 files, 29 passed |
| `pnpm test` (whole unit suite) | 145 files, 2121 passed |
| `pnpm lint` | exit 0 |
| YAML parse (`yaml.safe_load`) | ok |
| CI on 0d10ee4 (quick, draft) | every check success (gate, verify, postgres, 6 browser shards, commit-authors, pr-rules-run) |
| actionlint, `gh secret list --env production` | not run here (same container limits as round 2) |

## R1 (round 2): fixed

`git diff origin/main...0d10ee4` touches only `.github/workflows/deploy.yml` (+49/-3). The test file now on main (#359) allows 8 or more guarded steps after the target and allows `secrets.` in the deploy, live check, games deploy (`id: games`) and games check steps. Full unit suite green at the head that would merge, so main does not go red.

## The hint change (4da0d75): right

Site hint is now `failure() && deploy == 'true' && shipped == 'true' && steps.games.outcome == 'skipped'`.

- Site deploy fails after `shipped=true` (no version id), or the live check fails: the games step's default `success()` is false, so it is skipped; the site hint fires. Correct.
- `GAMES_ROUTE` empty: the games step runs and fails (outcome `failure`), so no site hint (the site is fine, round 2 N1 closed) and no gate hint (`games_started` never written). The step's own `::error::` names the missing secret. This matches spec criterion 2 ("the site hint does not fire for a games-only failure").
- Games deploy or games check fails after `games_started=true`: games outcome is `failure` or `success`, never `skipped`, so only the gate hint fires, naming `wrangler rollback --name ruken-games`. Correct.
- No deploy (`deploy != 'true'`): both hints guarded off, as before.

## Round 2 spec check: unchanged

Diff 45ba9ef..0d10ee4 on `deploy.yml` is that one `if:` line. Order, guards, secrets (`GAMES_ROUTE` only in the games step `env`, used as `"$GAMES_ROUTE"`), masking, `set -o pipefail`, `id: games`, `games_started` before wrangler: all as audited in round 2.

## Notes (not blocking)

- **N1. Spec criterion 2's new test cases are still not written.** #359 loosened the two pinned cases but added none of the cases criterion 2 lists (step order ending in games deploy and check, `GAMES_ROUTE` placement, mask/marker/command order, gate hint keys, site hint not firing for a games-only failure). The PR body assigns them to 4c; the spec's criterion 2 is met only when 4c merges. Add a case that the site hint carries `steps.games.outcome == 'skipped'`.
- **N2. Criteria 1 (actionlint) and 5 (secret names, first green Deploy run) are still unverified**; 5 is after-merge by design.
- **N3 (round 2 N2, N3) stand**: host mask assumes `*.` wildcard; changed-only CI unit runs skip text-reading workflow tests when only `.github/` changes.
