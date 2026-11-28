# Implementation audit 1: a trackpad swipe that comes while the last one coasts (PR #442)

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

- Commit examined: `3621a2c` (branch `claude/project-thread-9jsisq`). Review began at `0e7e917`; `3621a2c` only deletes the branch's live-state file (`git diff --stat 0e7e917 3621a2c`: 1 file, 7 deletions), so everything below holds for it.
- Lane 2 (`src/features/feed/`, shared by the feed's tabs). Reviewer: fresh session, Opus 5.5, medium.
- Written 2026-11-28 02:24 UTC.

## Verdict

PASS, 0 red, 2 notes.

## What ran

| Check | Result |
| --- | --- |
| `pnpm lint` | clean (Prettier and ESLint) |
| `pnpm typecheck` | 0 errors, 0 warnings |
| `tests/features/feed/tabs.test.ts` | 13 of 13 pass |
| Same file against `main`'s `tabs.ts` | 3 fail: turn back, second swipe the same way while coasting, sideways after a scroll. The held-back/summed and wobbly cases pass on both, as a guard should |
| Probe (not committed): 5,000 swipes each, `SWIPE` scaled 0.5x to 2x, dy noise of ±1 | plain timing, gaps jittered 4 to 60 ms, random runs of 1 to 6 moves summed into one (last stamp), and runs held back and handed on with one late stamp: every one of the 20,000 stepped exactly once |
| Probe: 5,000 scrolls up or down with up to ±6px of sideways noise and jittered gaps | none stepped |
| `trackpad-swipe.test.ts` on phone, `--repeat-each=12 --retries=0` (docker `playwright:v1.63.0-noble`, local Postgres 16) | 36 of 36 pass |
| `trackpad-swipe.test.ts` and `sent-to-you.test.ts` on phone, tablet and computer, `--repeat-each=3 --retries=0` | 81 of 81 pass |
| New journey "a swipe that comes while the last scroll or swipe still coasts moves at once" against `main`'s `tabs.ts` | fails on phone, tablet and computer (`aria-current` "" not "page") |
| PR quick CI at `3621a2c` (run 46096641123) | verify, postgres, 6 browser shards, gate: all success |

## Edited tests, read first

- `tabs.test.ts` "with no rest between, a turn back the other way is a swipe of its own": was `[1]`, now `[1, -1]`. This is the behaviour the owner asked for (an unresponsive swipe), not a loosened check.
- `tabs.test.ts` "that starts up and down stays a scroll, even if it drifts a little sideways later": the drift went from `[30, 0]` (clearly sideways, which now rightly starts a swipe after a scroll) to `[5, 20]` (mostly up and down). It still proves a scroll's drift does not step, and the probe above covers noisier drift.
- `sent-to-you.test.ts`: only the renamed link and empty-list words.

## Code

- `beginsAgain` (`src/features/feed/tabs.ts`): a new swipe starts only on a move of 4px or more that is twice as far sideways as up or down, and then only after a scroll, on a turn back, or when a swipe that already stepped has slowed below a third of its peak and the move is both faster (2x the slowest + 0.25 px/ms) and bigger (2x the slowest size + 4px). `speed` floors the gap at 16 ms, so moves handed on at once with one stamp are no faster than a frame. Coalesced moves keep the last stamp, so a sum is bigger but not faster. Both guards together held in the probe.
- `FeedTop.svelte` passes `event.timeStamp`, unchanged; state stays at module level, so the coast on the new tab still does not step again.
- One swipe still steps once: the `stepped` flag carries until a rest or a new beginning, and a coast cannot begin again because it never turns, never follows a scroll, and never grows faster and bigger.

## CRUD

The change adds nothing a person makes. "Friends who can't send you games" is the update and read step of the stop list, which `sent-to-you.test.ts` still creates, reads, updates (Undo) and deletes, passing on three profiles.

## Notes (not blocking)

1. UNIT: `docs/superpowers/specs/2026-11-27-games-sent-to-you-design.md:34`. VERDICT: note. REQUIREMENT: none (a merged spec records a decision). REASON: it still names the link "People you stopped". EVIDENCE: grep. EXPECTED: readers of the spec find today's words in `words.ts`. FIX: none needed here; a later doc pass may add a line.
2. UNIT: the swipe itself. VERDICT: note. REQUIREMENT: honest reporting. REASON: as the PR says, not proven on a physical Mac trackpad; every run here uses emulated wheel moves (CDP on tablet and computer, dispatched `WheelEvent`s on the phone).
