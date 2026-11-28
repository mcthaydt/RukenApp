# Implementation audit 1: three pull requests from slice 4, and no Sonnet

- Examined: RukenApp #455, branch `claude/project-thread-rayryy`, head bb8be2e (full bb8be2e9c043ebae29e74cce77f778db768d2874), against `main` 19045c3 (included in the head).
- Plan: spec `docs/superpowers/specs/2026-11-28-three-prs-and-no-sonnet-design.md`, plan audit 1 PASS at 223ba23 (e996147 on `claude/project-thread-jtklg1`).
- Reviewer: fresh session, Opus 5.5, medium. Written 2026-11-28 08:21 UTC.
- Brief: the owner's 2026-11-28 08:10 UTC "We go back to 3 for next slice" and 08:11 UTC "And we drop sonnet".

**Verdict: PASS. 0 red, 2 notes.**

## What was checked

1. **The diff is the plan and nothing else.** `git diff --stat origin/main...bb8be2e`: `CLAUDE.md` (2 lines changed), `docs/superpowers/progress.md` (+2), the spec (+48). The spec-to-change commit (`git diff 223ba23 bb8be2e`) touches only `CLAUDE.md`, `progress.md` and deletes the live file `docs/superpowers/live/claude-project-thread-rayryy.md`, which is absent at the head (`git ls-tree` empty). No code, test, hook, `rules.json` or skill changes, as spec 2.3 says.
2. **Pull requests line (spec 2.1, criterion 3).** CLAUDE.md:80 still starts "- Pull requests open: 10." (one match), says 3 from slice 4 (Pages), and that "a rules pull request of its own at the start of slice 4" sets this number and `prFlow.maxOpenPrs` in `.claude/hooks/rules.json` to 3 together. That is the plan audit's note 1 wording. `rules.json:78` stays `"maxOpenPrs": 10`, matching. Branches: "11 at most in slice 3, 4 from slice 4" (one match for "4 from slice 4"), which is `main` plus 3.
3. **Models line (spec 2.1, criterion 2).** CLAUDE.md:85 reads "Execution and fixes against a spec: Opus 5.5, medium, then high." (one match). The rest of the line is byte-identical to `main`.
4. **No Sonnet left (criterion 1).** `grep -rniI sonnet CLAUDE.md .claude .github` at the head: no match (exit 1). There is no `scripts/` folder. Outside past specs, plans and audits, the whole tree's only matches are `progress.md:32` (a 2026-11-21 record, "not Sonnet") and `progress.md:103` (the new owner entry saying Sonnet is dropped): records, not rules.
5. **progress.md (spec 2.2).** Two entries under the owner's instructions, dated 08:10 and 08:11 UTC, quoting the owner word for word, naming the spec, the plan audit and the branch.
6. **Rules tests (criterion 5).** `pnpm install --frozen-lockfile` then `pnpm test -- tests/rules-pr-routes.test.ts tests/pr-rules.test.ts` at bb8be2e: the runner ran the whole unit suite, 170 files, 2454 tests passed, exit 0, both named files included.
7. **CI on the head.** Check runs on bb8be2e at 08:21 UTC: commit-authors, pr-rules-run, verify, gate, postgres and browser shards 1 to 6 all success; "record the journeys' times" skipped. These are the draft (quick) runs.
8. **Commits.** Both authored McThayDT <107786093+mcthaydt@users.noreply.github.com>, no co-author, session trailer or "Generated with" line.
9. **PR body.** Starts with the attribution comment and "_Requested by **McThayDT** · [project thread](…)_", has "## Lane" (lane 3, standing permission of 2026-11-21) and "## Acceptance criteria" (six, matching the spec), and its last line is "Requested by **McThayDT**". No other unit's lane is named.

## Notes (not blocking)

1. **The spec's status line is stale.** It still says "spec, waiting on its plan audit" though that audit passed. A record only; it changes nothing a session does.
2. **CI ran in draft (quick) mode.** If `release` needs the full run before the merge, the merging session marks #455 ready and watches that run; that run's result, not this audit, is the green the merge names.

## Next

Merge #455 under the 2026-11-21 standing permission once its required checks are green, with a merge commit at full SHA bb8be2e9c043ebae29e74cce77f778db768d2874. A push after bb8be2e makes this audit stale.
