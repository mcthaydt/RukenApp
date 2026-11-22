# Implementation audit 1: six pull requests open at once (#289)

Examined: `b315173` (head of #289), base `f55febe` (`main`, #288 merged). Spec: `docs/superpowers/specs/2026-11-22-open-pr-limit-six-design.md` (plan audit 1 PASS at `17e4463`). Lane 3. Auditor: Opus 5.5, medium, fresh session. Written 2026-11-22 02:02 UTC (`date -u`).

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## Verdict

**b315173 PASS**: 0 red, 3 notes.

## What the diff does (6 files, +6 −5)

| File | Change | Spec |
|---|---|---|
| `.claude/hooks/rules.json` | `"maxOpenPrs": 3` → `6` | 2.2 |
| `.claude/hooks/pr-rules.mjs:71` | `?? 3` → `?? 6` | 2.2 |
| `.claude/hooks/rules.mjs:967` | refusal names every open PR (`open.map`), not `open.slice(0, 5)` | not in 2.2; plan audit 1 note N1, disclosed in the PR body |
| `CLAUDE.md:79` | "Pull requests open: 6." and branches "7 at most" | 2.2, 2.3 |
| `.claude/skills/this-repo/SKILL.md:35` | "the open limit of 6" | 2.2 |
| `docs/superpowers/progress.md:58` | owner's 00:36 UTC instruction, dated and quoted | 2.2 |

## Acceptance criteria (spec section 3)

1. **PASS.** `pnpm test` on `b315173`: 121 files, 1780 tests passed, exit 0. The two hook files alone: 61 passed. `pnpm lint` exit 0.
2. **PASS, the check fails by itself.** Mutations on a scratch tree at `b315173`, each reverted after (`git status` clean):
   - CLAUDE.md at 3, `rules.json` at 6: `rules.json's maxOpenPrs is the number CLAUDE.md Settings states` fails (1 failed, 60 passed).
   - `rules.json` at 3, CLAUDE.md at 6: the same test fails (1 failed, 60 passed).
   The limit tests in `tests/pr-rules.test.ts` and `tests/rules-pr-routes.test.ts` read the number from `rules.json` (line 16 and line 162), so they ran at 6 here.
3. **PASS.** `rules.json:71` `"maxOpenPrs": 6`; `CLAUDE.md:79` "Pull requests open: 6."; `grep -rn "limit of 3" .claude CLAUDE.md` finds nothing. A wider grep for 3 or "three" beside an open-PR limit finds only `CLAUDE.md:80` (the writer cap, out of scope by spec 2.4), dated records in `progress.md:42` and past specs (records of their day, spec 2.4), and fork counts in test names.
4. **Open, not this audit's to give.** At 02:02 UTC CI on `b315173` was running: `pr-rules` success, `commit-authors` success, `verify`, `postgres` and browser shards in progress or queued. The merge waits for green.

## Nothing else in the rules changes

- `pr-rules.mjs`: the close comment (`f3(named)`, line 164) counts the PRs it names, and `named` is `others.slice(0, max)`, so at 6 it names 6. No other number tied to the limit.
- `.github/workflows/pr-rules.yml` is untouched and holds no number; it runs from `main`'s copy, so the new limit applies on GitHub once this merges (spec 2.4).
- Docs-only PRs still count and forks still do not: `ownBranchPrs` and the counting code are unchanged, and the cases stay covered by the tests above.
- The writer cap ("at most 3 writing code") and every other Settings line are unchanged.

## The owner's apps kit

The kit (https://mcthaydt.com/prompts/claude-md-apps/, read 2026-11-22) ships "Pull requests open: 3", branches "5 at most" and `"maxOpenPrs": 3`. Its Settings section says "Change a number or a model here and nowhere else", so a number the owner picks is a Settings change, not a departure from the workflow. The owner's request (2026-11-22 00:36 UTC, `progress.md:58`) is the approval for this lane 3 change. The branch limit 7 follows from it (spec 2.3: `main` plus 6). The kit's own refusal also uses `slice(0, 5)`; Ruken's now differs in naming every open PR, which changes only the message, never whether a create is refused.

## Notes (not blocking, follow-ups)

- **N1.** UNIT: `.claude/hooks/rules.mjs:967`. VERDICT: note. REQUIREMENT: "A check is a test that fails by itself" (CLAUDE.md). REASON: the refusal now lists every open PR, but no test asserts it. EVIDENCE: putting `open.slice(0, 5)` back leaves both hook test files at 61 passed. EXPECTED: with 6 of ours open, the refusal names all 6. FIX: a lane 1 test PR after this merges (the `ruleMix` hook keeps tests out of this one), touching only `tests/rules-pr-routes.test.ts`.
- **N2.** UNIT: `.claude/hooks/pr-rules.mjs:71`. VERDICT: note. REASON: the `?? 6` fallback is untested (plan audit N3). EVIDENCE: `?? 3` leaves 61 passed, since `rules.json` always sets the number. EXPECTED and FIX: none needed while `rules.json` holds `maxOpenPrs`; record only.
- **N3.** UNIT: CLAUDE.md Settings. VERDICT: note. REASON: real use may stay under 6, since at most 3 sessions write code and a writer usually holds one PR (plan audit N2). Docs and audit PRs can fill the rest. Record only; the writer cap is out of scope.

## CRUD

The change adds or touches nothing a user can make. No journey applies.
