# Ten pull requests open at once

Date: 2026-11-22. Status: **spec, waiting on its plan audit.** Lane 3 (it changes `CLAUDE.md` Settings and the hooks every session runs).

Lines marked **Owner** are the owner's words. Lines marked **Call** are this spec's choices; the owner can overrule any of them.

## 0. The owner's direction

- **Owner, 2026-11-22 17:15 UTC:** "both", answering whether to raise the open pull request limit to 10 (and, separately, to push the learned feed's clean branch, which is not this spec). The limit on open pull requests from this repo's own branches goes from 6 to 10.
- Unchanged, by the owner's earlier cards (2026-11-21 14:48 and 15:00 UTC, `progress.md`): docs-only pull requests still count, and pull requests from forks still never count and are never closed.

## 1. The outcome

Ten pull requests from this repo's own branches can be open at once; an eleventh is refused by the client hook (`.claude/hooks/rules.mjs`) on every create route and failed and closed by the `pr-rules` check on GitHub. The number stays in one place for the hooks (`rules.json`, `prFlow.maxOpenPrs`) and one for the rules (`CLAUDE.md`, Settings), and the existing test `rules.json's maxOpenPrs is the number CLAUDE.md Settings states` (`tests/rules-pr-routes.test.ts`) fails when the two differ.

## 2. The change: two pull requests, in this order

The hook tests (`tests/pr-rules.test.ts`, `tests/rules-pr-routes.test.ts`) read the limit from `rules.json` since the six-limit change (#288). But at 10, one case fails: `the refusal names every open pull request, not only the first few` expects `#1 … #10` in order, and the hook lists them by creation time, while the fixture `pr()` in `tests/rules-pr-routes.test.ts` dates pull request n at minute `n % 10`, so #10 is dated 09:00, before #1 (measured: with only the number at 10, 1 failed, 61 passed). The `ruleMix` hook refuses rules files (`CLAUDE.md`) together with tests, so the fixture fix goes first, on its own.

### 2.1 Pull request 1 (lane 1: the test fixture and this spec)

- `tests/rules-pr-routes.test.ts`, `pr()`: the minute is `n % 60`, two digits, as `tests/pr-rules.test.ts` already does, so pull requests 1 to 59 are dated in number order. Same cases, same assertions; only the fixture's dates change.
- This spec.

### 2.2 Pull request 2 (lane 3: the number), from `main` after 2.1 merges

- `.claude/hooks/rules.json`: `"maxOpenPrs": 10`.
- `.claude/hooks/pr-rules.mjs`: the fallback when `maxOpenPrs` is missing, `?? 6`, becomes `?? 10`.
- `CLAUDE.md`, Settings: "Pull requests open: 10." and the branch limit (2.3).
- `.claude/skills/this-repo/SKILL.md`: "the open limit of 10".
- `docs/superpowers/progress.md`: the owner's instruction, dated, and the active milestone's line.

### 2.3 The branch limit

- **Call:** "Branches: `main` plus branches with an open pull request, 7 at most" would hold the real limit at 6. It becomes 11 (`main` plus 10). No hook enforces it.

### 2.4 Not changed

- "Work sessions at once: 5 … at most 6 writing code" is a different limit and stays; the owner asked only for the pull request limit. With 6 writers, the other 4 places are for specs, audits and docs pull requests, which are not writers.
- Past specs and audits that say 3 or 6 are records of their day.
- `pr-rules.yml` runs from `main`'s copy, so the new number takes effect on GitHub when this merges.

## 3. Acceptance criteria

1. `pnpm test` exits 0 on pull request 1's head with `rules.json` at 6, and on pull request 2's head with it at 10. On pull request 1's head with pull request 2's changes applied on top, `tests/pr-rules.test.ts` and `tests/rules-pr-routes.test.ts` pass (62 of 62).
2. With `rules.json` at 10 and CLAUDE.md at 6, `rules.json's maxOpenPrs is the number CLAUDE.md Settings states` fails (the check fails by itself).
3. On the head, `grep -n "maxOpenPrs" .claude/hooks/rules.json` shows 10, `grep -n "Pull requests open" CLAUDE.md` shows 10, `grep -n "11 at most" CLAUDE.md` finds one line, `grep -n "?? 10" .claude/hooks/pr-rules.mjs` finds one line, and `grep -rnE "limit of 6|Pull requests open: 6|maxOpenPrs\": 6|7 at most" .claude CLAUDE.md` finds nothing.
4. CI is green on both pull requests; the plan audit PASSes on pull request 1, and the implementation audit PASSes on pull request 2's head.

## 4. Boundaries

No new dependency, tool, environment or spend. Expected duration: about an hour, most of it audits and CI.
