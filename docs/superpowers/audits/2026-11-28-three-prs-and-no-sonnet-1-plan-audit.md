# Plan audit 1: three pull requests from slice 4, and no Sonnet

- Examined: RukenApp #455, branch `claude/project-thread-rayryy`, commit 223ba23 (spec `docs/superpowers/specs/2026-11-28-three-prs-and-no-sonnet-design.md`).
- Reviewer: fresh session, Opus 5.5, medium, read-only. Written 2026-11-28 08:14 UTC.
- Brief: the owner's two messages, 2026-11-28 08:10 UTC "We go back to 3 for next slice" and 08:11 UTC "And we drop sonnet".

**Verdict: PASS. 0 red, 3 notes.**

## What was checked

1. **Sonnet appears nowhere else live.** `git grep -ni sonnet` over the whole tree at 223ba23, leaving out past specs, plans and audits, finds only `CLAUDE.md:85` (the Settings line the spec changes), `docs/superpowers/progress.md:32` (a dated 2026-11-21 record, "not Sonnet") and the spec's own live file. No skill, hook, script, workflow or test names it. The hooks' only model list (`rules.json` sessionTools `models`) is Haiku for read-only helpers. Spec 2.3 is right.
2. **The 10 stays during slice 3.** `tests/rules-pr-routes.test.ts:500-502` reads `/^- Pull requests open: (\d+)\./m` from CLAUDE.md and compares it to `rules.json` `prFlow.maxOpenPrs` (78: 10). Keeping "Pull requests open: 10." as the line's start keeps that test green; `tests/pr-rules.test.ts:16-19` reads the number from `rules.json`, so it follows any later change. `pr-rules.mjs:71` and `rules.mjs:964-968` read `maxOpenPrs`; no other copy of the number exists.
3. **Deferring the switch is the right call.** Open pull requests read from GitHub at 08:14 UTC: #447, #451, #452, #453, #454, #455 (5 besides #455, as the spec says). Setting `maxOpenPrs` to 3 now would refuse every new pull request in slice 3, which the owner did not ask for ("for next slice").
4. **Branches 4 from slice 4.** CLAUDE.md:80 defines branches as `main` plus branches with an open pull request, so 3 open gives 4. It follows from the owner's ask; it adds nothing.
5. **Models line.** CLAUDE.md:85 "Execution and fixes against a spec: Sonnet 5.5, medium, then high." becomes Opus 5.5, medium, then high. The "Medium, then high" sentence and the stuck-task ladder ("the next model up") still read correctly, since Opus 5.5 is below no other build model named there.
6. **Scope.** Files touched: CLAUDE.md, progress.md, the spec, audits. No code, test, hook or dependency. `ruleMix` allows CLAUDE.md with docs (`rules.mjs:861-866`). Lane 3 is right (CLAUDE.md is a rules file). One branch for spec and change is reasonable for three lines.
7. **Acceptance criteria** are all program-checkable greps, a diff list and the two test files, plus the audits. They cover both owner asks.

## Notes (not blocking)

1. **Word the slice 4 step so it cannot be read as "the first feature pull request".** UNIT: CLAUDE.md Settings line, spec 2.1. REASON: "the first pull request of slice 4 sets this number" could be read as slice 4's first feature PR; `ruleMix` (`rules.mjs:862-866`) refuses a branch that changes CLAUDE.md together with code or tests. EXPECTED: the line says "in its own rules pull request at the start of slice 4" (or similar). FIX: wording only, CLAUDE.md.
2. **Who remembers the switch.** The CLAUDE.md line itself is the reminder, which every session reads, and the coordinator's queue holds it. Enough; no extra file needed.
3. **Writers stay at 6 with 3 open pull requests.** Not asked by the owner, so rightly unchanged (spec 2.3). Recorded only.

## Next

The implementer writes the change as the second commit on `claude/project-thread-rayryy`; the implementation audit reads that head.
