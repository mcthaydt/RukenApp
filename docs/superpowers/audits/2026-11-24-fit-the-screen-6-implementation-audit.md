# Fit the screen (PR #379): implementation audit, cycle 6

Reviewed commit: `3f71dda2b52c111e97938a30587c38f109624d16` (branch `claude/project-thread-q2xy7t`).
Reviewer: a fresh session, Opus 5.5, medium. Lane 2.
Written 2026-11-24 05:47 UTC.

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## Verdict

**FAIL: 1 red.** Round 5's red is fixed and the fix is sound on every size measured. But no CI has run on `3f71dda`: the pull request clashes with `main` in `docs/superpowers/progress.md`, so GitHub cannot build the merge and the CI workflow never started. Without CI on the head, the PR cannot be called green.

## What ran

- Diff `adc39f8..3f71dda`: `src/lib/look.css` (the account block's tighter spacing now applies to any window under 801px tall, `@media (max-height: 800px)`; the card's smaller top margin stays phone-only, `max-width: 499px and max-height: 700px`) and one Flaky tests line in `progress.md`. `.side-by-side` is used only by `src/routes/me/+page.svelte:55`, so the widened rule touches Your account and nothing else.
- In Playwright's v1.63.0 image (the digest CI uses), Postgres 16 in a fresh container, on `3f71dda`, 4 workers, all three device profiles: `fits-the-screen`, `me`, `panels-feel-like-an-app`, `sideways-phone`, `look-layout`, `look`, `bar`, `buttons`, `real-buttons`, `membership`, `delete-account`, `computers`: **485 passed, 25 skipped, 0 failed**. That includes `[computer] fits-the-screen:98`, round 5's red.
- `feed-controls:847` "the feed never ends", phone, tablet and computer, fresh database: 3 passed. Its local failure for the implementer was its database, not this PR (the diff touches no feed code).
- Probe (not committed): a new member's `/me` at 14 window sizes, on each of the three profiles. Page overflow 0 everywhere. View overflow 0 and Delete my account above the bar at 375x667, 390x844, 414x896, 768x1024, 810x1080, 1024x768, 1024x1366, 1280x720, 1280x800, 1366x768, 1440x900, 1536x864, 1920x1080. Short windows (1024x768, 1280x720, 1280x800, 1366x768) take the tighter card (120 to 586, Delete ends at 574); tall ones keep the old card (120 to 730), so tablet and big desktop are unchanged. Phone at 375x667 is unchanged from round 5 (WebKit: card 64 to 579, Delete ends 567, bar at 595).
- CI on `3f71dda`: only `pr-rules` ran (runs 45334511340, 45334581103, green). `GET /pulls/379` gives `mergeable_state: dirty`. `git merge-tree origin/main 3f71dda`: one conflict, `docs/superpowers/progress.md` (Flaky tests). `main` is at `64e476d`, 64 files ahead of this branch's base.

## Red findings

### Red 1: CI cannot run, because the PR clashes with main

- UNIT: the branch `claude/project-thread-q2xy7t`, `docs/superpowers/progress.md`.
- VERDICT: red.
- REQUIREMENT: merge on green; the coordinator's brief for this round ("check the PR's CI on all shards").
- REASON: the PR's merge with main has a conflict, so the CI workflow (a `pull_request` run on the merge) never starts.
- EVIDENCE: runs for head `3f71dda`: `pr-rules` only; `mergeable_state: dirty`; `git merge-tree` reports `CONFLICT (content): Merge conflict in docs/superpowers/progress.md`.
- EXPECTED: CI runs on the head, every browser shard green.
- FIX: merge `origin/main` into the branch with a merge commit, keep both sides' Flaky tests lines, push, and let CI run (mark ready if full CI only runs on ready PRs). Files: `docs/superpowers/progress.md` only, plus whatever main brings. The next review need only check the merge diff and CI.

## Notes

- Between 801 and about 817px tall, a member's account on a wide window scrolls 17px inside its view (1280x801: view overflow 17, Delete ends at 698, view ends at 721, so Sign out and Delete are still in view and the bar covers nothing). It is the old card coming back just past the 800 line. Few browser windows have an inner height in that band, and the owner allows a rare scroll in its view. If wanted, `max-height: 820px` closes it. Not blocking.
