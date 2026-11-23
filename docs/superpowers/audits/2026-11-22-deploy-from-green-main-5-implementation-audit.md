# Implementation audit 5: deploy from a green main, PR 2 of 3 (`deploy.yml`), second re-check

**01c1dc7 FAIL: 1 red**

- Examined: branch `claude/project-thread-b4dhof` at `01c1dc7` (`01c1dc75`, the fix for audit 4, on top of audit commit `04cb192`; diff since then: `.github/workflows/deploy.yml` only, +4 −2).
- Brief: spec `docs/superpowers/specs/2026-11-22-deploy-from-green-main-design.md` 3.1 and criterion 2; audit 4 (`2026-11-22-deploy-from-green-main-4-implementation-audit.md`) R3.
- Lane 3. Reviewer: Opus 5.5, medium. Checked at 2026-11-22 19:09 UTC. No pull request is open for the branch yet, so no verdict comment was posted.

## What ran

- actionlint v1.7.7 (built from source) on `deploy.yml`: 0 errors, exit 0. shellcheck is still not installed, so its rule did not run.
- The criterion 2 probe from audit 4 (`/mnt/project-files/audits/2026-11-22-deploy-from-green-main-4-probe_c2.py.txt`): 21 of 22. It fails "every step after target gated on deploy output" (R4).

## Audit 4 finding

- **R3 fixed in behaviour.** `shipped=true` is written right after `pnpm run deploy 2>&1 | tee deploy.log`. Under `bash -e` with `pipefail`, a failed migrate or wrangler deploy ends the step before that line, so the hint prints only after wrangler finished: when the version parse fails, or when the live check fails. Install, build, the key check and the migration no longer print a rollback hint. The new wording ("A new version went live but then something failed") matches that.

## Red findings

### R4: the last step's `if` dropped the target's deploy output

- UNIT: `.github/workflows/deploy.yml`, step `how to roll back`, its `if`.
- VERDICT: red.
- REQUIREMENT: spec criterion 2, "every step after the target has an `if` on the target step's 'deploy' output". Audit 4 R3's FIX asked for both conditions.
- REASON: the `if` is now `failure() && steps.deploy.outputs.shipped == 'true'`. The behaviour is right, because `shipped` can only exist when the deploy step ran, and it runs only when the target's deploy output is `true`. But the written criterion, and the `tests/deploy-workflow.test.ts` that PR 3 must write from it, fail against this file.
- EVIDENCE: the probe: `FAIL every step after target gated on deploy output`, 21 of 22.
- EXPECTED: `if: failure() && steps.target.outputs.deploy == 'true' && steps.deploy.outputs.shipped == 'true'`.
- FIX: add `steps.target.outputs.deploy == 'true' &&` to that `if`. Only `deploy.yml`. Do not change criterion 2 to fit the file.

## Notes (not blocking)

- Audit 3 notes N1 to N4 still stand. PR 3 carries the criterion 2 test and the 3.3 docs. Tell the owner about red Deploy runs before the keys exist.

## To pass

Fix R4. The re-check runs actionlint and the probe, which must then pass 22 of 22.
