# Tap to open feed video: implementation audit 4

- Branch: `claude/project-thread-74qnu2`. Commit examined: `ff8d9ee`, the merge of `main` (`2381058`, which brought #321's frosted glass) into audit 3's head `4ac6843`.
- Lane 2 re-check of a conflict-resolved merge, Opus 5.5, medium (the session that wrote audits 2 and 3). Audited 2026-11-22 17:02 UTC (from `date`).

**Verdict: PASS, 0 red, 0 new notes.**

## The resolution

Compared with git's own merge of `4ac6843` and `2381058` (`git merge-tree --write-tree`, conflict markers left in), `ff8d9ee` differs in two files only:

- `src/features/feed/Feed.svelte`, the `.sound` conflict: keeps `background: var(--glass-bg)`, `-webkit-backdrop-filter: var(--glass-filter)` and `backdrop-filter: var(--glass-filter)` from `main`, keeps `color: var(--chalk)`, and drops `background: var(--felt-deep)` and `opacity: 0.8`. This is the resolution audit 3's N1 asked for. Every other line of the merge is git's own.
- `tests/browser/feed-controls.test.ts`: the speaker journey now checks the speaker's computed `backdrop-filter` contains `blur(` (audit 3's N1: the speaker joins the glass check).

## What ran

| Check | Result |
| --- | --- |
| `pnpm lint` | exit 0 |
| `pnpm typecheck` | exit 0, 0 errors, 0 warnings |
| `pnpm test` | 129 files, 1,929 tests, all passed (now including #321's `tests/lib/glass.test.ts`) |
| `pnpm test:browser tests/browser/feed-controls.test.ts tests/browser/feed.test.ts --project tablet --project computer` | 42 passed |
| WebKit (`phone` profile) | not run: no WebKit in this container; CI runs it |

Mutation: both `backdrop-filter` lines removed from `.sound`. The speaker journey failed on tablet and computer: expected `/blur\(/`, received `"none"`. Put back with `git checkout`; nothing committed.

`main` has moved since the merge (`c3c4d68`, #330); `git merge-tree` of `c3c4d68` with `ff8d9ee` has no conflict.

## Red

None.

## Notes

Audit 2's notes on #323 (the clip link is still draggable on a computer) and WebKit stand. No new notes.
