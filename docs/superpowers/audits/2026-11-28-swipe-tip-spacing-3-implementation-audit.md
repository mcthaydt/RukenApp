# Swipe tip spacing: implementation audit 3

- Pull request: #445, head `448f1d5` (`448f1d5fa8cf10b8a38d76cb9e90fb222a388d17`).
- Reviewer: a fresh session, Opus 5.5, medium. Written 2026-11-28 04:15 UTC (from `date`).
- Lane 2 (`tests/browser` journey of shared reach, plus copy in `src/features/feed/Feed.svelte`).
- Verdict: **PASS**, no red. One note for the merging session (CI's gate at this head is red from a known flake).

## What changed since review 2 (`8699511`)

`448f1d5` merges `main` (`a26ecd9`). Against `8699511` the only change to the PR's own files is one line in
`tests/browser/controls-overlap.test.ts`: `!thing.matches("img, video")` became
`!thing.matches(".gamepage .clipbox video")`, with its comment. That is review 2's fix, word for word. The rest of the
merge is `progress.md` (below).

## Checks run here

Local: Postgres 16, Playwright 1.63, Chromium (the tablet project, an iPad in Chrome's engine, which is where the
journey holds the game's video back). The phone (WebKit) was not run: this container has no WebKit and no Docker. CI's
phone run covers it (below).

1. **The journey as committed passes.** `controls-overlap.test.ts` on tablet: 2 passed, then `--repeat-each 3`: 6 of 6
   passed (the computer project skips this file by design).
2. **A planted picture over a control is caught again** (review 2's red). Probe copies of the journey, each adding one
   painted, fixed element at the exact box of a control, run on tablet, both tests, all three sizes, before and after
   launch:
   - an `img` over the game page's Back: failed every time, `"planted / Back to the feed"` (12 of 12 screens);
   - an `img` over Search's field on `/search`: failed every time, `"planted / Search games and makers"` (12 of 12);
   - a `video` (outside the game's clip box) over Back: failed every time, `"planted / Back to the feed"` (12 of 12).
   So the exemption now covers only the game page's own video, not pictures or videos in general.
3. **The loading game video no longer fails, and the check would catch it if it did.** With the exemption line removed,
   the journey fails at every size, before and after launch, with `" / Back to the feed"` (12 of 12), and that is the
   only thing reported. With it in, the journey passes, and its own `expect(... video[data-loading]).toHaveCount(1)`
   proves the video was still loading when it looked. CI at `448f1d5` (run 46106095260): both tests passed on [phone]
   (WebKit, shard 2, job 140859059077) and [tablet] (shard 1, job 140859059114); [computer] skips by design. The only
   failure in that run is shard 5's note below.
4. **The tip clears the friends' faces.** Measured on tablet with a probe that logs the first-open tip's box and the
   faces' box on the first screen (the clip with the friend's face is the first clip on Followed). Gap from the tip's
   bottom to the faces' top, after / before launch: 320×568 90.1 / 26.4 px, 375×667 237.3 / 201.4 px, 667×375
   118.9 / 67.0 px. At 320 the tip is three lines (one, then two). Matches review 2's figures.
5. **Formatting and lint** on the changed test and `progress.md`: Prettier clean, ESLint clean.

Probe files: `/tmp/claude-0/probes/` in the review container (not kept in the repo).

## The `progress.md` merge

No conflict markers. Against `main` (`a26ecd9`) the file only gains this PR's lines and keeps all of `main`'s: the
friend bubbles row now says #435 merged and adds the tip follow-up; the two older overlap flaky entries gain their root
cause; one new entry records main's two overlap failures after #441 (run 46102554610); the `feed-controls.test.ts:438`
entry gains #445's `:462` sighting. Nothing of `main`'s was dropped or doubled.

## Note (not blocking this change)

- CI at `448f1d5` (run 46106095260, quick draft): `browser shard 5 of 6`, job 140859059039, failed on [phone]
  `tests/browser/feed-controls.test.ts:1111` "the feed never ends": `clips.nth(before)` stayed `data-current="false"`
  for 15 s (line 1135), so `gate (quick, draft)` is red. This is the known flake recorded in `progress.md` at `:1113`,
  `:849` and `:832` (same line, same message). #445 changes only the tip's words in `Feed.svelte`, and that test
  never looks at the tip. It needs its sighting added under "Flaky tests", and the merge still needs a green gate
  (the full run when the pull request is marked ready).
