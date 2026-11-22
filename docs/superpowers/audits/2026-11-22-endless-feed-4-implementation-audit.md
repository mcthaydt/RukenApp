# Endless feed: implementation audit, round 4

Reviewed: branch `claude/project-thread-7fe1cy` at `a8cbb2e` (PR #329), the range `fbf507a..a8cbb2e`. In order:
`b01fad0` (the fix), `cb37d43` (removes the live-state file) and `a8cbb2e` (merge of `main` at `ab82aae`). Lane 2. The
full CI run on `fbf507a` found that a reload whose kept feed is shorter than the fresh one sent a `null` clip
binding to the IntersectionObserver, which threw.

**Verdict: PASS, 0 red, 1 note.**

## What was checked

- `b01fad0` touches only `src/features/feed/Feed.svelte` and `tests/browser/feed-controls.test.ts` (plus the live
  file, removed in `cb37d43`; no `docs/superpowers/live/` file at `a8cbb2e`).
- The fix is right. Svelte sets a `bind:this` to `null` when its element goes, so when a restore puts back fewer clips
  than were drawn, `sections` keeps `null` entries. Every use now tests for an element (`if (section)`, `if (!video)`,
  `screen ? ... : undefined`, `moreScreen ? ...`), so `observe(null)` can no longer happen and the play and let-go
  effects skip gone videos. The types say `null` too.
- The new journey cuts the kept feed in SvelteKit's snapshot to two clips, reloads, checks the kept clip is on screen,
  moves on with a key, and fails on any page error. On `fbf507a` the full run failed (`browser shard 10 of 12`, the
  hints journey timing out at 16.1s on tablet); at `a8cbb2e` that hints journey and the new one pass on phone (WebKit),
  tablet and computer.
- The merge `a8cbb2e` is the clean automatic merge: `git merge-tree` of its two parents (`cb37d43`, `ab82aae`) gives
  exactly its tree. Nothing it brings from `main` touches `src/features/feed/`, `src/routes/+page.*` or
  `src/routes/api/feed/`.
- CI at `a8cbb2e` (quick draft run): verify, postgres, all six browser pieces and `gate (quick, draft)` green.

## Note (not fixed here)

- N1, `Feed.svelte`: after a restore makes the feed shorter, `sections` keeps its old length with `null` at the end,
  and the observer counts the spinner screen as `[...sections, moreScreen]`, so on the spinner `current` is the old
  length, not `clips.length`. Keys then treat every index past the clips as the spinner, so ArrowUp from the spinner
  stays on it until the next page fills the gap. It heals as soon as that page comes (and swiping is unaffected); it
  only sticks if the page fails, where "Try again" is still there. A bounded fix is
  `[...sections.slice(0, clips.length), moreScreen]` in the observer, with a key-up line in the new journey.
