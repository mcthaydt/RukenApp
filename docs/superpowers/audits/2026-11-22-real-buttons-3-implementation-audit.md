**465f463 PASS**

# Real buttons, not underlined words: lane 2 re-check, round 3

- Commit examined: `465f4636a617105a00061350470eaac2372d059e` (PR #345 head), on `claude/project-thread-p6zxug`. It merges main `c80ab01` into the round 2 tree (`68bf338`, conflicts in `src/routes/me/+page.svelte`, `tests/browser/make-second-look.test.ts`, `docs/superpowers/progress.md`) and then the round 2 audit commit `3f5d682`.
- Reviewer: a fresh session, Opus 5.5, medium.
- Scope: round 2's R2, the screens main brought in (privacy, terms, Your computers, link a computer), the three hand-resolved conflicts, the journey, the PR body, and CI on this head. The round 1 and 2 results stand for files this merge does not touch.

## What ran, at 465f463

| Check | Result |
| --- | --- |
| CI `verify (quick, draft)` (lint, typecheck, unit) | success |
| CI `postgres (quick, draft)` | success |
| CI `browser shard 1` to `6 of 6 (quick, draft)` | all 6 success |
| CI `gate (quick, draft)` | success |
| CI `commit-authors` | success |
| CI `pr-rules-run` (two runs) | **failure**: "the body names no lane (add a "## Lane" section that says "Lane 1", "Lane 2" or "Lane 3")" |
| Local runs | Not run: this container has no Postgres and no `node_modules`; CI ran the suites on this exact commit. |

## R2, the repo rule line

**Fixed.** `.claude/skills/this-repo/SKILL.md` line 57 lists "Back, Change, Up, Down, Remove and Close" as icons, says a target is "at least 44px wide and tall (a row of them may stretch wider)", and says Show and Hide on Your links keep their words because an eye reads as the link's state. That matches `src/lib/icon.svelte` (no `show` or `hide`) and `src/routes/make/page/links/+page.svelte`. The PR body names the edit and its lane.

## Screens from main

- `/privacy`: both "Back to Ruken" and "Read the terms" are `a.quiet`. In the journey through `CARD_SCREENS` ("privacy" in `tests/browser/support/look.ts`), which `real-buttons.test.ts` runs through `expectRealButtons` (no underline anywhere, painted, at least 44px).
- `/terms`: "Back to Ruken", "Read the maker agreement" and "Read what we keep about you" are `a.quiet`. In `CARD_SCREENS` ("terms").
- `/me/computers`: "Back to your account" is `a.quiet`. Added to the account test at `real-buttons.test.ts:143`.
- `/me` (conflict): "Your computers" and "Delete my account" are both `a.quiet`; the resolution keeps main's new Your computers line and the branch's class. Correct.
- `/me/link`: "See your computers", "Your computers" (too many) and "Back to your account" are `a.quiet`. Not in the journey (note N1).
- Icon-only where clear: "Back to Ruken" and "Back to your account" keep words, the same as the already-reviewed `/help`, `/forgot-password` and `/me/password`; the Back icon is used where it sits beside a forward button. Consistent with the rule.
- No underlined text link: every new `<a>` in these screens carries `.quiet`, and the journey's page-wide underline check covers privacy, terms and Your computers.

## Other conflicts

- `make-second-look.test.ts`: keeps main's failure diagnostics (`layout`) and the branch's `:scope > .ways` selector. Correct; CI shards passed.
- `progress.md`: keeps both main's #323 row and the branch's real-buttons row and owner-quote line. Correct.

## PR body

- Last line is "Requested by **McThayDT**"; no "Generated with Claude Code" line. Correct.
- It names the lane as `**Lane:** 2` inside "What and why", with no `## Lane` heading, so `pr-rules-run` fails (B1).

### B1 (blocks the merge, not this commit)

- **UNIT:** PR #345 body.
- **VERDICT:** red for the merge; the commit is unaffected.
- **REQUIREMENT:** `.claude/hooks/pr-rules.mjs` line 104, run as the `pr-rules-run` check; merges need green.
- **REASON:** the body has no `## Lane` section.
- **EVIDENCE:** job 137335208139 log: `##[error]the body names no lane (add a "## Lane" section that says "Lane 1", "Lane 2" or "Lane 3")`.
- **EXPECTED:** `pr-rules-run` green on 465f463.
- **FIX:** edit the PR body through a hook-checked route to add a `## Lane` section saying "Lane 2", keep the last line "Requested by **McThayDT**", and re-run `pr-rules-run`. The body only; no commit. A body edit does not change the commit this audit names, so this PASS stays valid; the green re-run is the check.

## Notes (not fixed here)

- **N1:** `/me/link` is not walked by `real-buttons.test.ts`. Its three links use the same `.quiet` class the journey checks elsewhere, so the risk is low; a later change could add it through the link helper in `tests/browser/support/computers.ts`.
- **N2:** the PR branch merged the round 2 audit commit `3f5d682` (`465f463` is that merge). Audit files are lane 1 docs and land on main with the PR as earlier rounds did; recorded only.

## Verdict

**465f463 PASS.** R2 is fixed, the screens main brought in have real buttons with no underline, Your computers is in the journey, and every code check in CI is green. Before the merge, B1 (the PR body's missing `## Lane` section) must be fixed and `pr-rules-run` re-run green.
