# Plan audit 1: six pull requests open at once

- Pull request: mcthaydt/RukenApp #288 (part 1), head **17e4463** (17e4463d44afa86068c19ed90d5bfbee80bc6ae9)
- Spec: `docs/superpowers/specs/2026-11-22-open-pr-limit-six-design.md` at 17e4463
- Auditor: fresh session, Opus 5.5 medium. Written 2026-11-22 01:25 UTC (from `date`).
- Checked against: CLAUDE.md Settings and Risk, the owner's apps kit text (`/mnt/project-files/rules/message.md`, Settings lines 79 to 80 and the hook code), the owner's direction "lets bump to 6" (2026-11-22 00:36 UTC).

## Verdict: PASS. 0 red, 3 notes.

## What I checked, and what it showed

1. **Part 1's diff is what the spec says.** `git diff origin/main...17e4463` touches only the spec, `tests/pr-rules.test.ts` and `tests/rules-pr-routes.test.ts`. Same cases as before (at the limit refused or closed, one under allowed, reopened, forks and deleted forks not counted, docs-only counted, second page counted), with 3 replaced by `rules.json`'s `prFlow.maxOpenPrs`. Fork numbers moved to 101+ and offset 50 so they cannot collide with ours at 6.
2. **The tests fail by themselves.** Ran `vitest run tests/pr-rules.test.ts tests/rules-pr-routes.test.ts` on Node 22 after `pnpm install --frozen-lockfile`:
   - head as is (3 and 3): 61 passed.
   - `rules.json` at 6, CLAUDE.md at 3: 1 failed, the new "rules.json's maxOpenPrs is the number CLAUDE.md Settings states". (Spec criterion 2 holds.)
   - both at 6: 61 passed. (Part 2 will be green on these files.)
   - both at 6, `pr-rules.mjs` with the limit hard-coded to 3: 5 failed.
   - both at 6, `rules.mjs` create check hard-coded to 3: 3 failed.
   All edits reverted afterwards (`git status` clean).
3. **Part 2 delivers 6 with nothing left at 3.** `grep` over `.claude`, `CLAUDE.md`, `.github`, `progress.md`, `roadmap.md` at 17e4463 finds the number in exactly the places part 2 lists: `rules.json:71`, `pr-rules.mjs:71` (`?? 3`), `CLAUDE.md:79`, `this-repo/SKILL.md:35` ("the open limit of 3"). `rules.mjs` reads `f.maxOpenPrs` and has no literal 3; `pr-rules.yml` has no number. `progress.md:42` says "limit of 3" inside a dated owner record, which spec 2.4 rightly keeps as a record. `pr-rules.yml` runs main's copy, so GitHub enforces 6 from the moment part 2 merges, as the spec says.
4. **Part 2 can go through the hooks as one pull request.** `ruleMix` treats `.claude/**` as docs, so `rules.json`, `pr-rules.mjs`, the skill, CLAUDE.md and `progress.md` together carry rules plus docs only, no tests. The split in spec 2 is needed and correct: CLAUDE.md with tests in one push would be refused.
5. **The branch cap change is needed and correct.** CLAUDE.md:79 counts `main` plus branches with an open pull request, at most 5. With 6 open that is 7, so leaving 5 would hold the real limit at 4 and defeat the owner's 6. 7 is the smallest number that does not bind. No hook enforces it (grep finds no branch count in `rules.mjs` or `rules.json`). Changing a number in Settings is how CLAUDE.md says numbers change, so this does not contradict the kit.
6. **Lane.** Part 1 (tests outside `tests/support` and `tests/fixtures`, plus a spec) is lane 1; part 2 (CLAUDE.md and the hooks) is lane 3 and the spec says so, with its implementation audit in criterion 4.
7. **CI at 17e4463** when read (01:24 UTC): `pr-rules`, `commit-authors`, `verify (quick, draft)`, `what changed`, `which screens changed` succeeded; browser shards and postgres still running. This audit does not cover their outcome.

## Notes (not blocking)

- **N1. The client refusal names only 5 pull requests.** `rules.mjs:967` builds the refusal with `open.slice(0, 5)`. At 6 open it will say "6 are open now (#a, #b, #c, #d, #e)" and leave one out. Expected: it names all of them, as `pr-rules.mjs:90` does with `slice(0, max)`. Bounded fix for part 2: `open.slice(0, f.maxOpenPrs)`, with one assertion in `rules-pr-routes.test.ts` that the refusal names `MAX` numbers. That test would have to go in a separate tests pull request because of `ruleMix`, so it is fine to leave this as is.
- **N2. The writer cap may keep real use below 6.** CLAUDE.md:80 allows at most 3 sessions writing code, and "a writer waiting on a review or the owner keeps its writer place". If each writer holds one pull request, about 3 are open from writers. The other places get filled by spec, rule and progress pull requests, or by a writer holding two, like this change does. Spec 2.4 keeps the writer cap, which is right because the owner asked only for 6 pull requests. One sentence in 2.4 saying so plainly would stop anyone reading it as a contradiction. Raising the writer cap would be the owner's call.
- **N3. The `?? 6` fallback has no test.** No test removes `maxOpenPrs`, and `rules.mjs` treats a missing value as no limit, while `pr-rules.mjs` treats it as 3 (6 after part 2). This doesn't matter while `rules.json` sets the number, and it was already like this before. No action needed.
