# Feed flake fixes (#353): review, round 1

Lane 1 review, fresh session (Opus 5.5, medium), of PR #353 head `a816811e9b4f5fe7c5672efe4c96efa1f1029da4`
(branch `claude/project-thread-2zna2s`, base `cc4e4db`). Written 2026-11-23 02:02 UTC.

**Verdict: PASS, 0 red, 4 notes.** Merge still needs `main` merged in (Feed.svelte conflicts) and green CI on that merge,
which no CI run has covered yet; a PASS then needs re-pointing to the merge head.

## What the change is

- `src/features/feed/Feed.svelte`: a `resize` listener that, when the window's width changes, scrolls the clip the
  person is on (or the waiting screen, when they are past the last clip) back to the top, instantly. Removed in the
  `onMount` cleanup.
- `tests/browser/feed.test.ts`: new journey that holds `/api/feed`'s next page, turns the window while the person is on
  the last clip of the first page, then lets the page go and checks the same clip is still current with the other
  shape's video.
- `tests/browser/cli-games.test.ts`: the three "on the feed" checks count the game's round-0 key across the whole first
  round (`/`'s data, then `/api/feed` pages while the next address is still in round 0) instead of counting
  `section[data-slug]` on the first screen.
- `docs/superpowers/progress.md`: one Flaky tests entry for both causes.

## Checks run here (cloud container, Postgres 16, Playwright 1.63, WebKit 26.6 installed for the phone profile)

| Check | Result |
|---|---|
| New journey + `feed.test.ts:47`, phone, at the head, `--repeat-each=3` | 6 of 6 passed |
| New journey, phone, with `Feed.svelte` put back to `cc4e4db` (journey kept), `--repeat-each=3` | 3 of 3 failed: `last` clip `data-current` "false" after the page came in. The journey catches the bug. |
| `feed.test.ts`, `feed-controls.test.ts`, `cli-games.test.ts`, all three devices, once | 85 passed, 1 failed, 4 did not run. The failure was `feed.test.ts`'s `beforeAll` sign-up on tablet: "no code waiting for +12275550951" (stand-in Twilio), before any feed code ran. Not this change; see note 4. |
| `feed.test.ts`, all three devices, `--repeat-each=2` | 30 of 30 passed |

Not run here: lint, typecheck, unit tests (the PR reports them green; this review changed no code). CI: only `pr-rules` ran
at this head (runs 45096959511, 45096985144); the CI workflow has no run, because the PR does not merge cleanly with
`main` (`mergeable_state: dirty`).

## The app fix

- **Correct.** In the HTML event loop's rendering update, resize steps run before intersection observations are
  updated, so `current` still names the person's clip when `keepPlace` runs, and the observer never reports the
  in-between offset. Shown by the with/without runs above: the journey fails every time on WebKit without the fix and
  passes with it.
- **Endless feed.** On the waiting screen (`current >= clips.length`) it scrolls `moreScreen` back, so `loadMore`'s
  `waiting` still sees the person on it and moves them to the new page's first clip, as before. Not on the waiting
  screen, `waiting` is false and nothing moves. The new journey covers the not-waiting case; `feed-controls`'s
  past-page-1 journey covers the waiting case and passed here on all three devices.
- **Height-only changes ignored.** A phone browser's bars changing the height mid-swipe never trigger a scroll back, so
  a swipe is never undone.
- **Swipe between tabs.** Tab moves are page transitions (`src/lib/page-moves.ts`), not a horizontal scroller, so
  `scrollIntoView` has no tab container to drag along. Leaving the feed unmounts it and removes the listener.
- **Leaks.** One listener added, removed in the same cleanup as the others; `width` and `keepPlace` are closure locals.
  None.

## The tests

- No assertion loosened, no retry, no sleep, no new timeout. The two `requestAnimationFrame`s in the new journey are a
  wait for a rendering step, not a pause. `feed.test.ts` adds a journey and changes nothing existing.
- `cli-games`: "once" stays `toBe(1)` and "off" stays `toBe(0)`, now over the whole first round instead of the first
  50 clips, so "off the feed" is a stronger check than before. The cursor format the helper splits (`day~round~offset~
  swapped~last`) matches `NEXT` in `src/features/feed/service.ts:20`, and keys are `${round}~${slug}`
  (`service.ts:145`). The loop ends: the next address moves to round 1 when round 0 ends, or is null.
- The PR body names both changed test files and why (Tests changed).

## Pull request body

Starts with the attribution lines, has `## Lane` (lane 1), acceptance criteria, causes, tests changed; last line is
`Requested by **McThayDT**`; no "Generated" footer.

## Interaction with the `feed-controls.test.ts:262` fix

This PR does not touch `returnTo`, the snapshot, `loadMore` or `feed-controls.test.ts`, and `keepPlace` sets `width`
fresh on every mount, so coming Back from a game never triggers it. Two things to watch at merge time:

1. `Feed.svelte` conflicts with `main` already (#347 moved the hints to `deviceStore` in the lines next to the new
   block). The resolution keeps both: `main`'s `deviceStore` hint lines and this PR's `keepPlace` block and cleanup line.
2. If the other fix changes how `loadMore` decides the person is waiting (`current >= had`), `keepPlace`'s
   `current >= clips.length ? moreScreen : …` must keep the same meaning. Whichever merges second re-runs
   `feed.test.ts` (new journey) and `feed-controls.test.ts` on phone.

## Notes (not blocking, not fixed here)

1. UNIT: `tests/browser/cli-games.test.ts` `timesInTheFeed`. VERDICT: note. REASON: it reads SvelteKit's serialized
   page data with regexes. If the `next:"…"` match ever misses, only the first page is counted, and the "taken off"
   check (`toBe(0)`) would pass without looking past it. `expect(html).toContain("first:{")` guards the format only
   partly. FIX (optional): assert the next address was found whenever the first page holds `FEED_MAX` clips.
2. UNIT: same. VERDICT: note. REASON: the three checks now read the feed's data, not the rendered screen. The rendering
   of the first page is covered by `feed.test.ts`, so nothing is lost for this journey's purpose.
3. UNIT: `Feed.svelte` `keepPlace`. VERDICT: note. REASON: on a computer, dragging the window wider scrolls back on every
   resize event; instant, so harmless, but it is one `scrollIntoView` per event.
4. UNIT: `feed.test.ts` `beforeAll` (stand-in Twilio code). VERDICT: note. EVIDENCE: one "no code waiting for
   +12275550951" on tablet here at `a816811` when three journey files ran side by side on 4 cores; passed 30 of 30 on the
   rerun of the file. For the coordinator to record under Flaky tests (the sign-up text-code family).
