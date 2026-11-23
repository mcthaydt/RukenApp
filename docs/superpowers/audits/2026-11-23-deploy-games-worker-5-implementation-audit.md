# Deploy games Worker, implementation audit 5 (PR #362 re-review)

Commit examined: 89bd32e82b1b2e2de8afdd0fbe51299e96b76bf2 (PR #362 head, branch `claude/project-thread-b4dhof`, base main 22267e9).
Lane: 3 (`.github/scripts/`). Reviewer: Opus 5.5, medium, fresh session. Written 2026-11-23 13:54 UTC.
Previous audit: `2026-11-23-deploy-games-worker-4-implementation-audit.md` (commit 12324a2), FAIL at a836bf4 with R1 and R2.

## Verdict

**PASS.** Both reds from audit 4 are fixed, each is caught by a test that goes red when the fix is removed, lint is clean, and nothing that held before has regressed.

## R1: an observability object with no boolean `enabled` passed. Fixed.

- Change: `keeps_nothing` now fails when `.result.observability` is non-null and `.enabled` is not a boolean, with the reason "has no clear on/off, so logs off cannot be seen". Null still skips this check.
- Test: "fails when observability is an object with no clear enabled" loops over `{}` and `{ enabled: "false" }` and expects a non-zero exit and an `::error::…observability` line for each.
- Mutation: replacing the new check with `if false` turns exactly that test red (1 of 18).
- Probe (13 answers, run against the head script with the PR's harness, then removed):

| Answer under `result` | Exit expected | Got |
|---|---|---|
| live: `observability: null, logpush: false, tags: null, tail_consumers: null` | 0 | 0 |
| `observability: { enabled: false }` | 0 | 0 |
| `observability: {}` | fail | fail |
| `observability: { enabled: "false" }` | fail | fail |
| `observability: { enabled: null }` / `{ enabled: 0 }` | fail | fail |
| `observability: { enabled: true }` | fail | fail |
| key missing | fail | fail |
| `observability: null` with `logpush: true` | fail | fail |
| `observability: null` with a tail consumer | fail | fail |
| `observability: []` / `false` | fail | fail |
| `enabled: false` with `logs.enabled: true` | fail | fail |

This matches spec §3/§4.3 (off must be seen, not assumed) with null accepted as Cloudflare's live "off" answer.

## R2: `no-dynamic-delete` lint error. Fixed.

- Change: the test env is built with `Object.fromEntries(Object.entries(base).filter(([key]) => key !== opts.without))`; no `delete`.
- `npx eslint tests/games-check.test.ts`: exit 0. `pnpm lint` (whole repo, includes Prettier): exit 0.
- CI on 89bd32e: `verify (quick, draft)`, `gate (quick, draft)`, postgres, browser shards 1–6, commit-authors and pr-rules-run all success.

## What ran

| Check | Result |
|---|---|
| `vitest run tests/games-check.test.ts` on the head | 18 of 18 pass |
| Same tests against main's `games-check.sh` | 2 of 18 fail (null case; missing token/account case) |
| Mutation: null treated as failing in the new check | "passes when Cloudflare says observability is null" turns red |
| Mutation: new enabled-type check removed | "object with no clear enabled" turns red |
| `pnpm lint` | exit 0 |
| shellcheck | not installed in this container; not run |
| `pnpm typecheck`, full unit suite | not run: the diff since audit 4 touches only the script and its own test, and CI's `verify` (which runs them) is green on this head |

## Regressions checked

- The diff since a836bf4 is 2 files, +15/−2: the new check and the env builder plus the two-case test. The audit-4 mutation set (missing key, non-object, enabled/logs/traces on, logpush, tail consumer, token/account loop) still holds: those tests pass on the head and the related lines are unchanged.
- The token is still only in a header file. No workflow file changed.

## Notes (not blocking)

- N1 (carried from audit 4): the spec copy in project files still says `observability.enabled` must be present; it should record that null is Cloudflare's "off" answer.
- N2: the PR body's criterion 4 still says "2 of 17 fail … 17 of 17"; on this head it is 2 of 18 and 18 of 18 (audit 4 guessed 19; the builder folded the two cases into one test). Body text only.
