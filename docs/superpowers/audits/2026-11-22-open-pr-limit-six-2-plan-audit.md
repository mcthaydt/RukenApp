# Open PR limit six, plan audit 2: the six-writers addendum

Examined: spec `docs/superpowers/specs/2026-11-22-open-pr-limit-six-design.md` section 5, at 9c03d77 (PR #291), main b17eaca. Session: lane 3 audit, Opus 5.5 medium. Same session as implementation audit 2; the PR body records the owner's fast-track (one fresh audit for addendum and change).

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## Verdict

9c03d77 PASS: 0 red, 3 notes.

## What was checked

- Authority: the owner's "Yes" (2026-11-22 02:06 UTC) is quoted in section 5 and in `progress.md` History, and matches the project memory record of the same time. It covers 3 to 6 writers only; section 5 changes nothing else.
- Lane: CLAUDE.md and the shared `staged-path` skill are lane 3 (CLAUDE.md, Risk). Section 5 says lane 3.
- Scope: the addendum names three edits (CLAUDE.md Settings, `staged-path`, `progress.md`); the diff touches exactly those plus the spec. No hook counts writers (`grep -rn "writ" .claude/hooks` finds no writer count), so "nothing else moves" holds.
- Criteria: each is a command a program can judge (grep counts, CI, verdict line).
- Kit: the owner's apps kit (https://mcthaydt.com/prompts/claude-md-apps/) Settings say "Work sessions at once: 5, ... at most 3 writing code" and "Pull requests open: 3", under "Change a number or a model here and nowhere else." Ruken changes the number in Settings and the one skill sentence that repeats it, as the kit's single-source rule asks. The kit's structure (writers inside the session sentence, the waiting-writer clause) is kept word for word.

## The 5 sessions and 6 writers question

Not a contradiction. The Settings sentence already says "A writer waiting on a review or the owner keeps its writer place but not one of the 5." So:

- Writers actively working, plus reviewers and every other work session, are at most 5 at once.
- Writer places are at most 6. The sixth place fills only while at least one writer waits on a review or the owner.
- Six open code pull requests are reachable: each lane 2 or 3 pull request waits on a review at some point, and that writer then leaves the 5. Example: 4 writers working, 1 reviewer, 1 writer waiting on that review = 5 sessions, 6 writers, 6 pull requests.

It does cap real use in one way, recorded as N1: six writers cannot all be working at the same moment. That is a limit the owner kept (section 5 "Call"), not a gap against the owner's "Yes", which asked writers to match the open limit, and they now do.

## Notes (not blocking)

- N1. UNIT: CLAUDE.md Settings. VERDICT: note. REASON: at most 5 writers can be working at one moment (fewer while reviewers run), so the sixth writer place is usable only by a writer waiting on a review or the owner. EVIDENCE: CLAUDE.md:80. EXPECTED: as written, if that is intended. FIX: none here; raising "Work sessions at once" would be a new owner choice (a change to a number the owner did not ask about).
- N2. UNIT: spec section 2.4, line 41. VERDICT: note. REASON: "'... at most 3 writing code' is a different limit and stays" is now superseded by section 5 but does not say so. EVIDENCE: spec line 41 vs lines 55-61. EXPECTED: a reader of section 2 alone is pointed to section 5. FIX: optional, append "(raised to 6 in section 5)" to line 41; spec file only.
- N3. UNIT: `docs/superpowers/specs/2026-11-21-feed-and-makers-page-design.md:199`. VERDICT: note, outside this change. REASON: "At most three write at once" is slice 3's build order under the old cap, a historical plan, not a rule. FIX: none; the retrospective may prune.
