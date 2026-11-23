# Deploy games Worker, implementation audit 4 (PR #362, games-check null fix)

Commit examined: a836bf46c5be380b7f0f4b7d64a2abc349d13e02 (PR #362 head, branch `claude/project-thread-b4dhof`, base main 22267e9).
Lane: 3 (`.github/scripts/`). Reviewer: Opus 5.5, medium, fresh session.
Spec: `/mnt/project-files/specs/2026-11-23-deploy-games-worker-design.md` §3 and §4.3. Brief: the PR body's four acceptance criteria.

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## Verdict

**FAIL: 2 red.** The null fix itself is right and well tested, but the change also lets an observability object with no `enabled` switch pass (the spec says that must fail), and the new test breaks `pnpm lint`, so CI is red on this head.

## What ran

| Check | Result |
|---|---|
| `vitest run tests/games-check.test.ts` on the head | 17 of 17 pass |
| Same tests against main's `games-check.sh` | 2 of 17 fail: the null case and the missing token/account case (AC4 holds) |
| `eslint tests/games-check.test.ts` | 1 error, `62:34 @typescript-eslint/no-dynamic-delete` |
| CI on a836bf4 | `verify (quick, draft)` and `gate (quick, draft)` red on that same lint error (run 45185742974, job 137730743520); browser shards, postgres, commit-authors, pr-rules green |
| shellcheck | not installed in this container; not run |

### Mutations of the head script (each run against the PR's 17 tests)

| Mutation | Tests that turned red |
|---|---|
| Remove the `has("observability")` check | "fails when the observability setting is missing" |
| Remove the "neither null nor object" check | "fails when observability is neither null nor an object" |
| Treat null as missing (`.result.observability != null`) | "passes when Cloudflare says observability is null" |
| Remove `observability.enabled == true` | "fails when observability is on" |
| Remove `logs.enabled == true` | "fails when the top switch is off but logs are on" |
| Remove `traces.enabled == true` | "fails when the top switch is off but traces are on" |
| Remove `logpush == true` | "fails when logpush is on" |
| Remove the tail-consumer check | "fails when a tail consumer is attached" |
| Remove the token/account-id loop | "fails with a readable reason when the token or account id is missing" |

So null, missing and switched-on are told apart, and no logging-on answer passes.

### Probe of extra answers (not in the PR's tests)

| Answer under `result` | main | head | Spec says |
|---|---|---|---|
| `observability: null, logpush: false, tags: null, tail_consumers: null` (live) | fail | pass | (spec predates it; PR's evidence) |
| `observability: null, logpush: true` | fail | fail | fail |
| `observability: null, tail_consumers: [{…}]` | fail | fail | fail |
| `observability: 0`, `[]`, `false` | fail | fail | fail |
| `result: null` | fail | fail | fail |
| `observability: {}` | fail | **pass** | fail |
| `observability: { enabled: "false" }` | fail | **pass** | fail |

## Findings

### R1 (red): an observability object with no boolean `enabled` now passes

- UNIT: `.github/scripts/games-check.sh`, `keeps_nothing`.
- VERDICT: red.
- REQUIREMENT: spec §3 ("`result.observability.enabled` is present and exactly `false` … Anything else, including a missing `observability.enabled`, fails: logs off must be seen, not assumed") and §4.3 (a missing `observability.enabled` fails); the PR's own comment ("an object when it is on").
- REASON: the old check `.result.observability.enabled | type == "boolean"` was replaced by "key present, null or object", which accepts null (wanted) but also any object, whatever its `enabled` holds.
- EVIDENCE: probe above: `{ observability: {} }` and `{ observability: { enabled: "false" } }` exit 0 on a836bf4 and exit 1 on main.
- EXPECTED: null passes (the live answer); an object passes only when `enabled` is a boolean (then the `== true` lines decide); anything else fails with the "not readable"/"missing" reason.
- FIX: in `keeps_nothing`, after the null-or-object check, fail when `.result.observability` is an object and `.result.observability.enabled | type != "boolean"`; add two tests to `tests/games-check.test.ts`: `{ observability: {} }` and `{ observability: { enabled: "false" } }` each fail with `::error::…observability`. Files: those two only.

### R2 (red): the new test breaks lint, so CI is red

- UNIT: `tests/games-check.test.ts:62`.
- VERDICT: red.
- REQUIREMENT: CLAUDE.md checks (`pnpm lint`); spec §4.4 (CI green).
- REASON: `delete env[opts.without]` trips `@typescript-eslint/no-dynamic-delete`.
- EVIDENCE: local `eslint tests/games-check.test.ts` → `62:34 error Do not delete dynamically computed property keys`; CI `verify (quick, draft)` fails on the same line.
- EXPECTED: `pnpm lint` exits 0.
- FIX: build the env without the key instead of deleting it, e.g. `Object.fromEntries(Object.entries(base).filter(([k]) => k !== opts.without))`, or type `without` as the union of the two names and set that key to `undefined`. File: `tests/games-check.test.ts` only.

## Notes (not blocking, not fixed here)

- N1: the spec in project files still says `observability.enabled` must be present; it should record that null is Cloudflare's "off" answer (the coordinator's spec copy, not this PR).
- N2: the PR body's criterion 4 counts "17 of 17"; after R1's two tests it will be 19.

## What holds

- AC1: the exact live answer passes.
- AC2: enabled/logs/traces on fail; a missing key fails; a non-null non-object fails (each shown by mutation).
- AC3: a missing `CLOUDFLARE_API_TOKEN` or `CLOUDFLARE_ACCOUNT_ID` fails with `::error::Games check failed: <NAME> is not set for this step`; uses `${!name:-}`, safe under `set -u`.
- AC4: 2 of 17 fail on main's script, 17 of 17 pass on the head.
- The token is still only in a header file, never on a command line. No workflow file changed. PR body has `## Lane` and ends "Requested by **McThayDT**".
