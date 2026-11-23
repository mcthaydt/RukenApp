# Implementation audit 6: deploy from a green main, PR 2 of 3 (`deploy.yml`), third re-check

**4df88ac PASS**

- Examined: branch `claude/project-thread-b4dhof` at `4df88ac` (`4df88ac3`, the fix for audit 5, on top of audit commit `d6f213f`; diff since then: `.github/workflows/deploy.yml` only, one line).
- Brief: spec `docs/superpowers/specs/2026-11-22-deploy-from-green-main-design.md` 2, 3.1, 3.2, criteria 1 and 2; audits 3 to 5 of this topic.
- Lane 3. Reviewer: Opus 5.5, medium. Checked at 2026-11-22 19:10 UTC. No pull request is open for the branch yet, so no verdict comment was posted.

## What ran

- actionlint v1.7.7 (built from source) on `deploy.yml`: 0 errors, exit 0 (criterion 1). Its shellcheck rule did not run because shellcheck is not installed in this container. The `run:` blocks were read by hand, and the version-parse lines were run under `bash -e` at `8b81fce`. Those lines are unchanged since then.
- The criterion 2 probe (`/mnt/project-files/audits/2026-11-22-deploy-from-green-main-4-probe_c2.py.txt`): 22 of 22.
- The whole change against `main` `db30309`: `deploy.yml`, the spec amendment, and audits 3 to 5. Nothing else.

## Findings

- **R1 (audit 3) fixed:** an empty version parse reaches its `::error::` line.
- **R2 (audit 3), R3 (audit 4), R4 (audit 5) fixed:** the step `how to roll back` runs on `failure() && steps.target.outputs.deploy == 'true' && steps.deploy.outputs.shipped == 'true'`. `shipped` is written only after `pnpm run deploy` succeeds, so the rollback hint and its database warning print only once a new version is live. The step keeps criterion 2's guard on the target's output.
- Everything listed under "What is right" in audit 3 still holds at this head. That covers the three PR 2 conditions, green CI on a `main` push only, no untested commit, secrets only in the deploy and live-check steps, the `production` environment, and no `${{ }}` in any `run:`.

## Carried to PR 3 and the merge (not blocking here)

- Criterion 2's `tests/deploy-workflow.test.ts` (eight steps after the target), plus the 3.3 docs (`this-repo`, `progress.md`).
- Before merging, tell the owner that every green `main` gets a red Deploy run until their keys are set.
