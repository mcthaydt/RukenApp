# Share sheet animation: implementation audit 1

- Pull request: #391 (lane 2, short path). Commit examined: `10edaffbe30547719ec39a020ca60697787399b5` (on `main` `d5988b3`, still main's tip).
- Reviewer: fresh session, Opus 5.5, medium effort. Written 2026-11-24 14:31 UTC.
- Verdict: **PASS.** No red. Three notes.

## What ran

- Read the diff: `ShareSheet.svelte` (`closing` class, `close()` / `finishClosing()`, 400 ms fallback timer, `cancel` handler for Escape, `animationend` on the dialog, new keyframes `share-out`, `share-down`, `share-dim`, `share-undim`, `var(--ease, cubic-bezier(0.32, 0.72, 0, 1))`, reduced-motion rule extended to `::backdrop`), the new journey in `tests/browser/feed-controls.test.ts`, and the `progress.md` row. `--ease` is set only on `.screen` (`src/lib/look.css:935`); the sheet is used by `Feed.svelte` and `src/routes/g/[game]/+page.svelte`. `ReportSheet.svelte` does not use `--ease`. Graphify's index (built at `64e476d`) predates the file, so callers were found with grep.
- Cloud container, Node 24, Postgres 16, Playwright 1.63.0, `wrangler dev --local`:
  - `feed-controls.test.ts` and `game-page.test.ts` whole, phone, tablet and computer: **144 passed**.
  - Probe (not committed, `/mnt/project-files/audits/2026-11-24-share-sheet-animation-1-probe.test.ts.txt`): on the feed, each of Close, Escape, a press on the dimmed screen and More (phone sheet stand-in), with and without reduced motion; on the game page Close, Escape and the dimmed screen; Escape during the opening slide, then keys while it slides away. It logs every animation start, end and cancel on the dialog and its `::backdrop`, the time from `closing` to closed, the lowest opacity seen, scrolls of `main.feed` and the window, the focus and the current clip.
- PR CI at `10edaff` (draft, quick): gate, verify, postgres, browser shards 1 to 6, pr-rules, commit-authors all success.
- Branch: two commits, both McThayDT, no Claude trailers, no live-state file left.

## Checked and fine

- Every way of closing plays the slide-away and the dim fades: computer and tablet run `share-out` + `share-undim::backdrop` for Close, Escape, dimmed screen and More on the feed, and for Close, Escape and dimmed screen on the game page; sheet and backdrop opacity reach under 0.04; closed 247 to 425 ms after `closing` starts. The phone (WebKit, upright) runs `share-down` + `share-undim` for all four. Opening runs `share-in` / `share-up` with `share-dim` on the backdrop, which proves the `--ease` fallback works (before it, no animation ran).
- Focus goes back to Share after every close, on the feed and on the game page, with and without reduced motion.
- The page behind stays still: 0 scrolls of `main.feed` and of the window in every case; the feed's current clip unchanged; the game page's scroll stays 0. Keys pressed while the sheet slides away are still stopped (the dialog is still open; 0 feed scrolls).
- Reduced motion: no animation at all on open or close for all four ways (phone, tablet, computer); the sheet closes at once.
- Reopening after a close: no `closing` class left, opacity back to 1.
- Escape during the opening slide: the open animation is cancelled, the slide-away runs, the sheet closes and the focus returns to Share.

## Notes (not blocking)

1. **The 400 ms fallback can cut the slide short on a slow device.** The timer starts when `closing` is set, not when the slide starts. In this container's WebKit (software drawing, about one frame per 300 ms) the slide started 100 to 340 ms after `closing`, and in 3 of 9 phone closes the timer closed the sheet mid-slide (`animationcancel share-down` after `close`, e.g. cross: `closing` 1277, `animationstart` 1427, `close` 1701). Chromium profiles always finished first. Real phones draw far faster, so this is recorded, not red. If wanted: start the fallback at `animationstart`, or wait on `sheet.getAnimations()`'s `finished` with a longer cap.
2. The journey checks Close and Escape; the dimmed-screen press and More (criterion 2) are covered only by this probe.
3. A press inside the sheet while it slides away (220 ms) still reaches its buttons. Harmless as built.

## Re-pointed to `72a8eedc673f983d80fc2762cca2fe5ad3f54d1f` (2026-11-24 14:37 UTC)

- `72a8eed` merges main `eaaf8a7` (#390, spinner only) into `10edaff`. `git diff 10edaff 72a8eed` equals `git diff <merge-base> eaaf8a7` once index lines are dropped: only main's changes come in.
- It does not touch `ShareSheet.svelte`, `Feed.svelte`, `src/routes/g/[game]/+page.svelte` or `tests/browser/feed-controls.test.ts`. In `look.css` it changes only the loading-line rules (one `var(--ease)` use removed), nothing on `.screen`, `--ease`, dialogs, the dim or glass.
- The PASS above holds for `72a8eed`.
