# Faster CI unit P-b: implementation audit 1

- Examined: PR #326, head `fa48be4` (branch `claude/project-thread-g0gcfn`), against spec `docs/superpowers/specs/2026-11-22-faster-ci-design.md` section 3.5 (plan audit 9 PASS at `3a801cb`).
- Reviewer: fresh session, Opus 5.5, medium. Lane 3 audit.
- Verdict: **PASS, 0 red, 4 notes.**

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## Lane

Lane 3 is right: the diff touches `.github/workflows/ci.yml` and `CLAUDE.md`; the `this-repo` skill edit describes that CI change and is named in the body. Plan audit 9 passed; this is the implementation audit. Merge then falls under the standing permission (progress.md, History, Standing permissions: lane 3 merges once audits pass and CI is green). The commit quotes the owner's 13:39 UTC words, as `ci.yml` line 4 asks. Both commits are authored by McThayDT.

## Spec 3.5 checklist, P-b build lines

| Line | Result | Evidence |
| --- | --- | --- |
| Matrix `fromJSON(draft && '[1..6]' \|\| '[1..12]')`, job `PIECES: draft && 6 \|\| 12` | PASS | `ci.yml:261`, `ci.yml:281`. Draft run 45036197399 created exactly six pieces; their logs show `PIECES: 6`. |
| Name `browser shard <n> of <PIECES>`, " (quick, draft)" on a draft | PASS | `ci.yml:244`; draft run jobs `browser shard 1 of 6 (quick, draft)` to `6 of 6`. A push to `main` has no `pull_request`, so the expression gives 12, as does `ready_for_review` (draft false). |
| "Pick the journeys" uses `<n>/$PIECES` in three places | PASS | `ci.yml:385`, `:387`, `:392`; no `/6` left in the file. Draft piece 1 log: "Split by main's recorded times." with key `ci-test-times-2659138...`. `shard-plan.ts` `parseShard` reads any `n/of` with n <= of, so it needs no change. 55 journey files x 3 devices = 165 pairs, enough for twelve pieces. |
| `test-times`: twelve restore steps, path/key/`fail-on-cache-miss: true`, join logs "joined 12 of 12 pieces" | PASS | Parsed with PyYAML: 12 restore steps, step n has `piece-times-<n>.json`, key ending `-<n>`, `fail-on-cache-miss: true` for n = 1..12. The join passes all twelve files and logs "joined 12 of 12 pieces, P file and device pairs" (`ci.yml:613-618`). The job still runs only on `push` (always twelve), and the per-piece save key `ci-piece-times-<sha>-<shard>` matches. |
| Comments that said "six" say what is true | PASS | `ci.yml:15-17`, `:240-242`, `:280`, `:302-305`, `:376`, `:487`, `:542`. See N2 for line 9. |
| Gate unchanged | PASS | `gate` job has no diff; it reads every `ran-*` artifact, checks one times key across them and counts the files it has. Required checks on `main` are `gate` and `commit-authors` only, so the renamed pieces need no branch-protection change. |
| `CLAUDE.md` Settings "12 on a full run, 6 on a draft." | PASS | `CLAUDE.md:82`. |
| `this-repo` line 33 | PASS | Names `verify`, `postgres`, the pieces (`of 12` full, `of 6` draft), `gate` passing only when all passed, `test-times`; no `browser` job. |
| P-a ticked; N5 to N7 corrected | PASS | Spec diff: P-a line ticked with #322 `5bbea3e`; 06:23:15 start, the 93-run filter and the p50 261 / p90 519-536 recount, and "20 once, about 11 s at 03:09:58Z". |

## Draft speed

Unchanged by construction: on a draft every changed expression resolves to the old values (six pieces, `n/6`), and the quick run's selection and `--max-failures=1` are untouched. Draft run 45036197399 on `fa48be4`: success, every piece ran 1:06 to 1:32 of work. The run took 15:03:48 to 15:13:46 UTC, almost all of it waiting for runners (N3).

## Notes (not blocking)

- N1. P1, P2's "as today", P3, P4 and A7/A8/A10 can only be seen on the ready run and after merge. P2 is shown above. The merging session checks P1 on the ready run (twelve pieces, one times key, "listed N, ran N in 12 pieces") before merging, and P3/P4 after.
- N2. `ci.yml:9` still says "six browser pieces instead of three". It records the owner's 2026-11-15 words, so it is history and true as written; no change needed.
- N3. Draft piece waits on `fa48be4` ran from 1:28 (shard 4) to 7:53 (shard 2), matching the runner waits spec 3.5 already records. Not caused by this change.
- N4. The gate does not compare the number of `ran-*` files with `PIECES`. A missing piece already fails the gate through `needs.browser-shard.result` and through missing journeys, as the spec's "counts the pieces it has" intends.
