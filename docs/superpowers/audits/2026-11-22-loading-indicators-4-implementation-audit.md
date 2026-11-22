# Loading indicators, implementation audit 4 (PR #309)

- Examined: 387254b..a6c2005 on `claude/project-thread-jhe4or`: the one fix to `tests/browser/loading.test.ts` (4 lines in, 2 out).
- Lane 2. Reviewer: a fresh review session, Opus 5.5, medium.
- Verdict: **PASS, 0 red, 1 note.**

## The failure it answers

- CI run 44997719031 at 387254b: browser shard 2 of 6, `[phone] tests/browser/loading.test.ts:68 a video shimmers until it has loaded` timed out at 180 s in `page.evaluate` at `tests/browser/support/look.ts:310`, line 311 `await document.fonts.ready;`. 212 passed, 1 failed in that shard. Read from the run's log.
- `showTheOwner` waits for `document.fonts.ready` before its picture. In this journey every `//media.` answer is held, and WebKit does not settle `fonts.ready` until the held clips arrive, so the picture's wait never ends before `held.release()`.

## The fix (a6c2005)

- `showTheOwner` is skipped only when `browserName === "webkit"`. In `playwright.config.ts` only the `phone` project is WebKit (iPhone SE 3rd gen); `tablet` sets `defaultBrowserType: "chromium"` and `computer` is Desktop Chrome. So the comment "the phone ... the tablet and the computer still take it" is true.
- No check is weakened: `showTheOwner` compares nothing (its own doc comment: "It compares nothing: it is there for the Owner to look at"). On the phone the journey still asserts `video[data-loading]` is visible while the clips are held, releases them, and asserts none is left.
- The change keys on the engine that causes the hang, not on the project name, and touches no shared helper (`look.ts` is unchanged), so no other journey's picture changes.
- The owner's screens page for this PR already shows the video's loading state on tablet and computer only (`screens/loading/tablet-3-videos-loading.png`, `computer-3-videos-loading.png`), so no picture the owner saw is lost.

## What ran

- `pnpm exec eslint tests/browser/loading.test.ts`: exit 0. `pnpm typecheck`: 0 errors, 0 warnings.
- The browser journey was not run here (no WebKit stack with Postgres and the game address in this container). CI run 44998918897 on a6c2005 was queued at the time of writing.

## Note

1. As in audit 3: the fix is proven only by the run that merges showing "a video shimmers until it has loaded" passing on `[phone]`. The merging session checks that line in the shard log.
