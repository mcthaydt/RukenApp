# Implementation audit 1: ten pull requests open at once (#336)

**7cfaf24 PASS**

- Pull request #336, draft, head `7cfaf24` on `claude/project-thread-hyffd9`, base `main` at `c876bfe` (merge base `c876bfe`). Commits: `b8c6f59` (the change) and `7cfaf24` (live-state file removed).
- Against: spec `docs/superpowers/specs/2026-11-22-open-pr-limit-ten-design.md` section 2.2 and 2.3, plan audit 1 PASS at `fe0a7c1` (`2026-11-22-open-pr-limit-ten-1-plan-audit.md`).
- Lane 3 implementation audit, fresh session (it did not build the change), Opus 5.5, medium. Written 2026-11-22 17:54 UTC (`date`).
- Result: 0 red, 3 notes.

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## 1. The diff against the plan

`git diff --stat origin/main...7cfaf24`: 5 files, 6 insertions, 5 deletions. Each is a line the plan names, and nothing else changes.

| Spec 2.2 / 2.3 | On `7cfaf24` |
|---|---|
| `rules.json` `"maxOpenPrs": 10` | line 71: `"maxOpenPrs": 10,` |
| `pr-rules.mjs` `?? 6` → `?? 10` | line 71: `const max = f.maxOpenPrs ?? 10;` |
| CLAUDE.md "Pull requests open: 10." | line 79, the rest of the line unchanged |
| CLAUDE.md branches 11 at most | line 79: "`main` plus branches with an open pull request, 11 at most" |
| this-repo skill "the open limit of 10" | line 36 |
| progress.md owner instruction, dated | new History line, 2026-11-22 17:15 UTC, quotes "both" |
| progress.md active milestone line | line 79 updated |

Not changed, as spec 2.4 says: CLAUDE.md:80 and `staged-path/SKILL.md:24` (the 6 writers).

## 2. Checks run

On `7cfaf24` in this container:

- `pnpm exec vitest run tests/pr-rules.test.ts tests/rules-pr-routes.test.ts`: 62 of 62 pass. These read `MAX` from `rules.json`, so at 10 they prove 10 open refuses and 9 allows on every create route, forks never count, and on GitHub an eleventh is failed and closed (plan audit section 3).
- `pnpm test`: 132 files, 1948 of 1948 pass.
- `pnpm lint`: exits 0.
- Spec criterion 3: `maxOpenPrs` shows 10; "Pull requests open" shows 10; "11 at most" is on one line; `?? 10` is on one line; `grep -rnE "limit of 6|Pull requests open: 6|maxOpenPrs\": 6|7 at most" .claude CLAUDE.md` finds nothing.
- Spec criterion 2 (the one-number test fails by itself) was measured in plan audit 1 and the test is unchanged on `main` since (#335 changed only the fixture dates).
- `ruleMix`: the branch changes `CLAUDE.md` (a rules path) with `.claude/**` and `docs/**` files only, which the hook allows. Lane 3 is right.
- On GitHub at 17:54 UTC: `pr-rules` success ("every pull request rule holds"), `commit-authors` success; the quick draft run (`verify`, `postgres`, 6 browser pieces) still running. This audit does not cover CI; criterion 4 still needs it green.

## 3. progress.md read by eye (plan audit N3)

- The new History line (after 15:23 UTC) is dated, quotes the owner, names every place the number lives, keeps forks and docs-only counting as the owner's earlier cards said, records 7 → 11 branches and that the 6 writers stay, and names the spec, the plan audit and #335. Consistent with the 6-limit entry at line 58.
- Line 79 (active milestone): "The open pull request limit is 6 (#288, #289 merged); 10 on `claude/project-thread-hyffd9`." True now. See N1.
- Line 83's "#288 and #289 the open limit of 6" is history and correctly left alone.

## Notes (not blocking)

- **N1.** UNIT: `docs/superpowers/progress.md:79` and the new History line's last clause. VERDICT: note. REASON: both describe the state before the merge ("10 on `claude/project-thread-hyffd9`", "the number on `claude/project-thread-hyffd9`"); once #336 merges, `main` would say the limit is 6. EXPECTED: after the merge, line 79 reads "The open pull request limit is 10 (#336 merged)" and the History line ends "Done (#335, #336)", as line 58 does for 6. FIX: the coordinator's progress.md update at the merge (it keeps progress.md); only that file.
- **N2.** UNIT: `pr-rules.mjs:71`. VERDICT: note, carried from plan audit N2. REASON: the `?? 10` fallback has no test; it matters only if `maxOpenPrs` leaves `rules.json`.
- **N3.** UNIT: #336 body. VERDICT: note. REASON: the body ends with the proxy footer after "Requested by **McThayDT**". It is the exact `prBody.proxyFooter` in `rules.json:61`, which the hooks accept, and `pr-rules` passed. The "Commits" line says the reviewed commit is "to be named by the implementation audit": it is `7cfaf24` (or the fast-forward head carrying this file, which adds only this audit).
