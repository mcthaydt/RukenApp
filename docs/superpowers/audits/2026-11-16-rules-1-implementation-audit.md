# Implementation audit: the restored project rules (PR #160), round 1

Commit examined: `28765c0` on `claude/project-thread-cv5cr9` (base `main` at `20b3a05`). Written 2026-11-16 17:49 UTC
(from `date`). Lane 2 (first-time setup from the owner's own rules text): one fresh review of the change.

## What was checked, and how

- **Word for word.** The owner's text for `CLAUDE.md` and the three skills was saved to separate files and compared with
  `diff`. `review`, `release` and `visual-check` are identical. `CLAUDE.md` differs only on the placeholder lines
  (`[PROJECT]`, `[WHAT IT IS FOR]`, `[STACK]`, the five commands, `[COMMIT AUTHOR]`, `[OWNER NAME]`, `[WIDE PATHS]`,
  `[HARD-TO-UNDO PATHS]`) and the rewrapping of those lines. No placeholder is left (`grep '\[[A-Z][A-Z -]*\]'` finds
  none).
- **Filled placeholders.** Stack against `pnpm-lock.yaml` (SvelteKit 3.0.0, Svelte 5.57.1, Prisma 7.10.0,
  better-auth 1.7.7, Stripe, Vitest 5, Playwright 1.63, Wrangler 4), `package.json` (`packageManager` pnpm 10.34.6,
  `engines.node` 24.x) and `.nvmrc` (24.22.1). Commands against `package.json` scripts and the install step in
  `.github/workflows/ci.yml` (`pnpm install --frozen-lockfile`). Purpose and prices against
  `docs/superpowers/specs/2026-11-13-ruken-reels-linktree-design.md` ($9.99 a month or $99 a year). Every path in the
  lane 2 and lane 3 lists exists in the repo. Author and owner name against the handoff's standing facts and the
  commit's author (`McThayDT <107786093+mcthaydt@users.noreply.github.com>`). All correct.
- **progress.md and history.md against the handoff.** Merged work (#156, #157, #138, #150 to #155), the four remaining
  items in order, open PRs #144 and #147, the flaky tests, the local-run note, the boards, the test site, the games
  gate, the GitHub App, and the standing facts all match. `b706f58` is #157 and `20b3a05` is #159 on `main`. The last
  push run of CI on `main` is `3da364c` (#112) on 2026-11-15, as written. CI runs 12 browser pieces
  (`ci.yml:194`), as written. Superpowers 7.0.2 matches the synced plugin's `plugin.json`.
- **No AI credit lines.** The commit message has no co-author, session trailer or "Generated with" line. The PR body has
  none and its last line is `Requested by **McThayDT**`. The six files hold none (the only matches are the rule that
  forbids them).
- **Only `.md` files change**, and no workflow file is touched (`pulls/160/files`: six added `.md` files).

## Findings

UNIT: `docs/superpowers/progress.md` (Blockers, Material decisions, Tests to watch)
VERDICT: red
REQUIREMENT: CLAUDE.md, "Keep a visible record": progress.md holds blockers and material decisions, and separates
unresolved assumptions; `release`, Setup check: each item is reported as present, added or missing.
REASON: Three things the setup check found are not in the record: there is no aggregate gate job, CI uses
`--passWithNoTests` against a rule that never bends, and marking any PR ready merges it by itself.
EVIDENCE: `ci.yml:122` and `ci.yml:173` run `--passWithNoTests` on drafts, while CLAUDE.md "Tests" says "No
`--pass-with-no-tests` or similar flag that lets an empty suite pass in CI". `ci.yml` has no job that decides which checks
apply plus a final aggregate gate; the required checks are `verify`, `postgres`, `browser`. `auto-merge.yml` turns on
auto-merge for every non-draft PR, so "mark ready" equals "merge" once checks pass, which matters for every lane 2 and 3
PR (this one included). None of the three appears in progress.md or history.md; history.md "Setup" records only the
superpowers version.
EXPECTED: progress.md lists the setup check's missing items as open owner decisions (the gate job and the
`--passWithNoTests` flag both need a workflow change, so the owner's quoted words), and states that marking a PR ready
merges it, so lane 2 and 3 PRs stay drafts until their review or the owner's approval. history.md "Setup" lists each
setup item as present, added or missing.
FIX: Add those lines to `docs/superpowers/progress.md` (Blockers and waiting on the owner, Material decisions) and
`docs/superpowers/history.md` (Setup). No other file.

UNIT: `CLAUDE.md`, line 106 (Identity)
VERDICT: note
REQUIREMENT: none (formatting)
REASON: The filled line runs to about 160 characters while the rest of the file wraps at 120.
EVIDENCE: `awk 'length > 120' CLAUDE.md` prints lines 57, 106, 140, 228, 235, 236 and 238; all but 106 are long in the
owner's own text, so this is not a deviation from the owner's style, and `*.md` is in `.prettierignore`.
EXPECTED: Optional rewrap of that one line only.
FIX: Not required. Rewrapping would touch only `CLAUDE.md` line 106 and 107.

UNIT: `CLAUDE.md`, Risk, lane lists
VERDICT: note
REQUIREMENT: none; the lists are agent-selected (progress.md says so) and the owner can change them.
REASON: Sign-in and accounts code (`src/features/accounts/`, `src/routes/api/auth/`) sits in no named lane, so a
change there is lane 1 unless the classifier judges it "shared code many callers use".
EVIDENCE: Neither path appears in the lane 2 or lane 3 lists; the quality bar's "users cannot access data outside their
permissions" depends on them.
EXPECTED: The owner decides whether they belong in lane 2.
FIX: Not in this change; a follow-up for the owner, raised with the path lists already flagged in the PR body.

## Result

One red finding (the setup check's missing items are not in the record) and two notes. The rules files themselves are
correct: word for word, placeholders filled correctly, no AI credit lines. Hand back to the implementer for the red
finding.
