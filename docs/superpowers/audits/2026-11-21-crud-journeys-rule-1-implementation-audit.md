# Implementation audit 1: the journeys create, read, update and delete everything a user can make

- Examined: PR #278, head `76537cd` (branch `claude/project-thread-hw0gcq`), diff against `main` at `020c029`: `CLAUDE.md`, `.claude/skills/build/SKILL.md`, `.claude/skills/review/SKILL.md` (3 insertions, 1 deletion). Brief: the merged spec `docs/superpowers/specs/2026-11-21-crud-journeys-rule-design.md` (#270), plan audits 1 and 2.
- Lane 3. Reviewer: fresh session, Opus 5.5, medium. Graphify not used: rules text, no code. Written 2026-11-21 20:04 UTC (from `date`).

**Verdict at `76537cd`: PASS, 0 red, 4 notes.**

## Acceptance criteria (spec section 3)

1. **PASS.** Each quoted sentence in spec 2.1 to 2.3 was read from the spec and found verbatim in the file at `76537cd` (`git show pr278:<file>`, substring match): CLAUDE.md:51, build SKILL.md:13, review SKILL.md:16. Each sits right after the anchor the spec names.
2. **PASS.** `git diff origin/main...76537cd --stat` lists only the three files. The live-state file is gone (removed in `76537cd`).
3. **Not judged here.** CI on `76537cd` was still running when this audit was written (verify, postgres and browser quick jobs queued or in progress). The builder reports the rule-hook tests 64/64 locally; I did not run `pnpm test` (no `node_modules` in this container). CI green is the merge gate.
4. **Outside this pull request, still open.** See N1.
5. This audit is the implementation audit; merge permission follows the lane rules.

## Does the wording enforce the owner's rule for every feature?

- Owner (14:20, 14:32 UTC): e2e tests cover all CRUD for everything in the app. CLAUDE.md now states it for "everything a user can make"; `build` widens that to "everything anyone can make in the product, staff included … anything they save", and requires each of create, read back where people see it, update, and delete or take off, checked in the running product. That covers every feature that holds something a person makes.
- Enforcement: `build` puts it in the quality bar every brief's criteria must cover, and makes the changing pull request bring the missing journeys. `review` makes each missing one red in lane 2 and 3 reviews and in plan audits. CLAUDE.md says a review or audit fails such a change.
- The only way out is an owner decision card recorded with its scope under "Kept on purpose" in `history.md`; a brief or reviewer cannot grant it. That matches CLAUDE.md's product-choice rule and "Each approval is recorded with its scope". The heading does not exist yet; spec 2.4 says the first such choice creates it, so that is expected.

## Conflicts with other CLAUDE.md lines

None that blocks. Checked against Keep to the request (line 44), Verification (51), Risk lanes (55 to 61), Audits by lane (81), Findings carry evidence. Notes N2 to N4 record the soft edges.

## Notes (not blocking)

- **N1. Spec criterion 4 is not tracked by the PR.** UNIT: PR #278 body. REQUIREMENT: spec criterion 4 (the owner's CLAUDE.md for apps gets the same three edits, with a before-copy) and "Report honestly: say what is still open". EVIDENCE: the PR body lists four criteria renumbered from the spec's five and drops criterion 4 without saying where it went; `/mnt/project-files/rules/message.md` holds no "create, read, update" or "Kept on purpose" text (grep count 0). Plan audit 2 N3 said to do it after the merge approval. Project memory also records the owner saying the shared apps kit lives in `mcthaydt/mcthaydt-website` (`content/prompts/claude-md-apps`, `claude-md-games`), which differs from the spec's `rules/message.md` reading. EXPECTED: the coordinator tracks criterion 4 as its own step after this merges, landing where the owner said. FIX: add one line to the PR body under the criteria ("Spec criterion 4, the apps-wide file, is done after this merges, in its own change"); no commit needed.
- **N2. Review line says "deletes it"; build says "delete it or take it off".** UNIT: review SKILL.md:16. A reviewer reading only the review line could mark a taken-off game red. It points to "CRUD in `build`", which settles it, so not red. A later rule batch could say "deletes it or takes it off".
- **N3. "A change that adds or changes something … brings the missing ones" vs "a second problem found on the way is reported, not fixed".** A small edit to an existing thing with old CRUD gaps now pulls those gaps into the same pull request. The rule says so on purpose and is the more specific line, so it wins; worth knowing for estimates. Existing gaps are being filled by the "Fill e2e CRUD test gaps" work (spec 2.4).
- **N4. Lane 1 changes get no review.** Audits by lane: lane 1 none, so the review-side check does not run on lane 1. A new user-made thing is almost never lane 1 (it touches `src/lib/`, `prisma/schema/` or a feature), and the `build` side still binds the builder, so no gap in practice.

## Commands run

- `git fetch origin pull/278/head:pr278 main`; `git diff origin/main...pr278 --stat` and full diff.
- Python substring check of the three spec quotes against `git show pr278:<file>`: True, True, True.
- `grep -c` on `rules/message.md` for the new text: 0.
- GitHub: PR #278 body and check runs at `76537cd`.
