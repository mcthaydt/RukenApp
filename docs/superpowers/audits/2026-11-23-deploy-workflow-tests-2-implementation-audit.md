# Implementation audit 2: deploy workflow tests (PR #373)

Examined: PR #373 head `b10b89f2dac7225faf482c14106dbab32c03037a`. Re-review of audit 1 (78a1935 FAIL, 3 red). Opus 5.5 medium. Written 2026-11-23 18:14 UTC (`date -u`).

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## Verdict

**b10b89f PASS.** 0 red.

## What ran

- `git diff origin/main...b10b89f --stat`: only `tests/deploy-workflow.test.ts` (+76). `deploy.yml` is byte-identical to the one audit 1 mutated.
- 21 of 21 pass on b10b89f. Against `deploy.yml` from `d9f5fde` (before #368): 1 failed, 20 passed (the mask test). ESLint clean on the file.
- All 21 edits from audit 1 rerun on b10b89f, plus three more:

| Edit | Audit 1 | Audit 2 |
|---|---|---|
| M1 to M15, M19 (order, route, marker, mask, pipefail, version handoff, hints, secrets) | caught | caught |
| `dbhost=${DIRECT_DATABASE_URL#*://}` removed (R1) | 21 pass | 1 fail |
| games "no version id" block removed (R2) | 21 pass | 1 fail |
| `dbhost=${dbhost##*@}` removed | not run | 1 fail |
| `dbhost=${dbhost%%[/?:]*}` removed | not run | 1 fail |
| only `exit 1` removed from the games empty-id check | not run | 1 fail |
| `host=${GAMES_ROUTE#*://}` removed (N1) | 21 pass | 21 pass |
| harmless reformat / reworded rollback hints | 21 pass | 21 pass |

## Red findings from audit 1

- R1: fixed. The three host lines, the mask and the migration must all exist and be in order.
- R2: fixed. Read, empty check, its error, `exit 1` and handoff must all exist and be in order.
- R3: fixed. `gh api repos/mcthaydt/RukenApp/pulls/373 --jq .body`: the first two lines are the attribution lines and the last line is "Requested by **McThayDT**".

## Notes (not blocking)

- N1 (from audit 1, still open, optional): the games host lines before its mask are not pinned.
- N4: the version-id test now matches the start of the games error text ("::error::The games deploy finished but printed no version id"), so rewording that message breaks the test. Acceptable since it anchors the `exit 1`; a looser anchor would be `::error::` after the empty check.
