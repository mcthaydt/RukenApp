# Three pull requests from slice 4, and no Sonnet

Date: 2026-11-28. Status: **spec, waiting on its plan audit.** Lane 3 (it changes `CLAUDE.md` Settings, a rules file).

Lines marked **Owner** are the owner's words. Lines marked **Call** are this spec's choices; the owner can overrule any of them.

## 0. The owner's direction

- **Owner, 2026-11-28 08:10 UTC:** "We go back to 3 for next slice". The open pull request limit goes back to 3 from slice 4 (Pages); slice 3 keeps 10.
- **Owner, 2026-11-28 08:11 UTC:** "And we drop sonnet". No session runs on Sonnet 5.5.

## 1. The outcome

`CLAUDE.md` Settings says, in one place each: the open pull request limit is 10 until slice 3 ends and 3 from slice 4 on, with the branch limit to match; and execution and fixes against a spec run on Opus 5.5, medium, then high. No rule, skill or hook names Sonnet.

## 2. The change: one pull request, two commits

This spec is the first commit; the plan audit reads it. The change is the second commit, on the same branch; the implementation audit reads that. **Call:** one branch instead of a spec pull request and then a build pull request, because the build is three lines of one file and no test or code changes, so a second CI cycle buys nothing.

### 2.1 `CLAUDE.md`, Settings

- "Pull requests open: 10." keeps its number, so `rules.json`'s `maxOpenPrs` (10) still matches and the test `rules.json's maxOpenPrs is the number CLAUDE.md Settings states` (`tests/rules-pr-routes.test.ts`, which reads the first number after "Pull requests open:") stays green. The line gains: from slice 4 (Pages) on, the limit is 3, and the first pull request of slice 4 sets this number and `prFlow.maxOpenPrs` in `.claude/hooks/rules.json` to 3 together, as a lane 3 rules change.
- **Call:** the switch is written as a step for slice 4's start, not made now. Setting `maxOpenPrs` to 3 today would refuse new pull requests while slice 3 has 5 open (#447, #451, #452, #453, #454, read from GitHub 2026-11-28 08:12 UTC), which the owner did not ask for.
- Branches: "11 at most" becomes "11 at most in slice 3, 4 from slice 4" (`main` plus 3). No hook enforces it.
- Models and effort: "Execution and fixes against a spec: Sonnet 5.5, medium, then high." becomes "Opus 5.5, medium, then high."

### 2.2 `docs/superpowers/progress.md`

- The two owner instructions, dated and quoted, under "The owner's instructions" (the coordinator cannot write to the repo; this session writes them for it).

### 2.3 Not changed

- `rules.json`, `pr-rules.mjs`, the tests and every skill: none names Sonnet (`grep -rni sonnet .claude CLAUDE.md` finds only the Settings line), and the number stays 10 until slice 4.
- "Work sessions at once: 5 … at most 6 writing code" stays; the owner named only the pull request limit.
- Past specs, audits and progress entries that name Sonnet or other limits are records of their day.

## 3. Acceptance criteria

1. `grep -rni sonnet CLAUDE.md .claude` finds nothing on the head.
2. `grep -n "Execution and fixes against a spec: Opus 5.5, medium, then high" CLAUDE.md` finds one line.
3. `grep -n "^- Pull requests open: 10\." CLAUDE.md` finds one line, and the same line says 3 from slice 4 and names `maxOpenPrs`; `grep -n "4 from slice 4" CLAUDE.md` finds the branch limit.
4. `git diff origin/main --stat` on the head touches only `CLAUDE.md`, `docs/superpowers/progress.md`, this spec and the audit files.
5. `pnpm test -- tests/rules-pr-routes.test.ts tests/pr-rules.test.ts` exits 0, and CI is green on the head.
6. The plan audit PASSes on this spec's commit, and the implementation audit PASSes on the change's head.

## 4. Boundaries

No new dependency, tool, environment or spend. Expected duration: about an hour, most of it audits and CI.
