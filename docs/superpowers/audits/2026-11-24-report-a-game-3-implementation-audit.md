# Implementation audit 3: Report a game

- Spec: `docs/superpowers/specs/2026-11-24-report-a-game-design.md` (plan PASS at `679fd28`).
- Pull request: #378, branch `claude/project-thread-yqmrq4`. Examined commit: `e3eae42` (one commit on `2adf911`, which audit 2 examined).
- Lane 3. Model: Opus 5.5, medium. Audited 2026-11-24 03:54 UTC.
- Scope: audit 2's one red, R3, and the lines the fix touched. Audit 2's other findings stand as written.
- Prompt: Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

**Verdict: PASS: 0 red, 3 notes.** R3 is fixed: on every sideways iPhone, Share stands under the bar again and Report stands beside it, clear of the bar, Share and the words. The extended check fails on all three sideways iPhones without the fix. CI on `e3eae42` is red, but on a recorded phone flake ("the feed never ends"), not on anything this change touches; it passed 30 of 30 here. The merge still needs a green CI run.

## What changed since `2adf911`

`git diff --stat 2adf911 e3eae42`: three files, 17 added, 4 removed.

- `src/features/feed/Feed.svelte`, inside `@media (orientation: landscape) and (max-height: 449px)` only: `.side` gets `flex-direction: row-reverse` (Share stays in the bar's column, Report goes to its left on the same row), and `.lower`'s right padding grows by one button and a gap so the words leave room for Report.
- `tests/browser/sideways-phone.test.ts:81`: Report's box is below the bar's foot, inside the window, at x >= 0, ends at or before Share's left edge, on Share's row (within 2 px), and the words band ends at or before Report's left edge.
- `tests/browser/feed-controls.test.ts:817` (the Tab-order test): 10 presses instead of 9. The Report assertion (`names[play + 2]` is "Report", `names[play + 3]` is "Sound") was already in `2adf911`; the extra press keeps `play + 3` inside the list.

## What ran, at `e3eae42`, in a cloud container

All in Playwright's image `mcr.microsoft.com/playwright:v1.63.0-noble@sha256:eff16c30…a4a27` (the digest CI pins), Postgres 16 beside it, `--retries 0`.

- `sideways-phone.test.ts` and `feed-controls.test.ts`, phone: 47 of 47 pass, including `:81` for the small, middle and big iPhone held sideways and the Tab test at `:817`.
- `sideways-phone.test.ts`, `feed-controls.test.ts` and `report-a-game.test.ts`, all three devices: 147 of 147 pass.
- `feed-controls.test.ts` "the feed never ends" (`:849`), phone, 30 copies at 4 workers: 30 of 30 pass.
- Mutation checks (each undone after its run; none committed):
  - M5, `Feed.svelte` put back as it was at `2adf911` (no `row-reverse`, old padding), new tests kept: `:81` fails for all three sideways iPhones (small: Share's top 255, bar's foot 275.5; middle: 270 against 283; big: Report's foot 912 past the window's 864). So the new check catches R3 on its own.
  - M6, only the `.lower` padding put back (keeping `row-reverse`), and the Tab test at 9 presses: `:81` and `:817` both still pass on phone. See N10 and N11.

## CI on `e3eae42`

Run 45318672137 (quick draft run): lint, typecheck, build, verify, postgres, pr-rules and commit-authors green. Browser shard 6 failed on `feed-controls.test.ts:849` [phone] "the feed never ends", `toHaveAttribute("data-current", "true")` on `clips.nth(before)` at line 873, received "false" for 15 s; the run then stopped at its first failure, so the other shards were cancelled and `sideways-phone.test.ts` never ran in CI on this commit. This is the same failure recorded under Flaky tests in `progress.md` (then `:832`, on #345, which changed no feed code: "clips.nth(before) never became current"; cause not found). This commit touches only the sideways rules and two tests, not the feed's paging or which clip is current, and the test passed 30 of 30 here. It is not a red against this change, but CI has to go green (a rerun, or the full run when the PR is marked ready) before the merge.

## Audit 2's red

**R3, fixed.** On a phone held sideways Share stands in the bar's column under the bar's foot, inside the window, and Report stands to its left on the same row, clear of the bar and the words (`:81`, three sideways iPhones). Without the `Feed.svelte` change the check fails on all three (M5).

## Notes (recorded, not blocking)

- **N10. The new padding is not held by a test at these sizes.** With the old `.lower` padding the words band still ends left of Report on all three sideways iPhones (M6), because the band's `flex-basis: 26rem` keeps it narrower than the room left. The padding is right in principle and would matter on a narrower sideways window; no device in the matrix shows it.
- **N11. The Tab test's tenth press is not needed on phone.** With 9 presses it still passes on phone (M6). It is harmless and gives room for the extra button on other layouts.
- **N12. Sideways, Tab goes right to left across the two round buttons.** The DOM order is Share then Report and `row-reverse` shows Report on the left, so on a sideways phone with a keyboard focus moves from Share (right) to Report (left). The Tab test runs upright only. A phone held sideways is rarely driven with Tab.
- Notes N1 to N9 from audits 1 and 2 stand.
- Flaky tests (for `progress.md`): `feed-controls.test.ts:849` "the feed never ends" [phone] failed again, run 45318672137, shard 6, at `e3eae42`; 30 of 30 passed in Playwright's image here.

## Criteria changed since audit 2

| # | Result | Evidence |
|---|---|---|
| 19 | pass here; CI red on a recorded flake | `sideways-phone.test.ts:81` three sideways iPhones, M5; 147 of 147 on three devices; CI shard 6 `:849` flake, 30 of 30 here |
