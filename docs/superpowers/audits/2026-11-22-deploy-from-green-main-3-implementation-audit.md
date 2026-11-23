# Implementation audit 3: deploy from a green main, PR 2 of 3 (`deploy.yml`)

**42fcabc FAIL: 2 red**

- Examined: branch `claude/project-thread-b4dhof` at `42fcabc` (diff against `main` `db30309`: `.github/workflows/deploy.yml` new, spec 3.1 and criterion 2 amended). Since then `main` moved to `dfd81d9`; nothing in that move touches `.github/` or the spec.
- Brief: `docs/superpowers/specs/2026-11-22-deploy-from-green-main-design.md` sections 2, 3.1, 3.2, criteria 1 and 2; the three PR 2 conditions in implementation audit 1; the coordinator's asks (deploy only after green CI on `main`, right secrets and environment, no untested commit, no script injection, actionlint).
- Lane 3 (`.github/workflows/`). Reviewer: Opus 5.5, medium. Checked at 2026-11-22 19:07 UTC. No pull request is open for the branch yet, so no verdict comment was posted.

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## What ran

- **Criterion 1, actionlint: run, 0 errors.** actionlint v1.7.7 built from source (`go install github.com/rhysd/actionlint/cmd/actionlint@v1.7.7`), `actionlint -verbose .github/workflows/deploy.yml`: "Found total 0 errors", exit 0. Its `shellcheck` rule did not run (no `shellcheck` in this container), so the two `run:` blocks were checked by hand and by the probe below, not by shellcheck. `pnpm lint` not run here (no install); the PR's own CI runs it.
- **Criterion 2, a probe in place of the test PR 3 will add.** A 22-assertion script reading `deploy.yml` (every clause of amended criterion 2, plus: no `${{ }}` inside any `run:`, no `github.event.*` other than the four gated fields, `GH_TOKEN` on the target step only, the job `if` has no `||`): 22 of 22 pass. It fails by itself: inlining `head_sha` in `run:` (2 fails), dropping the `push` test, checking the scripts out from `main` instead of `github.sha`, a secret on the install step, and `cancel-in-progress: true` each give 1 fail.
- **Version id parse, run under GitHub's default shell** (`bash -e`, which is what a `run:` with no `shell:` gets) with a log that holds no version line: exits 1 and prints nothing (R1). With a log holding `Current Version ID: <uuid>` it prints `version=<uuid>`, exit 0.
- **wrangler 4.156.0** (the pinned one, `npm pack`, read only, never run): a normal deploy logs `logger.log("Current Version ID:", versionId)`, so the grep pattern matches today's output.

## What is right

- **The three PR 2 conditions from audit 1 are met.** (1) The first step checks out `${{ github.sha }}`, the default-branch commit this workflow file was read from. (2) It goes into its own folder `tip`, sparse to `.github/scripts`, `persist-credentials: false`, no `env`, no secret; the script runs as `tip/.github/scripts/deploy-target.sh` (mode 100755 in git); the target is checked out at the root after it, so the second `actions/checkout` never meets a sparse tree. (3) `RUN_SHA: ${{ github.event.workflow_run.head_sha }}` is in that step's `env`, never in `run:`, and `GH_TOKEN` is on that step alone. The script reads exactly `REPO`, `RUN_SHA`, `GH_TOKEN` (through `gh`) and `GITHUB_OUTPUT`, and writes `deploy` and `sha`, the names the later `if`s and `ref` read.
- **Only after green CI on `main`.** `workflow_run` on `CI`, `completed`, `main`; the job runs only when the run's `event` is `push`, its `conclusion` is `success` and its head repository is this one, all joined with `&&`. `ci.yml` is named `CI`, runs on push only for `main`, never skips work on a push (its docs-only rule applies to pull requests), and never cancels a `main` run, so a green push run is a full green run.
- **No untested commit.** The target is either the run's own commit (green by the job `if`) or the tip of `main` when that tip's newest `CI` push run is `completed` and `success`; anything else ends green with `deploy=false` and every later step skips. Every step after the target carries `if: steps.target.outputs.deploy == 'true'` and runs on the target's checkout. `workflow_run` runs the default branch's copy of this file, so a pull request cannot change what deploys.
- **Secrets and environment.** `environment: production`; permissions exactly `contents: read` and `actions: read`; no workflow-level or job-level `env`. `CLOUDFLARE_API_TOKEN` (secret) and `CLOUDFLARE_ACCOUNT_ID` (variable) reach only the deploy and live-check steps, `DIRECT_DATABASE_URL` only the deploy step, which is what `prisma.config.ts` reads first. Install and build see none of them. Both checkouts have `persist-credentials: false`. A missing key is named and stops the step before `prisma migrate deploy` runs.
- **No script injection.** No `${{ }}` appears in any `run:`; every outside value (`head_sha`, the target's outputs, the deploy's version) reaches a shell through `env` or is used only in `with:`/`if:`. The target sha comes from GitHub's API, not from text a person writes.
- **One at a time,** `deploy-production`, `cancel-in-progress: false`; the same pinned `actions/checkout`, `pnpm/action-setup` and `actions/setup-node` SHAs as `ci.yml`, Node from `.nvmrc`.
- **Spec amendment.** 3.1 and criterion 2 now describe the sparse first step exactly as built (folder, ref, no secret, `RUN_SHA` and `GH_TOKEN` in that step's `env`), as audit 1 asked.

## Red findings

### R1: a deploy that prints no version id fails with no reason

- UNIT: `.github/workflows/deploy.yml`, step `deploy`, the `version=$(…)` line.
- VERDICT: red.
- REQUIREMENT: spec 2, "A failed deploy or a failed live check turns the run red with a one-line reason", and the step's own `::error::` branch.
- REASON: the step runs under `bash -e` with `set -o pipefail`; when `grep` finds no version line it exits 1, the pipeline fails, the assignment fails and `-e` ends the step before the `if [ -z "$version" ]` branch prints its `::error::`.
- EVIDENCE: the probe above: the same lines under `bash -e` with a log that has no `Current Version ID:` line exit 1 and print nothing. On GitHub this is "Process completed with exit code 1" with no reason, the case the branch was written for (wrangler changes its wording).
- EXPECTED: that case ends red with `::error::The deploy finished but printed no version id, so the live check cannot run.`
- FIX: let the parse come back empty instead of failing, for example `version=$(grep -oE 'Current Version ID: [0-9a-f-]{36}' deploy.log | tail -1 | awk '{print $NF}' || true)`. Only `deploy.yml`. PR 3's `tests/deploy-workflow.test.ts` may hold it (run the step's script with a stub log); not required here.

### R2: a failed live check does not say how to roll back

- UNIT: `.github/workflows/deploy.yml` (no step prints it); `.github/scripts/live-check.sh` (does not either).
- VERDICT: red.
- REQUIREMENT: spec 3.1, "no automatic rollback … The failure says how to roll back by hand (`pnpm exec wrangler rollback`)".
- REASON: the rollback command is only in a comment at the top of `deploy.yml`; nothing in a failed run's log says it.
- EVIDENCE: `grep -n -i rollback .github/scripts/*.sh .github/workflows/deploy.yml` finds only `deploy.yml:8`, the comment.
- EXPECTED: when the new version is out and the live check fails, the run's log ends with one `::error::` line naming `pnpm exec wrangler rollback`.
- FIX: add a last step to `deploy.yml`, `if: failure() && steps.target.outputs.deploy == 'true' && steps.deploy.outcome == 'success'`, that prints `::error::The new version is live but failed its check. To go back to the last version by hand: pnpm exec wrangler rollback (a migration may already have run).` It has no secret and no `${{ }}` in `run:`, and its `if` keeps criterion 2's "every step after the target has an `if` on the deploy output". Only `deploy.yml`; tell PR 3's test the step list has seven steps after the target.

## Notes (not blocking)

- **N1: criterion 2's test and the 3.3 docs are not in this PR.** The rule-mix hook keeps `.github/workflows/` apart from tests, so #339's body split the work into three PRs, with `tests/deploy-workflow.test.ts` in PR 3. The 3.3 docs (`this-repo` "Outside the repo", `progress.md` "Preview") are not here either and are not named for PR 3. Docs may travel with the test, so PR 3 should carry both, and its body should say criterion 2 lands after the file it checks. The probe above stands in for criterion 2 at `42fcabc` only.
- **N2: from the merge of this PR until the owner's step 2, every green `main` run gets a red Deploy run** saying the key is missing (spec criterion 6 expects this). Cloudflare's own build keeps deploying until the owner's step 3, so for a while the site is deployed twice per merge. Both are as the spec planned; the coordinator should tell the owner before merging so a red Deploy is not read as a broken `main`.
- **N3: `tip/` at the workspace root.** The root checkout runs after `tip/` exists. Either it clears the folder or `tip/` stays; neither matters, because `pnpm-workspace.yaml` lists only `packages/*`, the build reads only the app, and `live-check.sh` is run from the root checkout. Recorded so nobody adds a step that reads `tip/` later.
- **N4: shellcheck did not run** inside actionlint (not installed here). The two `run:` blocks were read by hand; R1 is the one problem found.

## To pass

Fix R1 and R2 in `deploy.yml`; a re-check runs actionlint, the 22-assertion probe (updated for the new last step) and the empty-log case under `bash -e`, which must then print the `::error::` line.
