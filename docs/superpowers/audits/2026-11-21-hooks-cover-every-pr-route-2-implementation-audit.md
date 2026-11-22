**66fe43d PASS**

# Implementation audit 2: hooks cover every PR route (PR-H)

Examined: mcthaydt/RukenApp, branch `claude/project-thread-c0wy83`, head 66fe43d (one commit on top of 6eee2e5, the commit audit 1 failed). Spec: `docs/superpowers/specs/2026-11-21-hooks-cover-every-pr-route-design.md`. Written 2026-11-21 17:07 UTC. Read only: nothing pushed, no pull request comment (no PR is open).

## What ran (on 66fe43d)

- `pnpm lint` exit 0, `pnpm typecheck` exit 0, `pnpm test` 119 files, 1748 tests pass (1749 at 6eee2e5, minus the 3 removed narrow tests, plus 2 new).
- Diff 6eee2e5..66fe43d: 4 files, +15 -72: `.claude/hooks/pr-rules-lib.mjs`, `.claude/hooks/rules.mjs` (one message), `tests/pr-rules.test.ts`, `tests/rules-pr-routes.test.ts`. Nothing else moved.
- Mutation checks against the three suites (93 tests; baseline 93 pass):

| Break | Caught by |
|---|---|
| put back 6eee2e5's section-only `laneOf` (whole lib file) | 1 test |
| `laneOf` takes the lowest lane | 1 |
| `hasCriteria` back to any mention | 1 (was 0 at 6eee2e5) |
| forks counted as own (`ownBranchPrs` returns all) | 6 |

## R1 from audit 1: fixed

- `laneOf` in `pr-rules-lib.mjs` is now `matchAll(/\blane\s*([123])\b/gi)` over the whole body, highest wins, null when none: the same regex and logic as `main`'s `laneOf` (main `rules.mjs` 883-884). `laneSection`, `FENCE` and `HEADING` are gone from the library; the fence check left in `rules.mjs` (line ~1277) belongs to the 3.6 inline-code rule, not the lane.
- Both callers use it: hook `checkPrCreate` (`rules.mjs` 954) and merge/ready (996), and `pr-rules.mjs` 103.
- The three prose tests that pinned the narrow reading are removed. New test "the highest lane named anywhere in the body wins": body `## Lane\nLane 1\n\n## Why\nlane 3 would need the owner` on `docs/a.md` fails with "no passing review". Putting back the section-only reader fails it (table above), which is the check audit 1 asked for.
- `checkPrCreate`'s refusal text no longer says the lane is read only from the section.

## Audit 1 N1: fixed

New test "the criteria need an Acceptance criteria heading, not only the words": prose "acceptance criteria" with no heading on a `src/` file fails; with `## Acceptance criteria` it passes. Mutation now caught.

## New holes

None found. The change only deletes code and reverts to `main`'s reading; the only new code is two tests.

## Owner decisions still hold

- Only the exact proxy footer is ignored: `stripFooter` (`rules.mjs` 882-888) takes off `prBody.proxyFooter` only when it is the whole body or the exact last block; unchanged since audit 1, which mutation-checked it.
- Docs-only pull requests count: no docs exemption in the open-limit code (`pr-rules.mjs` 74-75, `rules.mjs` 961-966); `onlyRulesAndDocs` is gone.
- Only same-repo pull requests count, forks never counted or closed: `ownBranchPrs` filters on `head.repo.full_name` equal to the repo, a deleted fork (null) never counts; 6 tests fail when it is broken.

## Notes (not blocking)

- **N1 (new). The two new tests live only in `tests/pr-rules.test.ts`.** The hook uses the same library functions, so a break in them is still caught, but a hook caller that stopped using `laneOf`/`hasCriteria` from the library would only be caught by the "one library" test. Optional: one hook-side case each in `tests/rules-pr-routes.test.ts`.
- **N2 (audit 1 N5, judged). The hook refuses owner-facing text that names a pull request write in backticks.** Acceptable: it is what spec 3.6 says, it fails closed, and a report can name the action in plain words ("I marked it ready"). It should be named in the PR body so nobody routes around it; if it proves a real burden, changing it is a rules change for the owner.
- Audit 1 notes N2 (`mine` from the open list), N3 (two simultaneous opens both close), N4 (perl `qx`, Ruby `%x`, path-qualified `/usr/bin/gh` in `find -exec`, body file rewritten by `cp`/`mv`/`sed -i`), N6 (`env` peeled, not refused; name the deviation in the PR body) and N7 (third changed line in `tests/rules-merge-permission.test.ts`; name it in the PR body) carry over unchanged.

## Verdict

66fe43d PASS: 0 red, 2 notes plus 5 carried. The PR body should name N2, N6 and N7.

Reds by round: 1, 0.
