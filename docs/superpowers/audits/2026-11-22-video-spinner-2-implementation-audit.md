# Video spinner: implementation audit, round 2

Reviewed: branch `claude/project-thread-bip6ma` at `3ad9398` (PR #324), the fix for round 1 (`58e2040` at `edba419`).
Lane 2, one fresh review. Brief: the owner, 2026-11-22 13:52 UTC, "The videos don't have a spinner before they load in
the panel, I said do it everywhere", plus the acceptance criteria in the PR body.

**Verdict: PASS, 0 red, 1 note.**

## What was checked

- Scope: `git diff --stat edba419 3ad9398` touches only `src/lib/look.css` (8 lines), `tests/lib/look.test.ts` (+14),
  `tests/browser/loading.test.ts` (+26) and the round 1 audit file. Nothing else changed.
- Round 1 red (the "Needs fixing" card's video had no spinner): fixed. `.sheet.fix video` no longer sets any
  background; `.sheet.fix video:not([data-loading])` sets `background-color: var(--sage)`. Measured in Chromium
  (Playwright, `look.css` at `3ad9398`): `.sheet.fix video[data-loading]` shows the turning spinner SVG; under
  `reducedMotion: 'reduce'` the still SVG (no `animate`); `.sheet.fix video` without `data-loading` shows no picture and
  sage `rgb(180, 205, 194)`, so a failed video is still never white on white. `.tile` and `.clip > video` still show
  the spinner.
- The new look test fails by itself: with `look.css` from `edba419` it fails with
  `expected [ '.sheet.fix video' ] to deeply equal []`; with `3ad9398` it passes. Its pattern catches the `background`
  shorthand and `background-image`, not `background-color`, which is what can and cannot hide the spinner. Nested rules
  inside `@media` blocks are matched too (the inner rule is found on its own).
- `vitest run tests/lib/look.test.ts tests/loading-states.test.ts`: 143 passed at `3ad9398`.
- The new journey on `/make/<slug>/upright?again=1`: reads right. `.vframe video` is the `VideoTile` inside the panel
  in `VideoQuestion.svelte`; `?again=1` is the address the "Choose a different video" link uses; `holdAnswersTo`
  holds media the same way the other spinner journeys do; it checks the spinner on the panel and on every loading video
  on the screen, then that the mark comes off after release. Not run here (no `TEST_DATABASE_URL` in this container):
  CI must run it on all three profiles.

## Findings

### 1. Note: the look test only sees rules that name `img` or `video`

- UNIT: `tests/lib/look.test.ts`, "no other rule on a picture or a video sets its background picture...".
- VERDICT: note.
- REASON: a rule on a class that sits on a video or picture (`.tile`, `.clip`) is not checked. Today they are safe:
  `.tile { background: var(--sage) }` and `.clip { background: var(--ink) }` are (0,1,0), under
  `video[data-loading]` (0,1,1), and both measured with the spinner. A later, more specific class rule could hide it
  again without this test failing.
- EXPECTED (optional, later): the journeys' `toHaveCSS("background-image", ...)` checks already cover the panel, the
  game's page and the feed; no change needed for this PR.
