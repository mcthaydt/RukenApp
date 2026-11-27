# Maker credit and Follow a maker: implementation audit 4 (re-point after main merge)

Pull request #400. Examined head `73ce2f9` (73ce2f9dabc5d500e5ad9fbdec4eb62d327a4c66), a merge of `658447c` (audit 3 PASS) with main at `c7d3ad6` (#406, the clip crops smoothly as it moves). Lane 3 (a migration). Reviewer: Opus 5.5, medium. Written 2026-11-27 02:50 UTC.

**Verdict: 73ce2f9 PASS.** The merge brings in only main's change; nothing of the pull request moved.

## What was checked, and how

- `git diff --stat 658447c 73ce2f9`: 3 files, 179 insertions, 0 deletions: `docs/superpowers/progress.md` (+2), `src/lib/look.css` (+24), `tests/browser/feed-to-game-grow.test.ts` (+153, new). This equals `git diff --stat 16f8996 c7d3ad6` (merge base to main) line for line.
- `src/lib/look.css` and `tests/browser/feed-to-game-grow.test.ts` at `73ce2f9` have the same blob ids as at `c7d3ad6`: main's files, unchanged.
- Every file the pull request changes (36 files, `git diff --name-only 16f8996 658447c`, progress.md set aside) is identical at `658447c` and `73ce2f9`: `git diff --name-only 658447c 73ce2f9 -- <those files>` prints nothing. No pull request file changed in the merge.
- `progress.md` conflict resolution keeps both sides: against `658447c` it adds only main's "The clip move crops smoothly" row and main's `feed-controls.test.ts:809` flaky entry; against `c7d3ad6` it differs only by the pull request's own row and its two flaky-entry extensions (`:836` seen again on #400, `:438` seen on phone). No conflict markers (`grep -c '<<<<<<<\|>>>>>>>'` = 0).
- Interaction with the feed card's maker credit: main's new rules target only `::view-transition-image-pair(clip)` under `html[data-move="grow"]`. The `clip` name is put on the element matched by `[data-grows]` (`src/lib/page-moves.ts:58`, `:107`), which in `Feed.svelte` (`:393`) is the clip's `<video>`. The maker credit lives in `.side` > `.credit` (`Feed.svelte:484`, `:487`), outside the named element, so the new `overflow: clip` and corner rounding apply to the video's snapshot only and cannot cut the credit, the plus or Share. `page-moves.ts` is untouched by the pull request (`git diff 16f8996 658447c -- src/lib/page-moves.ts` empty).

## Not run here

- No tests were run in this session. CI on `73ce2f9` was running when this was written (quick draft checks: browser shards queued and in progress). The new `feed-to-game-grow` journey now runs against the pull request's feed card for the first time; its result is CI's to show, and a merge waits for green as usual.

## Findings

None red. No notes.
