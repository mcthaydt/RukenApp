45ba9ef FAIL

# Implementation audit 2: deploy the games Worker, PR 4b (#358)

Examined: head `45ba9ef` (45ba9ef58611e0cf994c4ff6675577284bf72f26) of `claude/project-thread-b4dhof`, against `origin/main` at `46cf916`.
Spec: `2026-11-23-deploy-games-worker-design.md` (plan audit 2 PASS at 2169a5c). Lane 3 (`.github/workflows/deploy.yml`).
Reviewer: fresh session, Opus 5.5, medium. Written 2026-11-23 05:56 UTC (from `date`).

**Verdict: FAIL.** One red finding: the PR turns the existing unit suite red. The workflow itself matches the spec; once the test is updated in this PR it should pass.

## What ran (on 45ba9ef)

| Check | Result |
|---|---|
| `pnpm exec vitest run tests/deploy-workflow.test.ts tests/games-check.test.ts` | **2 failed**, 27 passed |
| `pnpm lint` | exit 0 (also green in CI) |
| YAML parse (`yaml.safe_load`) | ok |
| CI on 45ba9ef (quick, draft) | all completed checks success, but the unit step ran only `architecture` and `wrangler` tests (`--changed` did not reach `deploy-workflow.test.ts`; log of job 137512594958) |
| actionlint, shellcheck | not run: running a downloaded actionlint binary was refused by this session's permission check; not worked around |
| `gh secret list --env production` (spec criterion 5) | not run: the API path is not permitted from this container |

## Red

### R1. The existing workflow test fails, so main would go red

- **Wrong:** `tests/deploy-workflow.test.ts` (on main since #357) pins the old shape. With this diff two cases fail:
  - "skips every step after the target when there is nothing to deploy": `expect(after).toHaveLength(8)`, now 11.
  - "names secrets only in the deploy and live-check steps": now four steps carry `secrets.`.
- **Evidence:** local run above. Draft CI stayed green only because its changed-only unit step runs tests by import graph, and this test reads `deploy.yml` as text (ci.yml `RUN_EVERYTHING_WHEN` does not include `.github/`). The full run on a ready PR, or on main after the merge, runs `pnpm test` and fails. A red main also means Deploy never fires (it needs a green CI run).
- **Expected:** the suite exits 0 at the head that merges. Spec criterion 2 belongs to this change ("one pull request"), so "4c follows" cannot merge after 4b without a red window.
- **Fix (bounded, `tests/deploy-workflow.test.ts` only):** fold 4c into this PR. At least: length 11 and every step still guarded; secrets only in the deploy, live check, games deploy and games check steps; plus criterion 2's new cases (order ends deploy games, check games; `GAMES_ROUTE` only in the games step's `env` and never `secrets.GAMES_ROUTE` in `run:`; in the games step: empty check, then `::add-mask::`, then `games_started=true`, then `pnpm run deploy:games`; `set -o pipefail`; gate hint keyed on `games_started`, naming `--name ruken-games`; site hint carries `games_started != 'true'`). Show each new case fails on main's `deploy.yml` first.

## Spec check (the workflow itself): met

- **Order and guard:** both new steps come after "check the live site", carry `steps.target.outputs.deploy == 'true'` and the default `success()`, so a site that failed its deploy or live check never ships a gate. Deploy only runs from a green push run on main (header unchanged).
- **Secrets:** `GAMES_ROUTE` only in the games step `env`, used as `"$GAMES_ROUTE"` in `run:`, never `${{ }}` there. Token and account id only in the four deploy/check steps; `DIRECT_DATABASE_URL` still only in the site deploy step.
- **Masking:** empty-route `::error::` first, then the bare host derived (scheme, leading `*.`, path stripped) and `::add-mask::`ed before wrangler runs. The full route is a secret and masked as such. For the stated pattern `*.<domain>/*` the host equals the zone name wrangler prints, so that is covered too.
- **Failure paths go red:** `set -o pipefail` with the runner's `bash -e`, so a wrangler failure fails the step (N9); missing version id fails with `::error::`; `games-check.sh` fails on each miss (audited in round 1). Step has `id: games` (N10).
- **Rollback hints:** `games_started=true` is written before wrangler (R3 of plan audit 1). Site hint fires only when the games step never started; gate hint fires on any failure after it started and names `wrangler rollback --name ruken-games`.
- **Scope:** only `deploy.yml` changed; `package.json`, `cloudflare/games/wrangler.jsonc`, `ci.yml` untouched.

## Notes (not blocking)

- **N1. A missing `GAMES_ROUTE` gets the site rollback hint.** If the secret is empty the games step stops before `games_started`, so "how to roll back the site" fires and tells the owner to roll back a healthy site. Spec-conformant ("did not start: as today") and prevented by criterion 5 (secret set before merge). Fix if wanted: write `games_started` before the empty check, or key the site hint on `steps.games.conclusion != 'failure'`.
- **N2. Host mask assumes a `*.` wildcard.** A route like `*<domain>/*` (no dot) would mask `*<domain>`, not `<domain>`. The owner's pattern is `*.<domain>/*`, so fine today; plan audit 2's N8 (secret equals the existing pattern) still stands.
- **N3. CI gap (report only, not this PR's scope).** Changed-only unit runs skip text-reading tests such as `deploy-workflow.test.ts` and `games-check.test.ts` when only `.github/` changes. Adding them to the always-run line, or `.github/` to `RUN_EVERYTHING_WHEN`, would have caught R1 on the draft.
- **N4. Criterion 1 (actionlint) and criterion 5 (secret names) are still unverified** from any container so far.
