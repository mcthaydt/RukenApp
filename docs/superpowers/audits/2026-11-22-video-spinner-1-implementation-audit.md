# Video spinner: implementation audit, round 1

Reviewed: branch `claude/project-thread-bip6ma` at `edba419`, against `main` at `5cfe939`. Lane 2, one fresh review.
Brief: the owner, 2026-11-22 13:52 UTC, "The videos don't have a spinner before they load in the panel, I said do it
everywhere", plus the acceptance criteria in `/mnt/project-files/pr-drafts/video-spinner-pr-body.md`.

**Verdict: FAIL, 1 red, 2 notes.**

## What was checked

- Every `<img>` and `<video>` in `src/` takes `use:loads` (grep of every tag; the only one without it is the
  `<noscript>` copy in `Feed.svelte`, which runs no script and so never gets `data-loading`, as intended).
- Every CSS rule that sets `background` on a selector that reaches a video or picture, and whether its specificity
  beats `video[data-loading]` (0,1,1). Computed styles measured in Chromium (Playwright) on a page with `look.css` from
  `edba419`: `.gamepage .clipbox video`, `.tile`, `.clip` all show the turning spinner; `.sheet.fix video` shows none.
- Clears on load and on error: `loads.ts` is unchanged in behavior. A picture's `error` calls `done`; a video's `error`
  re-runs `look`, and after an error `networkState` is no longer `NETWORK_LOADING`, so the mark comes off. No change
  needed.
- Reduced motion: measured under `reducedMotion: 'reduce'`: `animation-name: none` and the background is the still SVG
  (no `animate` in it). Unit tests cover the same.
- `vitest run tests/lib/look.test.ts tests/loading-states.test.ts`: 142 passed on `edba419`.
- Not run here: the Playwright journeys (no `TEST_DATABASE_URL` in this container). The builder reports 10 passed on
  tablet and computer; CI must run them and the phone.

## Findings

### 1. The "Needs fixing" card's video shows no spinner

- UNIT: `src/lib/look.css`, rule `.sheet.fix video` (line 2101), used by `src/routes/make/parts/FixCard.svelte`.
- VERDICT: red.
- REQUIREMENT: the owner's "do it everywhere"; PR body: "every `<img>` and `<video>` marked `data-loading` ... shows a
  chalk spinner".
- REASON: `.sheet.fix video` (specificity 0,2,1) sets the `background` shorthand to `var(--sage)`, which beats
  `video[data-loading]` (0,1,1) and wipes its `background-image`.
- EVIDENCE: computed `background-image` of `<div class="sheet fix"><video data-loading>` in Chromium at `edba419`:
  `none`. The same video under `.gamepage .clipbox` or with class `.tile`: the spinner SVG.
- EXPECTED: the fix card's video shows the turning spinner (still under reduced motion) while it loads, like every
  other video.
- FIX: in `.sheet.fix video`, set `background-color: var(--sage)` instead of the `background` shorthand (the
  shimmer's animated colour still wins while loading). Add a check in `tests/lib/look.test.ts` that no rule other than
  the loading rule sets the `background` shorthand or `background-image` on a selector ending in `video` or `img`, so a
  later rule cannot hide the spinner again; or a journey assertion on the fix card. Files: `src/lib/look.css`,
  `tests/lib/look.test.ts`.

### 2. Note: no journey covers the panel the owner pointed at

- UNIT: `tests/browser/loading.test.ts`.
- VERDICT: note.
- REASON: the owner's screenshot was the upright-video panel on `/make/<slug>/upright` (`VideoTile.svelte`). The new
  journeys check the game's page and the feed; the panel was checked only by hand in the verify run. It works today
  (`.tile` measured with the spinner), and finding 1's check would guard it too.
- EXPECTED (optional): one `toHaveCSS` assertion on the upright panel's video while clips are held.

### 3. Note: the backdrop video's spinner sits under the blur

- UNIT: `GameBackdrop.svelte`, `.backdrop video`.
- VERDICT: note.
- REASON: the full-screen backdrop on Live is blurred and dimmed, so its spinner shows as a soft white smudge behind
  the page while the backdrop loads. Harmless, decorative; recorded for the design review, not fixed here.
