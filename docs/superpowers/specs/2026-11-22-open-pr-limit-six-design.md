# Six pull requests open at once

Date: 2026-11-22. Status: **spec, waiting on its plan audit.** Lane 3 (it changes `CLAUDE.md` Settings and the hooks every session runs).

Lines marked **Owner** are the owner's words. Lines marked **Call** are this spec's choices; the owner can overrule any of them.

## 0. The owner's direction

- **Owner, 2026-11-22 00:36 UTC:** "lets bump to 6". The limit on open pull requests from this repo's own branches goes from 3 to 6.
- Unchanged, by the owner's earlier cards (2026-11-21 14:48 and 15:00 UTC, `progress.md`): docs-only pull requests still count, and pull requests from forks still never count and are never closed.

## 1. The outcome

Six pull requests from this repo's own branches can be open at once; a seventh is refused by the client hook (`.claude/hooks/rules.mjs`) on every create route and failed and closed by the `pr-rules` check on GitHub. The number lives in one place for the hooks (`rules.json`, `prFlow.maxOpenPrs`) and one place for the rules (`CLAUDE.md`, Settings), and a test fails when the two differ.

## 2. The change: two pull requests, in this order

The `ruleMix` hook refuses a push that carries rules files (`CLAUDE.md`) together with tests, and the hook tests read the real `rules.json`, so the number and the tests cannot change in one pull request.

### 2.1 Pull request 1 (lane 1: tests and this spec)

- `tests/pr-rules.test.ts` and `tests/rules-pr-routes.test.ts` read the limit from `rules.json` instead of writing 3, so they pass at 3 today and at 6 after 2.2, with the same cases (at the limit refused or closed, one under allowed, forks and deleted forks not counted, docs-only counted, the second page counted).
- A new test in `tests/rules-pr-routes.test.ts`: `rules.json`'s `maxOpenPrs` equals the number on CLAUDE.md's "Pull requests open: N." line.
- This spec.

### 2.2 Pull request 2 (lane 3: the number)

- `.claude/hooks/rules.json`: `"maxOpenPrs": 6`.
- `.claude/hooks/pr-rules.mjs`: the fallback when `maxOpenPrs` is missing, `?? 3`, becomes `?? 6`.
- `CLAUDE.md`, Settings: "Pull requests open: 6." and the branch limit (see 2.3).
- `.claude/skills/this-repo/SKILL.md`: "the open limit of 6".
- `docs/superpowers/progress.md`: the owner's instruction, dated.

### 2.3 The branch limit

- **Call:** CLAUDE.md Settings also says "Branches: `main` plus branches with an open pull request, 5 at most". With 6 open that is 7, so the 5 would hold the real limit at 4 and defeat the owner's 6. It becomes 7. No hook enforces it.

### 2.4 Not changed

- Past specs and audits that say "3" are records of their day and stay as written.
- "Work sessions at once: 5 … at most 3 writing code" is a different limit and stays.
- `pr-rules.yml` runs from `main`'s copy, so the new number takes effect on GitHub when 2.2 merges.

## 3. Acceptance criteria

1. `pnpm test` exits 0 on pull request 1's head with `rules.json` at 3, and on pull request 2's head with it at 6.
2. With `rules.json` at 6 and CLAUDE.md still at 3, the new test fails (it is a check that fails by itself).
3. On pull request 2's head, `grep -n "maxOpenPrs" .claude/hooks/rules.json` shows 6, `grep -n "Pull requests open" CLAUDE.md` shows 6, and `grep -rn "limit of 3" .claude CLAUDE.md` finds nothing.
4. CI is green on both pull requests; pull request 2 has its implementation audit PASS on its head.

## 4. Boundaries

No new dependency, tool, environment or spend. Expected duration: about an hour, most of it audits and CI.
