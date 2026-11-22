# Implementation audit: "Every wait shows it" rule (PR #313), cycle 1

- Examined: `56eb0f0` (PR #313 head), against `main` at `f5296bd`. Diff: `.claude/skills/this-repo/SKILL.md` +1, `docs/superpowers/progress.md` +7.
- Reviewer: fresh session, Opus 5.5, medium. Lane 3.

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## Verdict: PASS (0 red, 3 notes)

## Acceptance criteria

- AC1 PASS. One "Every wait shows it" line under the `this-repo` Product rules, quoting the three messages with times. `ls` finds all five paths at `56eb0f0` (identical on `main`). Each piece does what the line says: `page-loading.svelte` shows a bar (`role="progressbar"`) and a "Loading…" chip with a spinner; `busy-forms.ts` `markSending` marks the plain form's button busy and refuses a second press; `loads.ts` marks `<img>`/`<video>` `data-loading` until loaded; `tests/loading-states.test.ts` fails on an `<img>`/`<video>` without `use:loads`, a `use:enhance` form without `aria-busy=`, an `<iframe>` without `onload`, and a fetching screen without `aria-busy`; the layout check asserts `<PageLoading />` and `onsubmit={markSending}`. The `use:enhance` screens (for example `make/parts/QuestionScreen.svelte:120`) set `disabled` and `aria-busy`, as the line says.
- AC2 PASS. `progress.md` has the instruction entry (05:52, 05:53, 06:36, "#309 merged at `f5296bd`", which is `main`'s head). The three flaky entries were checked against GitHub:
  - job 137138319441: "browser shard 5 of 6", head `31e5cad`, attempt 1 failure; log shows `[computer] › make-questions.test.ts:388` with "page.evaluate: AbortError: The user aborted a request" at `showTheOwner (support/look.ts:310:14)`. Attempt 2 of run 44999678338: shard 5 success. Earlier full runs at `a6717a5` and `387254b`: shard 5 success.
  - job 137143091976: "browser shard 6 of 6", head `04c7c66`, failure; log shows `[computer] › make-design-pass.test.ts:239` "no code waiting for +12785552015". Attempt 2 of run 45001251809: shard 6 success.
  - job 137143092018: "browser shard 5 of 6", head `04c7c66`, failure; log shows `[tablet] › adults-only.test.ts:148`, `toBeVisible()` failed. At `04c7c66`, `support/account.ts:103` is the "We texted you a code" heading wait. Attempt 2: shard 5 success.
  - The entries sit with the open flakes, above the "#242" group of fixed ones, so they do not read as fixed.
- AC3 PASS. `git diff --stat f5296bd 56eb0f0`: the two docs files only. No live-state file at the head (`docs/superpowers/live/` absent).

## Exploratory

- Identity: both commits by McThayDT, no Claude trailers. The PR body's last own line is "Requested by **McThayDT**", followed only by the proxy footer that commit-authors ignores.
- The rule names shared pieces and forbids new kinds of loader, which fits "Do not overengineer" beside it.

## Notes (not blocking)

- N1. UNIT: `this-repo` line. VERDICT: note. REASON: it says "A frame keeps a 'Starting…' screen"; the play screen says "Starting {name}…" (`src/routes/g/[game]/play/+page.svelte:324`). EXPECTED: readers will understand it. FIX: optional, same line only.
- N2. UNIT: `this-repo` line. VERDICT: note. REASON: "`tests/loading-states.test.ts` fails on a screen that leaves one out" is broader than the test: it does not check `disabled`, the busy words on a `use:enhance` button, or that a "Starting" screen exists (only `onload`). EVIDENCE: the test's checks above. EXPECTED: no change needed now; a reader should not take the test as covering those. FIX: optional.
- N3. UNIT: commit `f903df5`. VERDICT: note. REQUIREMENT: `staged-path`, Writing ("the implementer writes them for it and says so in the commit"). REASON: the implementer wrote `progress.md` and the commit message does not say it was for the coordinator. EXPECTED: the next such commit says so. FIX: none here (no force-push); recorded.
