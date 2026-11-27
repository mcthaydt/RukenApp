# Dark clip on Back: implementation audit, round 2

Pull request #412, head `be07ea05ed512b1dea3995262976b40290ceb8d6` (`be07ea0`). Lane 2. Reviewer: a fresh session, Opus 5.5, medium. Round 1 failed `4df323b` with one red (an earlier Back's late first frame lifted a later Back's mark).

**Verdict: be07ea0 PASS.**

## What changed since round 1

`src/lib/page-moves.ts`: `data-clip-waits` now holds its move's number (`naming`), and `endWait(naming)` deletes it only when it still holds that number. It is called from `loadeddata`, `error`, a video that already has a frame, and `slide.finished`. A new journey, `tests/browser/feed-to-game-grow.test.ts:504` "a picture that comes late from an earlier Back does not end the wait of the next Back", covers round 1's red.

## What ran

Local, Playwright 1.63, Postgres 16, the app under `wrangler dev --local` (no stills locally). Phone (WebKit, iPhone SE) through `mcr.microsoft.com/playwright:v1.63.0-noble` `run-server`; an added Android Chrome profile (`devices["Pixel 7"]`). A scratch config only dropped `globalSetup` and the html reporter, pointed the phone at the image and added the Android profile; not committed.

- Whole `feed-to-game-grow` file at `be07ea0`: tablet 11/11, computer 11/11, Android 11/11, phone 10 passed and 1 skipped (`:234`, the existing WebKit fixme for the bar). This includes the mirrored Back glide (`:155`), crop and corners both ways (`:432`), the first dark-clip journey (`:463`) and the new one (`:504`).
- The new journey with `4df323b`'s `page-moves.ts`: fails on tablet (gap 3.02), computer (7.48) and Android (4.98); phone passes (its timing misses the window, as in round 1). Back on `be07ea0` it passes. So the check fails by itself.
- Round 1's five probes plus both dark-clip journeys, `--repeat-each=3`, all four profiles: 84 passed. Probe "an earlier feed video's late first frame": in all 12 runs the mark is still set at 5.5 s while the clip on screen has `readyState` 0, and the gap to the game's picture alone is 0.00 (round 1: mark gone, gap 7.61 and 10.59).
- A new probe (`2026-11-27-dark-clip-on-back-2-probe.test.ts.txt`, last test): the feed page's data held 6 s and the clip never answered, so the slide's update runs long. No mark is left once Back settles, on all four profiles.
- Unit `tests/lib/page-moves.test.ts`: 22 passed. ESLint clean on the changed files. CI on `be07ea0` (quick, draft): every check green.

## Round 1's passing points, rechecked

| Point | Result at be07ea0 |
| --- | --- |
| The mark always clears | Never-loading clip: cleared when the move ends (12/12). Failing clip: cleared at once, mid-move (12/12). Fast Back, Forward, Back: none left (12/12). Leaving for `/make`: none left (12/12). Slow feed page: none left (4/4). |
| The first-frame rule ("every video shows its first-frame still until it loads") | Holds. The CSS still targets only `::view-transition-new(clip)` under `data-move="grow"`, never the video element whose background is the still (`src/lib/still-poster.ts`), and the mark is gone after every move above. Stills don't exist under `--local`, so this is read from the code. |
| The mirrored Back glide | `:155` passes on all four profiles. |

## Findings

No red.

### 1. note (carried from round 1, not fixed): `slideWhile`'s doc comment sits on `waitForPicture`

`src/lib/page-moves.ts`: the comment "Plays one slide while the new page comes in…" is still directly above `waitForPicture`'s own comment, so it documents the wrong function. Move `waitForPicture` and `endWait` above it. Not blocking.

### 2. note (carried from round 1): the clip pops in mid-move

When the frame comes mid-move, the new clip jumps from opacity 0 to `clip-takes-over`'s current value. Small; not blocking.

## Not run

The full browser suite locally (CI ran the quick draft run green), a real iPhone or Android phone, ruken.io (not deployed).
