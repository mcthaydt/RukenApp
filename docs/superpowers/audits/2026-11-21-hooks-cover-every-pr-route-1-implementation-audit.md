**6eee2e5 FAIL: 1 red**

# Implementation audit 1: hooks cover every PR route (PR-H)

Examined: mcthaydt/RukenApp, branch `claude/project-thread-c0wy83`, head 6eee2e5 (work in e1d843c), against `main` at 385b146. Spec: `docs/superpowers/specs/2026-11-21-hooks-cover-every-pr-route-design.md` (its section 6 is the plan). Written 2026-11-21 16:56 UTC. Read only: nothing pushed.

## What ran (on 6eee2e5)

- `pnpm lint` exit 0, `pnpm typecheck` exit 0, `pnpm test` 119 files, 1749 tests pass.
- Failing first: with `main`'s `rules.mjs`, `rules.json` and `settings.json` put back, `tests/rules-pr-routes.test.ts` fails 21 of 32. The 11 that pass on `main` are all "allowed" controls (for example "with 2 open it is allowed"; "a deleted fork is a fork" passes on `main` only because of the docs-only exemption). `tests/pr-rules.test.ts` cannot pass on `main` (the script does not exist there).
- Mutation checks, 13 breaks of the new code, each run against the three suites (94 tests):

| Break | Caught by |
|---|---|
| verdict author filter off | 2 tests |
| forks counted as own | 6 |
| no close on opened/reopened | 4 |
| close on every event | 1 |
| workflow rule 4 off | 1 |
| `pr-rules` reads only page 1 | 1 |
| hook reads only page 1 | 1 |
| `laneOf` reads the whole body | 2 |
| `laneOf` fallback removed | 11 |
| footer strip loosened to any "Generated" block | 1 |
| `.claude/**` kept in the criteria docs list | 1 |
| failed read writes `success` | 2 |
| `hasCriteria` back to any mention | **0 (survives, N1)** |

- Owner decisions held: commit-authors side is PR-R, but the hook's `stripFooter` takes off only the exact `prBody.proxyFooter` block (one-character change, another Generated line, and the session footer are all still reported); docs-only pull requests count (`onlyRulesAndDocs` removed, tested in both suites); only own-branch pull requests count and forks are never closed (`ownBranchPrs`, `mine` gate before close, tested).
- Criteria 1 to 5, 6a, 6b, 7, 8, 10 to 17b each have a test that passes. Criteria 6, 9, 18, 19 are PR-R; 20 is after merge.

## Red

**R1. `laneOf` now ignores a lane named outside the "## Lane" section; the spec does not ask for this, and it lowers the lane the hook and `pr-rules` read.**
- UNIT: `.claude/hooks/pr-rules-lib.mjs` `laneSection`/`laneOf`; the message change in `rules.mjs` `checkPrCreate` ("the lane is read only from that section"); tests `tests/pr-rules.test.ts` "a lane 1 docs pull request whose prose mentions lane 3 reads as lane 1" and "the library reads a lane only from the Lane section", `tests/rules-pr-routes.test.ts` "a lane 1 body whose prose mentions lane 3 ...".
- VERDICT: red.
- REQUIREMENT: spec section 3 and section 5 Boundaries (the change list has no new lane reading; rule 2 is only "names no lane, or names a lane lower than its files' lane"); CLAUDE.md "Keep to the request"; CLAUDE.md Risk and `release`: "The highest lane wins, and confidence never lowers it". This file decides what needs a review, so it is lane 3 surface.
- REASON: on `main`, `laneOf` takes the highest lane named anywhere in the body. Now a body with a Lane section is read only there, and a heading-less body only from lines that start with "Lane N". So a higher lane the author names elsewhere is dropped.
- EVIDENCE: body `## Lane\nLane 1\n\n## Why\nIt also writes real data, so this is lane 3.` on files that are lane 1 by path: `main`'s hook reads lane 3 and refuses ready and merge without a `<head> PASS`; at 6eee2e5 both the hook and `pr-rules` read lane 1, so it is ready and merges on green with no review. Mutation "laneOf reads the whole body" fails only the two prose tests the builder added for this behaviour.
- On the coordinator's question: the heading-less fallback is not itself the hole. It reads a subset of what `main` reads, and a section-only reading with no fallback would refuse such bodies ("names no lane"). The hole is the narrowing as a whole: any lane named outside the place the reader looks is ignored, and "highest lane wins" no longer holds for the body.
- EXPECTED: the body's lane is read as on `main` (every "lane N" outside fenced code, or the whole body, highest wins), in the shared library, for both callers. If reading only the Lane section is wanted (it would stop "not lane 3" in prose from asking for a review), that is a rules change for the owner, in its own pull request.
- FIX: in `pr-rules-lib.mjs` make `laneOf` return the highest `lane N` in the body (keep the fenced-code skip only if wanted, since `main` had none: safer to match `main` exactly); drop `laneSection` if nothing else uses it; restore `checkPrCreate`'s refusal text to `main`'s; remove or invert the three prose-mention tests (the second half of the pr-rules one, "This is a lane 3 matter" names no lane, would then read lane 3). Files: `.claude/hooks/pr-rules-lib.mjs`, `.claude/hooks/rules.mjs` (one message), `tests/pr-rules.test.ts`, `tests/rules-pr-routes.test.ts`. Check: the three suites pass, and a mutation that restores the section-only reading fails a test with the example body above.

## Notes (not blocking)

- **N1. No test pins the "Acceptance criteria" heading.** Turning `hasCriteria` back into "any mention" passes all 94 tests. Spec 3.1 rule 3 says heading. Add a case in each suite: a body that says "acceptance criteria" in prose with no heading, on a `src/` file, fails.
- **N2. `pr-rules` decides "ours" from the open list, not from the pull request.** `mine = open.some(p => p.number === n)`; if the list lags just after `opened`, rule 1 is skipped for that event and nothing is closed (later events still fail it, without closing). Bounded fix: own-ness from `ownBranchPrs([pr], repo)`, and add `pr` to `open` when missing.
- **N3. Two pull requests opened at the same moment with 2 open each see 3 others and both close.** Safe direction (reopen undoes it); record it.
- **N4. Client allowlist gaps seen at 6eee2e5** (within section 5's accepted incompleteness): `perl -e 'qx(gh pr create)'` and Ruby `%x()` are allowed (`qx`/`%x` not in `LAUNCHES_OR_REQUESTS`); `find . -exec /usr/bin/gh pr close 5 \;` is allowed (`RUNS_ARGS` matches only the bare word `gh`); a body file overwritten by `cp`/`mv`/`sed -i` earlier in the same command is not "written earlier". Pull request writes are still caught by `pr-rules`; repository-settings writes through these rely on the 3.7 rule alone. Optional: match a path ending in `/gh`, add `qx`/`%x`.
- **N5. Spec 3.6 as built refuses inline code too**, so any owner-facing message that names a pull request write in backticks (for example a report of a `gh pr ready` the session ran itself) is refused. That is what 3.6 says; expect it and report it if it bites.
- **N6. `env` is not refused** (3.4 lists it) per audit 10 N3; `env` is peeled and the `gh` after it fully judged. Name the deviation in the PR body.
- **N7. `tests/rules-merge-permission.test.ts` has a third changed line** (`as [Entry, Entry, Entry]`), beyond the two criterion 17 names; it is the type that goes with the length change. Name it in the PR body.

## What holds

- One library: lane-of-files, criteria, verdicts (with the `mcthaydt` filter), own-branch count, creation order and `onlyCleanMerges` live in `pr-rules-lib.mjs`, and `rules.mjs` no longer defines them.
- `pr-rules.mjs`: every list read to its last page; any failed read writes `failure` on the head it read; a plain issue's number (404) and a closed pull request write nothing; the clean-merge case passes only with the fetch of `refs/pull/<n>/head`, which is checked against the head sha.
- Hook: create through `gh api` (every field spelling, query and trailing slash, `{owner}/{repo}`) meets `checkPrCreate`; unreadable count refuses; body files not there yet or written earlier refuse with the own-call reason; PostToolUse reports writes only; create is fail-closed with its own blocking entry; loop keywords peeled so `gh` after `do` is judged.
- Cloud setup script and `--print-setup` untouched, as the spec chose (audit 9 R1 option a).

Reds by round: 1.
