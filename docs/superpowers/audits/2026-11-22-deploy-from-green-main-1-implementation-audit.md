# Implementation audit 1: deploy from a green main, PR 1 of 3 (the two scripts)

**81ea38a FAIL: 3 red**

- Examined: branch `claude/project-thread-b4dhof` at `81ea38a` (diff against `main` `c556cc0`: `.github/scripts/deploy-target.sh`, `.github/scripts/live-check.sh`, `tests/deploy-target.test.ts`, `tests/live-check.test.ts`).
- Brief: `docs/superpowers/specs/2026-11-22-deploy-from-green-main-design.md` sections 3.1 (target step), 3.2 (live check), criteria 3 and 4; plus the coordinator's asks (no secret leakage, safe quoting, `set -euo pipefail`, correct `gh` API use with `actions: read`, tests that fail when the scripts break, the PR 2 sparse-checkout order).
- Lane 3 (`.github/`). Reviewer: Opus 5.5, medium. No pull request is open for the branch yet, so no verdict comment was posted.

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## What ran

- `pnpm install --frozen-lockfile`, then `pnpm exec vitest run tests/deploy-target.test.ts tests/live-check.test.ts`: 2 files, 14 tests, all pass.
- Mutation run: 15 deliberate breaks, each applied alone, the test file run, the script restored (`git status` clean after). 13 killed, 2 survived (R2, R3 below):

| Break | Result |
|---|---|
| deploy-target: no tip == run fast path | killed |
| deploy-target: no `conclusion == success` check | killed |
| deploy-target: no `status == completed` check | killed |
| deploy-target: no `name == "CI"` filter | killed |
| deploy-target: oldest attempt instead of newest | killed |
| deploy-target: no "no run yet" check | killed |
| deploy-target: writes the run's sha instead of the tip | killed |
| live-check: no `100%` filter (version anywhere in the status passes) | **survived** |
| live-check: version check always passes | killed |
| live-check: no wait, one try per check | **survived** |
| live-check: no title check | killed |
| live-check: 200 accepted for http | killed |
| live-check: no location check | killed |
| live-check: exits 0 on a miss | killed |
| live-check: home check dropped | killed |

- Probe with an empty `VERSION_ID` and a stub wrangler showing some other version at 100%, defaults pointing at the real site (GET requests only): `ok: version_is_live`, `ok: home_is_up`, `ok: http_redirects`, exit 0 (R1). The same probe confirms today's ruken.io answers the default checks: `/` is 200 with `<title>Ruken - The Everyday Console`, `http://ruken.io/sign-in` is 308 to `https://ruken.io/sign-in`.
- Probe with our version at 50% and another at 50%: fails with `version … is not at 100%`, exit 1 (the script is right today; the tests just do not hold it there, R2).
- Probe: `live-check.sh` with `set -euo pipefail` instead of `set -uo pipefail`: all 7 tests still pass (N1).

## What is right

- **Target logic matches 3.1.** Tip equal to the run's commit deploys it; a newer tip deploys only when its newest `CI` push run is `completed` and `success`; running, red or missing ends with exit 0, `deploy=false` and "The newer commit's own run decides." Every case is tested with its printed reason (criterion 3), plus newest-attempt and non-CI-workflow cases.
- **`gh` API use.** `repos/$REPO/commits/main --jq .sha` needs `contents: read`; `repos/$REPO/actions/runs?head_sha=…&event=push` needs `actions: read`. Nothing else is called. `ci.yml` is named `CI` (line 39) and runs on push only for `main` (line 45), so `head_sha` plus `event=push` can only match main's own run. A `gh` failure exits non-zero under `set -e`, turning the run red rather than deploying.
- **Quoting and secrets.** Every expansion is quoted except `$WRANGLER_CMD`, which is split on purpose (`pnpm exec wrangler`) and set only by the test. Neither script reads a secret, prints the environment or uses `set -x`. The only echoed tool output is up to 200 characters of a wrangler error, which GitHub masks for secrets anyway. `curl` never follows redirects, so the 308 is seen as sent.
- **Live check matches 3.2** in order and defaults (version at 100%, home 200 with `<title>Ruken`, http sign-in 308 to https), each step waiting up to 60 s at 5 s steps and failing with `::error::` and the reason. The never-answering server fails in about 2 s with the injected wait (criterion 4).

## Red findings

### R1: an empty version id passes the version check

- UNIT: `.github/scripts/live-check.sh`, `version_is_live`.
- VERDICT: red.
- REQUIREMENT: spec 3.2 item 1, "`wrangler deployments status` shows the version id from step 3 at 100%".
- REASON: `set -u` only catches an unset `VERSION_ID`; an empty one makes `grep -qF ""` match any `100%` line, so the check passes without checking anything.
- EVIDENCE: probe above, `VERSION_ID=` with a stub showing `(100%) 99999999-old`: `ok: version_is_live … Live check passed.`, exit 0. In PR 2 the id is parsed out of the deploy step's output; a parse that comes back empty (wrangler changes its wording) would be reported as a passing live check.
- EXPECTED: an empty or missing `VERSION_ID` fails at once with `::error::` and a reason.
- FIX: at the top of `live-check.sh`, fail with `::error::Live check failed: no version id from the deploy` when `VERSION_ID` is empty; add one test case for it in `tests/live-check.test.ts`. Only those two files.

### R2: no test holds the "at 100%" part

- UNIT: `tests/live-check.test.ts`, "fails when wrangler does not show the new version at 100%".
- VERDICT: red.
- REQUIREMENT: spec 3.2 item 1 and the brief's "confirm the tests fail when the scripts break".
- REASON: the only failing wrangler case shows a different version (`(50%) other-version`), so it fails on the id alone; removing the `100%` filter leaves every test green.
- EVIDENCE: mutation table, "no `100%` filter": 7 of 7 pass.
- EXPECTED: a status that shows our version at less than 100% (for example `(50%) <VERSION>` and `(50%) <other>`) fails.
- FIX: add that case to `tests/live-check.test.ts` (the stub already takes any text; use a two-line echo). Only that file.

### R3: no test holds the wait for the deploy to arrive

- UNIT: `tests/live-check.test.ts`.
- VERDICT: red.
- REQUIREMENT: spec 3.2, "Each address is tried every 5 seconds for at most 60 seconds … the first answer that passes ends the wait", and the brief's "confirm the tests fail when the scripts break".
- REASON: every test answers the same way on every try, so a script that tries once and gives up passes them all. Without the wait, each real deploy would fail its live check while the new version is still spreading.
- EVIDENCE: mutation table, "no wait, one try per check": 7 of 7 pass.
- EXPECTED: a check whose first answer is wrong and a later one right (for example the home page answers 500 for the first ~0.5 s, then 200 with the title) passes, inside the injected wait.
- FIX: add that case to `tests/live-check.test.ts` (the stand-in server can switch on a request count or a time). Only that file.

## Notes (not blocking)

- **N1: `set -uo pipefail` without `-e`** in `live-check.sh`, where the coordinator's brief asks for `set -euo pipefail`. Every call that may fail sits in an `if`, `||` or `$( ) ||`, so `-e` changes nothing there, and with it all 7 tests still pass (measured). Without it a failed `mktemp -d` goes on with an empty `$work`. Add `-e`, or say in the header why it is left out.
- **N2: the skip reason says "failed" for every non-success conclusion,** including `cancelled`, `timed_out` and `skipped`. Printing the conclusion (`its CI run ended $conclusion`) would make the log exact. `deploy-target.sh` and its test only.
- **N3: the wrangler stub ignores its arguments,** so no test shows the script calls `deployments status`. Making the stub answer only to `deployments status` (and fail otherwise, as the `gh` stub does) would pin it.
- **N4: commit `1b118f4` says "fix the deploy notes",** but its diff holds no docs change apart from the live-state file; the 3.4 fix is already on `main` (`.claude/skills/this-repo/SKILL.md` line 41). Nothing to change in code; the PR body should not claim it.

## The PR 2 order: sparse checkout of main's tip first, then the target sha

Safe, with three conditions for PR 2.

- **Why it is safe.** The target is always the tip of `main` at the moment the target step reads it: either the tip is the run's commit, or the tip is deployed or nothing is. So the script never decides about a commit older than itself. The only gap is a race: `main` moves between the sparse checkout and the target step's `gh api …/commits/main`, and a slightly older script decides about a newer tip. Its only inputs are CI conclusions, so an older copy of the same rules decides the same way. Trust does not change either: `workflow_run` already runs `deploy.yml` from the default branch, so the scripts come from the same place as the workflow that calls them, and anything on `main` passed the lane 3 audits for `.github/`. The step has only `GH_TOKEN` with `contents: read` and `actions: read`, and no Cloudflare or database secret.
- **Condition 1: check out `${{ github.sha }}`, not `main`.** For `workflow_run`, `github.sha` is the default-branch commit the workflow file was read from, so the script and the workflow that runs it come from one commit, and the race above disappears for the script itself.
- **Condition 2: put the sparse checkout in its own `path`** (for example `path: tip`, run `tip/.github/scripts/deploy-target.sh`), with `persist-credentials: false`, and check the target out at the workspace root. A second `actions/checkout` into a folder that was sparse-checked-out depends on that action version undoing the sparse setting; a separate folder removes the question. `live-check.sh` then runs from the target's own checkout, which is the same commit.
- **Condition 3: pass the run's commit as `env: RUN_SHA: ${{ github.event.workflow_run.head_sha }}`,** never inline in `run:`, and keep `GH_TOKEN` on the target step only.
- **Paperwork:** the extra step changes spec 3.1 and criterion 2 ("the steps run target, checkout, install, …"). PR 2 should amend both in the spec, name the change in its body, and have `tests/deploy-workflow.test.ts` assert the sparse step comes first, has no secrets and no `GH_TOKEN`, and checks out `github.sha`.

## To pass

Fix R1 to R3 on the branch; the reviewer (or a program) re-runs the 14 + new tests and the two surviving mutations, which must then be killed.
