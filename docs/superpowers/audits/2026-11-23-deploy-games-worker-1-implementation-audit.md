# Implementation audit 1: deploy the games Worker, PR 4a (#357)

Examined: head `9ae64ea` (9ae64eae6f070b7d52a17fec971e87c9e237386e) of `claude/project-thread-b4dhof`, against `origin/main` at the time of review.
Spec: `2026-11-23-deploy-games-worker-design.md` (plan audit 2 PASS at 2169a5c). Lane 3 (`.github/scripts/`).
Reviewer: fresh session, Opus 5.5, medium. Written 2026-11-23 05:02 UTC.

**Verdict: PASS.** No red findings. Two notes.

Scope of this audit: 4a only (`.github/scripts/games-check.sh`, `tests/games-check.test.ts`, `tests/deploy-workflow.test.ts` carried from the PR 3 commit 9c18464, and the two docs lines). No workflow file changes; `deploy.yml` steps, `GAMES_ROUTE`, the rollback split and spec criteria 1, 2 and 5 belong to 4b and 4c and are not judged here.

## What ran (on 9ae64ea)

| Check | Result |
|---|---|
| `pnpm exec vitest run tests/games-check.test.ts tests/deploy-workflow.test.ts` | 29 of 29 passed (14 + 15) |
| `pnpm lint` | exit 0 |
| `pnpm typecheck` | 0 errors, 0 warnings |
| CI on 9ae64ea (quick, draft) | all checks success (gate, verify, postgres, browser shards 1–6, pr-rules, commit-authors) |
| Mutation: each of the nine checks removed in turn from the script, the suite run | each removal: 1 failed, 13 passed (observability on, logs on, traces on, missing observability, logpush, tail consumers, success false, non-200, version at 100%). Script restored, `git status` clean. |
| Script by hand against a stub wrangler printing real 4.156.0 text (banner, proxy warning, ANSI colour on `(100%)`) | version check passes |
| Same, split 90/10 with the new id at 90% | fails: "not at 100%" |
| Same, old id at 100% and the new id only in a Message line | fails: "not at 100%" |
| shellcheck, actionlint | not installed in this container; not run |

## Spec criterion 3 (games-check.sh and its tests)

Met. Every case the spec lists is a test: pass with all off; fail on observability on; logs on under a false top switch; traces on; missing `observability.enabled`; `logpush: true`; non-empty `tail_consumers`; `success: false`; non-200; version below 100%; an API that never answers (wait injected, finishes under 10 s). Plus no version id, settling after a delay, and absent-but-off fields passing. The stand-in API checks the exact path and bearer header, and the stub wrangler refuses any call but `deployments status --name ruken-games`, so a script that asked the main Worker would fail. The API is read, never the wrangler config. The token is passed in a header file in a 700 temp dir, never on a command line. Wait is 5 s / 60 s, the same as `live-check.sh`.

## The text-parsing version check (deviation from N5 / spec §3 item 1)

The spec says `--json` read with `jq`; the script greps the text output, as `live-check.sh` does. Judgment: **robust enough, and it fails closed.**

- Evidence from wrangler 4.156.0 (`wrangler-dist/cli.js` 362002–362090, the version pinned in the lockfile): text mode prints each version as `${brandColor("(" + percentage + "%)")} ${version.id}` on one line. The grep needs `100%` and the full version id on the same line; ANSI colour does not break it (run above). `(10%)` cannot match `100%`; the id is a full UUID matched as a fixed string.
- If a later wrangler changes the layout, the check finds no matching line and the run goes red with "not at 100%". It cannot turn a not-live version into a pass, except through a line that carries both `100%` and the new id when the new id is not live, which only a deployment Message annotation written that way could do. Nobody writes such messages.
- Same parse already runs in production in `live-check.sh` (PR 2, #355, merged).

So this is a note, not red: the property the spec wants (the new version at 100%, failing otherwise) holds and is tested.

## Notes (not blocking, not fixed here)

- **N1. Record the deviation.** UNIT: spec §3 item 1. VERDICT: note. REQUIREMENT: spec says `--json` with `jq`; plan audit 2 marked N5 "Fixed". REASON: the build reads the text format instead, so spec and code disagree. EVIDENCE: `games-check.sh` `version_is_live`. EXPECTED: one source of truth. FIX: either change the spec line to "read as text, like `live-check.sh`", or switch both scripts to `--json` + `jq '.versions[] | select(.version_id == $id) | .percentage == 100'` in one later change. Either is fine; the first is a one-line doc edit.
- **N2. Missing account id or token is not an `::error::`.** UNIT: `.github/scripts/games-check.sh`. VERDICT: note. REQUIREMENT: spec "failing with `::error::` and the exact reason on the first miss". REASON: with `CLOUDFLARE_API_TOKEN` or `CLOUDFLARE_ACCOUNT_ID` unset, `set -u` stops the script with bash's "unbound variable" (exit 1), not an annotated line. EVIDENCE: run above: `line 46: CLOUDFLARE_API_TOKEN: unbound variable`, exit 1. EXPECTED: fails closed either way (it does), ideally with `::error::`. FIX: a guard beside the `VERSION_ID` one, in `games-check.sh` only. Low value: 4b sets both from secrets, and 4c's test pins that.

## Follow-ups for 4b / 4c

- Criterion 1: run `actionlint` on the whole `deploy.yml` in a container that has it.
- N8 from plan audit 2 (the `GAMES_ROUTE` value must equal the existing route pattern) still stands for the owner step.
