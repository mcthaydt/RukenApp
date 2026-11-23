# Implementation audit 7: deploy from a green main, PR 2 of 3 (`deploy.yml`), re-check after the main merge

**ec0699a PASS**

- Examined: pull request #355, branch `claude/project-thread-b4dhof` at `ec0699a` (`ec0699a57b80a039eeeadba84ec8b8ade798848a`). Since audit 6 passed `4df88ac`: audit commit `604370b`, a merge of `main` `e50e672` (`1b2eab9`), and `ec0699a` (one progress.md row for #350).
- Brief: spec `docs/superpowers/specs/2026-11-22-deploy-from-green-main-design.md` 2, 3.1, 3.2, acceptance criteria 1 to 3; audits 3 to 6 of this topic.
- Lane 3. Reviewer: Opus 5.5, medium. Checked at 2026-11-23 04:20 UTC (from `date`).

## What ran

- **Criterion 1, actionlint (the PR body's "NOT MET"):** actionlint v1.7.7, built from source with `go install`, with ShellCheck 0.11.0 and pyflakes on `PATH` so its shellcheck and pyflakes rules ran (audit 6 ran without them). `actionlint -verbose .github/workflows/deploy.yml`: "Found 0 parse errors", "Found total 0 errors", exit 0. Criterion 1 is now met at this head; the file is byte-identical to `4df88ac` (sha256 `493c98fe…092bd`).
- `pnpm lint` (eslint and prettier over the repo): exit 0.
- `shellcheck .github/scripts/deploy-target.sh .github/scripts/live-check.sh`: exit 0.
- Criterion 2 probe (`/mnt/project-files/audits/2026-11-22-deploy-from-green-main-4-probe_c2.py.txt`, run with `python3 -I`): 22 of 22.
- Criterion 3: `vitest run tests/deploy-target.test.ts tests/live-check.test.ts`: 2 files, 18 tests passed.

## The change since 4df88ac

- `git diff 4df88ac ec0699a` on the files this PR changes against `main`: `deploy.yml` and the spec unchanged; audit 6 added; one progress.md row ("How the feed works" page, #350, merged as `e50e672`), which matches `main`.
- The merge `1b2eab9` is clean: `git show --remerge-diff` shows no hand-resolved hunks. `ci.yml` at this head equals `main`'s.
- The diff against `main` is `deploy.yml`, the spec amendment, audits 3 to 6, and the progress.md row. Nothing else.
- `deploy.yml` still calls `.github/scripts/deploy-target.sh` and `live-check.sh`, both present and executable (merged in #339).

## Findings

None red. Everything audit 6 found right still holds, since `deploy.yml` did not change.

## Notes (not blocking)

- N1: At 04:16 UTC no `CI` or `commit-authors` run existed for `ec0699a` (only `pr-rules`, both green). Criterion 4 needs the full run green on this head before the merge; it starts when the draft is marked ready.
- N2: The PR body's criterion 1 line still says NOT MET. The builder can update it to name this audit.
- Carried from audit 6: criterion 2's `tests/deploy-workflow.test.ts` and the 3.3 docs come in PR 3; before merging, tell the owner that every green `main` gets a red Deploy run until the keys are set (they report steps 1 and 2 done).
