# Deploy log host mask: re-point audit (cycle 2)

- Pull request: #368, head `248e1bc2c1ef0d51b159b0b5944bc8640fc47f4e` (main `9a256d5`, with #371, merged in).
- Earlier verdict: `81b6f46 PASS` (cycle 1).
- Reviewer: fresh session, Opus 5.5, medium. Written 2026-11-23 17:23 UTC.
- Lane 3 (`.github/` workflow file).

## Verdict

248e1bc PASS, 0 red, 0 notes.

## What was checked

| Check | Result |
|---|---|
| `origin/main` (`9a256d5`) is an ancestor of `248e1bc` | yes |
| `git diff origin/main 248e1bc --stat` | `.github/workflows/deploy.yml | 6 ++++++`, one file |
| Changed lines vs main at `248e1bc` equal the changed lines of `81b6f46` vs its merge base | identical (diff of the +/- lines is empty) |
| `pnpm exec vitest run tests/deploy-workflow.test.ts` at `248e1bc` | 15 passed of 15 |

The six added lines are the comment pair and the host-mask block (`dbhost` from `DIRECT_DATABASE_URL`, then `::add-mask::`) before `pnpm run deploy`, exactly as passed at `81b6f46`. The merge of main brought in nothing that touches `deploy.yml` or its test.

## CI at the time of the audit

`commit-authors` green; browser shards, `postgres` and `verify` running. `pr-rules-run` failed on a race, not a rule: "refs/pull/368/head is 81b6f46, not the head 248e1bc it was judged on" (the run started before GitHub moved the pull ref). It reruns on the verdict comment.
