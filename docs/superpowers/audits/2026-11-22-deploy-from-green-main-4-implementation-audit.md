# Implementation audit 4: deploy from a green main, PR 2 of 3 (`deploy.yml`), re-check

**8b81fce FAIL: 1 red**

- Examined: branch `claude/project-thread-b4dhof` at `8b81fce` (the fixes for audit 3, on top of audit commit `1da2f1c`; diff since then: `.github/workflows/deploy.yml` only, +8 −1).
- Brief: spec `docs/superpowers/specs/2026-11-22-deploy-from-green-main-design.md` 2, 3.1, criteria 1 and 2; audit 3 (`2026-11-22-deploy-from-green-main-3-implementation-audit.md`) R1 and R2.
- Lane 3. Reviewer: Opus 5.5, medium. Checked at 2026-11-22 19:08 UTC. No pull request is open for the branch yet, so no verdict comment was posted.

## What ran

- actionlint v1.7.7 (built from source) on `deploy.yml`: 0 errors, exit 0. Its shellcheck rule still could not run (not installed).
- The criterion 2 probe, updated for the new last step (eight steps after the target, each `if` containing the target's deploy output): 22 of 22 pass. Kept at `/mnt/project-files/audits/2026-11-22-deploy-from-green-main-4-probe_c2.py.txt`.
- The deploy step's parse lines from `8b81fce`, under `bash -e` (GitHub's default `run:` shell): a log with no version line prints `::error::The deploy finished but printed no version id, so the live check cannot run.` and exits 1; a log with `Current Version ID: <uuid>` prints `version=<uuid>`, exit 0.

## Audit 3 findings

- **R1 fixed.** `version=$(…) || true` catches the failed pipeline, so the empty case reaches its `::error::` line (run above).
- **R2 not fixed as needed; see R3.** The step that names `pnpm exec wrangler rollback` exists, prints `::error::` and warns about the database. Its `if` is wider than the case it is for.

## Red findings

### R3: the rollback step tells you to roll back when nothing new went out

- UNIT: `.github/workflows/deploy.yml`, step `how to roll back`.
- VERDICT: red.
- REQUIREMENT: spec 3.1, "The failure says how to roll back by hand", meaning when a new version failed. Audit 3 R2's EXPECTED: "when the new version is out and the live check fails".
- REASON: `if: failure() && steps.target.outputs.deploy == 'true'` is also true when install, build, the missing-key check or `prisma migrate deploy` fails. In each of those cases wrangler never ran and the live site is still the last good version. `wrangler rollback` would then take a healthy site back one version further, to an older commit.
- EVIDENCE: `deploy.yml` lines 115 to 120 at `8b81fce`. With `pnpm install` failing, `failure()` is true and the target output is `true`, so the log ends with "To put the previous version back, run: pnpm exec wrangler rollback". The owner is told to run that CLI command.
- EXPECTED: the rollback line prints only when wrangler finished a deploy: the version-id parse failed, or the live check failed. A failure before wrangler finishes prints nothing about rolling back.
- FIX: in the `deploy` step, right after `pnpm run deploy 2>&1 | tee deploy.log`, add `echo "shipped=true" >>"$GITHUB_OUTPUT"`. Change the last step's `if` to `failure() && steps.target.outputs.deploy == 'true' && steps.deploy.outputs.shipped == 'true'`. Only `deploy.yml`. A failed wrangler deploy ends the step before `shipped` is written, so that case prints nothing, which is right because no new version went live. Keep the database warning.

## Notes (not blocking)

- Audit 3 notes N1 to N4 still stand. N1: PR 3 carries `tests/deploy-workflow.test.ts`, now with eight steps after the target, plus the 3.3 docs. N2: tell the owner about the red Deploy runs before the keys exist.

## To pass

Fix R3. The re-check runs actionlint and the probe, and reads the `if`.
