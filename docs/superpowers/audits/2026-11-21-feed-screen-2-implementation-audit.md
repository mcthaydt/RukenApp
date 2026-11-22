# Implementation audit 2: feed screen (slice 3 unit D), RukenApp #285

Examined: 6429568 (head of claude/project-thread-u4abc4). Lane 2 re-review of the change since 9c546f1 (PASS), which is three files: src/features/feed/Feed.svelte, tests/browser/feed-controls.test.ts, tests/browser/feed.test.ts. Reviewer: Sonnet 5.5 (the relay said Opus 5.5 medium; the session runs on Sonnet 5.5, said here rather than hidden).
Verdict: **6429568 PASS**

## Read, not run
No node_modules, Postgres or WebKit in this container. CI on this head was still queued (commit-authors, what changed, pr-rules-run) when I looked. The three WebKit defects can only be confirmed by CI's phone profile.

## Checks against the diff
- **Address only when near.** `fetches(index) = warm && index <= current + 1` gives the video `src` (undefined otherwise). Matches D3 (at most the clip on screen and the next); `preload` stays metadata/none as before, so the D3 preload assertions hold. SSR renders no src; `warm` is set one tick after `ready`, so the first src is already the window's shape (D2 unchanged).
- **noscript fallback.** An upright clip with `preload="none"` per section keeps a plain video with no script. The spec requires only Play to work with no script (spec line 105), so this is extra; with scripting on, noscript is not parsed to elements, so `section video` counts in the tests are unaffected.
- **Retry no longer replays our own pause.** `.then` pauses a clip that started after the person moved on; `.catch` returns when `index !== current`. Reading `current` at settle time is right. The sound-fallback (play muted) still runs for the clip on screen.
- **Journeys.** `openFeed` waits for `main.feed[data-ready=true]` (set from `ready`), the fetch-count journey waits for the next clip's `readyState >= 1` instead of `networkidle` and still asserts 1..2 requests and the preload list, and the pause check polls. None weakens a criterion. `feed.test.ts` scrolls the game's clip into view before reading its `src`, which the new address rule needs.

## Notes (not blocking)
- Nothing tests the noscript fallback (a `javaScriptEnabled: false` journey could assert one video with a src per clip). Not required by D1 to D14.
- A clip leaving the `current + 1` window loses its `src`, so scrolling back up refetches it. Fine for D3; worth a look only if bandwidth matters.
- `expect.poll` on `videos[1]` throws if fewer than two clips exist; the journey's own setup makes three.
