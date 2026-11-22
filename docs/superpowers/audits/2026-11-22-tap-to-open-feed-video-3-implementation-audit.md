# Tap to open feed video: implementation audit 3

- Branch: `claude/project-thread-74qnu2`. Commit examined: `f354dd5` (on top of audit 2's head `5da6363`: `01b0ba3`, `6c0853e`, `f354dd5`).
- Lane 2 re-check, Opus 5.5, medium (the session that wrote audit 2). Audited 2026-11-22 16:50 UTC (from `date`).
- Brief: audit 2's note N3 (Play loads ahead, and its load starts a play), taken into this change by the coordinator.

**Verdict: PASS, 0 red, 1 note.** The pass is for `f354dd5` as it stands; see N1 before merging.

## What changed since `5da6363`

`git diff --stat 5da6363 f354dd5`: `src/features/feed/Feed.svelte` (1 line plus a comment) and `tests/browser/feed-controls.test.ts` (the no-fetch journey). Nothing else; `5da6363` is an ancestor of `f354dd5`, and the live-state file was added and removed again.

- `a.button.play` now carries `data-sveltekit-preload-data="off"`, with the comment "Opening the game counts a play, so it never loads ahead of a press."
- The journey "a swipe or a pointer resting on a clip, its name or Play asks the server for nothing…" hovers Play and sends `touchstart`, `touchend` and `mousedown` on it, as it already did for the name.

## What ran

| Check | Result |
| --- | --- |
| `pnpm lint` | exit 0 |
| `pnpm typecheck` | exit 0, 0 errors, 0 warnings (after removing the browser run's `.svelte-kit/cloudflare*` build leftovers, which svelte-check otherwise reads; not part of the branch) |
| `pnpm test` | 128 files, 1,886 tests, all passed |
| `pnpm test:browser tests/browser/feed-controls.test.ts tests/browser/feed.test.ts --project tablet --project computer` | 42 passed |
| The no-fetch journey, `--repeat-each=5`, tablet and computer | 10 passed, none flaky |
| WebKit (`phone` profile) | not run: no WebKit in this container; CI runs it |

Mutation: `data-sveltekit-preload-data="off"` removed from `a.button.play` (it inherits the body's `"hover"`). The journey failed on tablet and computer: asked `["/g/tiny-game-58b30052/play/__data.json"]`, expected `[]`. Put back with `git checkout`; nothing committed.

## Red

None.

## Notes

- **N1. The branch now conflicts with `main`.** #321 (glass) merged at 16:42:57 UTC, and `git merge-tree` of `main` (`2381058`) with `f354dd5` conflicts in `src/features/feed/Feed.svelte`, in the `.sound` rule, as audit 1's N2 and audit 2's N1 foresaw. The resolution keeps the shape on this branch (`.sound` is the round 48px button) and takes `main`'s look: `background: var(--glass-bg)`, `-webkit-backdrop-filter: var(--glass-filter)`, `backdrop-filter: var(--glass-filter)`, keeps `color: var(--chalk)`, and drops `background: var(--felt-deep)` and `opacity: 0.8`. A conflict-resolved merge makes this PASS stale: the merge commit needs its own re-check, which should confirm the speaker shows the glass (no test checks it yet; add the speaker to the glass check there).
- Audit 2's notes on #323 (the clip link is still draggable on a computer) and WebKit stand.
