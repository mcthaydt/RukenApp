# Plan audit 1: ten pull requests open at once

**fe0a7c1 PASS**

- Spec: `docs/superpowers/specs/2026-11-22-open-pr-limit-ten-design.md` on `claude/project-thread-hyffd9` at `fe0a7c1` (pull request 1's contents: the spec and the fixture fix). Merge base with `main`: `5f1e0c7` (current `origin/main`).
- Lane 3 plan audit, fresh session, Opus 5.5, medium. Written 2026-11-22 17:22 UTC (`date`).
- Result: 0 red, 4 notes.

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## 1. Every place the cap lives

Searched `.claude/`, `CLAUDE.md`, `.github/`, the two hook test files and `docs/superpowers/progress.md` on `fe0a7c1` for `maxOpenPrs`, `Pull requests open`, `7 at most`, `limit of 6`, `?? 6`, and the words 6/six/7/seven. The number is stated in exactly these places, and the spec's pull request 2 covers each:

| Place | Line on `fe0a7c1` | Spec 2.2 |
|---|---|---|
| `.claude/hooks/rules.json` `prFlow.maxOpenPrs` | 71: `"maxOpenPrs": 6` | yes |
| `.claude/hooks/pr-rules.mjs` fallback | 71: `f.maxOpenPrs ?? 6` | yes |
| `CLAUDE.md` Settings | 79: `Pull requests open: 6.` and `7 at most` | yes (2.2, 2.3) |
| `.claude/skills/this-repo/SKILL.md` | 36: `the open limit of 6` | yes |
| `docs/superpowers/progress.md` | owner instruction and milestone line | yes |

Not a copy of the number, so correctly left alone: `.claude/hooks/rules.mjs:963-967` reads `f.maxOpenPrs` and lists every open pull request (the earlier `slice(0,5)` note is gone); `.github/workflows/pr-rules.yml:10` and `pr-rules.mjs:6` say "the open limit" with no number; both test files read `MAX` from `rules.json`. `CLAUDE.md:80` and `staged-path/SKILL.md:24` ("6 writing code", "the 6 writers") are the writer limit, which the owner did not change (spec 2.4). `ci.yml`'s sixes are browser pieces. `progress.md:58` and `:82` are dated history.

## 2. The split and the `ruleMix` hook

`ruleMix` (`rules.mjs:861-866`, `rules.json` `ruleMix`) refuses a push whose diff against `main` has a rules path (`CLAUDE.md`, the shared skills, `.github/workflows/**`) together with anything outside `docs/**`, `*.md`, `**/*.md`, `.claude/**`.

- Pull request 1 (`git diff --stat origin/main...fe0a7c1`): `tests/rules-pr-routes.test.ts` and the spec. No rules path, so the hook does not apply. Lane 1 holds: a test and a doc.
- Pull request 2: `CLAUDE.md` (rules path) with `.claude/hooks/rules.json`, `.claude/hooks/pr-rules.mjs`, `.claude/skills/this-repo/SKILL.md` (all `.claude/**`) and `progress.md` (`docs/**`). Nothing falls outside the doc paths, so the push is allowed. Lane 3 is right (`CLAUDE.md` and the hooks).
- Putting the fixture with pull request 2 would be refused (`tests/` is product-side), so the order in the spec is the only one that works.

## 3. The tests prove the new cap

Run on `fe0a7c1` in this container (`pnpm exec vitest run tests/pr-rules.test.ts tests/rules-pr-routes.test.ts`), with the files restored after each step:

1. As committed, `rules.json` at 6: 62 of 62 pass. Full `pnpm test`: 132 files, 1948 of 1948 pass.
2. `rules.json` at 10, `CLAUDE.md` still 6: 1 failed, 61 passed, the failure being `rules.json's maxOpenPrs is the number CLAUDE.md Settings states`. Criterion 2 holds: the check fails by itself.
3. All of pull request 2 applied (`rules.json` 10, `CLAUDE.md` 10 and `11 at most`, `?? 10`): 62 of 62 pass. Criterion 1 holds.
4. `rules.json` at 10 with `main`'s old fixture (`n % 10`): `the refusal names every open pull request, not only the first few` fails (1 of 33), as the spec measured. The fixture change is what fixes it, and it changes only dates: `"2026-11-21T09:" + String(n % 60).padStart(2, "0")`, the same form as `tests/pr-rules.test.ts`.

Boundaries the tests reach with `MAX` read from `rules.json`: `MAX` open refuses and `MAX - 1` allows on every create route (`rules-pr-routes.test.ts:191-241`, `:347` for the MCP tool), forks never count (`:228-241`), and on GitHub `MAX + 1` is failed and closed while `MAX` passes (`pr-rules.test.ts:200-253`). So at 10 the tests prove 10 allowed and the eleventh refused, on both the client hook and the `pr-rules` check.

## 4. Nothing weakens another hook

The diff on `fe0a7c1` touches only the fixture's date string; no assertion, case or hook file changes. Pull request 2 changes one number and one fallback in the hooks; `ruleMix`, `prBody`, drafts, lane, criteria and the verdict check are untouched. Forks still never count and docs-only pull requests still count (`rules.mjs:961-962`, `pr-rules.mjs` step 1), as the owner's earlier cards say.

## Notes (not blocking)

- **N1.** UNIT: spec 2.2 / pull request 2's timing. VERDICT: note. REASON: `pr-rules.yml` runs `main`'s copy, so pull request 2 is itself judged against 6 until it merges. EVIDENCE: spec 2.4; 6 pull requests are open now (`gh api repos/mcthaydt/RukenApp/pulls?state=open`, 17:22 UTC), so pull request 1 cannot open yet either. EXPECTED: pull request 1 and then pull request 2 each open only while fewer than 6 are open. FIX: none in the spec; the coordinator times the opens.
- **N2.** UNIT: `.claude/hooks/pr-rules.mjs:71`. VERDICT: note (carried from the six-limit audit, N3). REASON: the `?? 10` fallback has no test; it only matters if `maxOpenPrs` is removed from `rules.json`. FIX: none here.
- **N3.** UNIT: spec criterion 3. VERDICT: note. REASON: the grep for stale numbers covers `.claude` and `CLAUDE.md` but not `docs/superpowers/progress.md`; its active lines are named in 2.2, so the implementation audit should read them by eye.
- **N4.** UNIT: spec 2.4. VERDICT: note. REASON: with 6 writers and 5 sessions at once, 10 open pull requests are reachable only with 4 or more that are specs, audits or docs, or writers waiting on review. The spec says so; recorded so nobody reads 10 as a target.
