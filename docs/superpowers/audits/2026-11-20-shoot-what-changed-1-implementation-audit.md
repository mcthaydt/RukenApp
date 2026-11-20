# Implementation audit: shoot only what changed (PR #205), cycle 1

- Pull request: https://github.com/mcthaydt/RukenApp/pull/205 (draft, lane 3)
- Commit examined: 6e4bb99 (branch `claude/project-thread-y2c6rv`), against `main` at dc96dc9
- Reference: the owner's guide, https://mcthaydt.com/prompts/claude-md-apps/, fetched with curl on 2026-11-20
- Reviewer: fresh session, Opus 5.5, medium. Changed nothing in the repo.

## Verdict

One red finding, one note. The wording of every guide-sourced line matches the guide exactly. The red finding is in Ruken's own `this-repo` line, which describes CI's screenshots wrongly.

## What was checked, and how

1. **Guide wording, added lines.** Every line the PR adds was searched for verbatim in the guide's text. 13 of 14 match exactly; the one miss is the `this-repo` line, which is Ruken's own and is not in the guide (expected).
2. **Guide wording, the other direction.** Every guide line of 60 characters or more was searched for in the branch's `CLAUDE.md`, `.claude/` and `docs/superpowers/`. The only lines not found are the guide's own page text, placeholders (`[COMMIT AUTHOR]`, `[WIDE PATHS]`, `[HARD-TO-UNDO PATHS]`, the `verify` angle-bracket template), the project instructions and start prompt (not repo files), the default stack, and the `settings.json` hook line. Nothing of the guide's rules is missing from the repo.
3. **Leftovers.** `grep` for "device matrix", "each device", "every screen", "each size" across `CLAUDE.md` and `.claude/` on the branch: no remaining "on each device in the device matrix" wording outside the new rule, where the guide keeps it on purpose (shared styles).
4. **Repo facts.** The new `this-repo` line was compared with `.github/workflows/ci.yml` at 6e4bb99 (finding 1).
5. **Process.** All three commits are authored and committed by McThayDT, with no Claude trailers. The live-state file is gone at 6e4bb99. The PR body names the `verify` and `this-repo` edits, states lane 3 and the owner's approval of the change, and ends with "Requested by **McThayDT**". CI on 6e4bb99 was still queued at 00:16 UTC; this audit does not judge CI.

## Findings

### 1. `this-repo` misstates when CI takes screenshots

- UNIT: `.claude/skills/this-repo/SKILL.md`, line 26 (CI section).
- VERDICT: red.
- REQUIREMENT: "Report honestly" in `CLAUDE.md`; `this-repo` is where the repo's CI facts live, and the new rule sends readers there ("the repo's `this-repo` skill names it").
- REASON: the line says CI takes screenshots of every screen "when anything visual changed". That is only the draft rule. On a full run (ready for review, and every push to `main`) CI always takes them.
- EVIDENCE: `ci.yml` step "Decide whether to take the screenshots": `shots=on` by default, and only when `CHANGED_ONLY` is true (a draft) does it turn off unless a `.svelte`/`.css` file, `static/` or `tests/browser/(support/)look` changed, or the PR carries the `screenshots` label. The header comment (lines 11 to 13) says the same.
- EXPECTED: the line says what CI does: every full run shoots every screen; a draft shoots them only when a `.svelte`, `.css`, `static/` or look file changed, or the PR has the `screenshots` label.
- FIX: reword that one line, for example: "No program picks the screens a change reaches yet (`visual-check`, "Shoot what the change touches"). The builder lists the screens and sizes in the pull request by hand. CI still shoots every screen: on every full run, and on a draft when a `.svelte`, `.css`, `static/` or look file changed or the pull request has the `screenshots` label." Only file: `.claude/skills/this-repo/SKILL.md`.

### 2. `release` now states a behavior Ruken's CI does not have (note)

- UNIT: `.claude/skills/release/SKILL.md`, line 47.
- VERDICT: note, not fixed here.
- REASON: the shared line says screenshots are taken "only of the screens those files reach". Ruken's CI shoots every screen. The `this-repo` line records the gap, and the owner chose not to build a picker now, so this is consistent with the decision. Recorded so the gap is not forgotten if the picker comes up later.
