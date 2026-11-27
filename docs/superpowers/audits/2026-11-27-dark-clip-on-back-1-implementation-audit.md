# Dark clip on Back: implementation audit, round 1

Pull request #412, head `4df323bfe30c892bdf7bb49a76b0f743be4f0bdf` (`4df323b`). Lane 2. Reviewer: a fresh session, Opus 5.5, medium.

**Verdict: 4df323b FAIL: 1 red.**

## What the change does

On Back from a game page to the feed, the feed's clip is a new video with no frame yet, and its picture faded in over the game's picture of the clip as a dark box. `src/lib/page-moves.ts` `waitForPicture` sets `html[data-clip-waits]` until the video's `loadeddata` (or `error`), and `slide.finished` deletes it; `src/lib/look.css` keeps `::view-transition-new(clip)` at opacity 0 while the mark is set.

## What ran

Local, Playwright 1.63, fresh Postgres 16 database, the app under `wrangler dev --local` (no video stills locally). Phone (WebKit) through `mcr.microsoft.com/playwright:v1.63.0-noble` `run-server`; an added Android Chrome profile (`devices["Pixel 7"]`). A scratch config only dropped `globalSetup` (no local WebKit) and pointed the phone at the image; it is not committed.

- `tests/browser/feed-to-game-grow.test.ts`, whole file: tablet 10/10, computer 10/10, Android 10/10, phone 9 passed and 1 skipped (`:234`, the existing WebKit fixme for the bar). This covers the mirrored Back glide (`:155`), the crop and corners both ways (`:432`), the arrow (`:130`) and the other slides.
- The new check (`:463`) with main's `look.css` and `page-moves.ts`: fails on tablet, computer and Android ("the feed's clip with no picture yet covers the game's picture"). With the fix it passes on all four. So the check fails by itself.
- Probes: `2026-11-27-dark-clip-on-back-1-probe.test.ts.txt` (a copy of the journey's helpers plus five probes), on computer, Android and phone.

| Probe | Result |
| --- | --- |
| A clip that never loads (request never answered) | mark set during the move, gone once the move ends; all three |
| A clip whose request fails | `error` (code 4) fires and lifts the mark at once, even while the move is held; all three |
| Fast Back, Forward, Back | no mark left after; all three |
| Leaving for `/make` while the clip waits | no mark left; all three |
| An earlier feed video's late first frame during a later Back | **mark lifted while the clip on screen still has no frame** (computer, Android); phone's timing missed the window |

## Findings

### 1. red: an earlier feed video's leftover listener lifts a later move's mark

- UNIT: `src/lib/page-moves.ts` `waitForPicture`.
- REQUIREMENT: the owner's bug (2026-11-27 04:35 UTC, "The video also goes black when we transition to feed from game"); the PR's check "Back keeps the game's picture until the feed's clip has one of its own"; the coordinator's ask to check fast repeat Backs.
- REASON: the `loadeddata`/`error` listeners are never removed when the move ends, and `shown` deletes the one shared mark whatever video set it. A video from an earlier Back that gets its frame late lifts the mark of a later Back whose clip has none.
- EVIDENCE: probe "an earlier feed video's late first frame…": Back with the clip's first request answered after 4 s, open the game again, Back again held at a third (clip requests now answered after 20 s). Computer: held at 1530 ms with the mark set; at 5.5 s the mark is gone while the on-screen clip's `readyState` is 0 (gap 7.61 against the game's picture alone). Android: held at 1584 ms, same result (`readyState` 0, gap 10.59). That is the state the PR's own check shows to be the dark box. On a slow line a person who goes Back, opens the game again and goes Back within the first clip's load time sees the dark clip again.
- EXPECTED: the mark stays until the clip of the move in progress has a frame, or the move ends.
- FIX: tie each wait to its own move: remove the listeners when the move ends (for example an `AbortController` passed as `signal`, aborted in the `slide.finished` handler), or have `shown` lift the mark only if it is still this move's (a counter like `lastNaming`). Add the probe's case as a journey that fails before the fix. Files: `src/lib/page-moves.ts`, `tests/browser/feed-to-game-grow.test.ts`.

### 2. note: `slideWhile`'s doc comment now sits on `waitForPicture`

`waitForPicture` and its own comment were put between `slideWhile`'s doc comment ("Plays one slide while the new page comes in…") and `slideWhile`, so that comment now documents the wrong function. Move `waitForPicture` above it.

### 3. note: the clip pops in mid-move

When the frame comes mid-move, the new clip goes from opacity 0 straight to `clip-takes-over`'s current value, a step rather than a fade. Small, and much better than the dark box; recorded, not blocking.

## The owner's still rule

"Every video shows its first-frame still until it loads" holds. The rule's still is the live video's CSS background (`src/lib/still-poster.ts`); the new CSS targets only the move's `::view-transition-new(clip)` picture, never the video element, and only while `data-move="grow"`. During the move the game's real picture of the clip shows instead; once the move ends the mark is gone (probes 1 to 4) and the feed's video shows its still or its frame. Stills do not exist under `--local`, so this part is read from the code, not run.

## Not run

Full suites (CI runs them on the PR), a real iPhone, ruken.io (the change is not deployed).
