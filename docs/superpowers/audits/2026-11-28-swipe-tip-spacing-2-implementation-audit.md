# Swipe tip spacing, review 2 (PR #445)

Reviewed commit: `8699511` (head of `claude/project-thread-cu5tvs`; it is `da7705c` plus one `progress.md`-only commit). Reviewer: a fresh session, Opus 5.5, medium. Written 2026-11-28 04:01 UTC.

**Verdict: FAIL, 1 red.**

## What ran

- `pnpm lint` (eslint and Prettier): pass. Review 1's red 1 (Prettier on `feed-controls.test.ts`) is fixed.
- `pnpm typecheck`: pass. `pnpm test`: 169 files, 2442 tests, pass.
- `controls-overlap.test.ts` on the tablet (Chrome's engine), local Postgres 16, as committed: 2 passed.
- Probes, each a copy of `controls-overlap.test.ts` changed only as said, on the tablet, not committed:
  1. The `img, video` exemption taken out: both tests fail, 12 times in all, each " / Back to the feed" at `/g/<slug>`, every size, before and after launch. Nothing else is reported, so today the exemption hides only the game page's loading video.
  2. A painted `div`, `position: fixed`, laid exactly over Back on the game page while its video is held: caught at every size.
  3. The same thing as an `img`: **not caught**, both tests pass.
  4. The tip moved down onto the friends' faces: caught, "Swipe up for more Tap the speaker for sound / Liked by your friend Ivy Inline", at every size.
  5. The exemption narrowed to `.gamepage .clipbox video`: as committed it passes both tests; with probe 3's `img` over Back it fails at every size.
- Measured on the tablet, the tip's bottom to the friends' faces' top (after launch / before launch): 320×568 90 / 26 px, 375×667 237 / 201 px, 667×375 119 / 67 px. The tip is 88 px tall at 320 (three lines) and 68 px at 375. This matches review 1's figures.
- Not run: the phone (WebKit). This container has no Docker and only Chromium, so Safari's engine was not run here. CI has not run on `da7705c` or `8699511` either: the pull request conflicts with `main` (in `progress.md` only), and GitHub does not start `pull_request` runs while it does. The phone's result therefore rests on CI after the merge of `main`.

## Red

UNIT: `tests/browser/controls-overlap.test.ts`, the `overlays` filter (`!thing.matches("img, video")`).
VERDICT: red.
REQUIREMENT: the journey's own purpose, written above the filter ("Anything else drawn floating over the screen that is not a button ... Over a button it hides it as surely as another button would"), and the owner's standing rule that any overlap blocks (2026-11-27 23:12 UTC). The coordinator asked this review to check that the exemption cannot hide a real overlap.
REASON: the exemption leaves out every picture and video on every page, though only one, the game page's video under Back, needs it. A picture placed over a button is no longer seen.
EVIDENCE: probe 3 above (a painted, fixed `img` over Back: both tests pass); probe 1 shows the game page's video is the only thing the exemption hides today.
EXPECTED: the game page's loading video is left out, and any other painted, positioned picture or video over a button or the faces still fails.
FIX: change the line to `!thing.matches(".gamepage .clipbox video") &&`, the same way `.gamepage .clipopen` is already left out, and its comment to match. Only `tests/browser/controls-overlap.test.ts`. Checked by probe 5: as committed it passes; with an `img` over Back it fails.

## Checked and fine

- Criterion 1: the faces are counted. Probe 4 fails as it should.
- Criterion 2: `Feed.svelte` reads "Swipe up for more" / "Scroll down for more"; the second line is unchanged; `feed-controls.test.ts`'s two "gone" checks match the new words with `/(Swipe up|Scroll down) for more$/`, so they cannot pass on words that no longer exist.
- Criterion 3: the tip clears the faces at all three sizes, before and after launch (figures above; tablet only).
- Criterion 4: on Chrome's engine the journey holds the video file and asserts `video[data-loading]` before measuring, so the loading moment is checked each run. On WebKit the video loads normally, as the body says.
- Flaky records in `progress.md`: the `:217` root cause, the new entry for main's run 46102554610 (job 140848036215 is browser shard 2 of 6 at `a26ecd9`, failure), and the `feed-controls.test.ts:462` sighting (job 140842235020 is browser shard 5 of 6 at `53895ef`, failure) all name real jobs.
- CRUD: the change makes nothing a person can create; nothing to add.

## Notes (not blocking)

- The pull request conflicts with `main` in `progress.md`. The builder merges `main`; with the conflict only in `progress.md`, that alone would not make a review stale.
- The new main entry says "Fixed by #445" before #445 has merged; "fixed on #445, not merged yet" would be exact until it does.
- In the friend bubbles row of `progress.md`, the follow-up text is added after the last column's "not measured (short path, no plan)" rather than in the middle column.
- `CLAUDE.md` in this repo still puts flakes under "Flaky tests" in `progress.md`, so the records are in the right place for now; the move to `docs/superpowers/flaky/` is separate work.
