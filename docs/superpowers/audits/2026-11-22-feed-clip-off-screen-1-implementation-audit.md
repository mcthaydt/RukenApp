# Feed clip off screen (#325): implementation audit, round 1

Reviewed: `27665e4` (head of `claude/project-thread-8e4lco`, `main` merged in). Lane 2, one fresh review. Reviewer: Opus 5.5, medium.

**Verdict: PASS. 0 red, 2 notes.**

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## What was checked

- Diff against `main` (`git diff origin/main...27665e4`): three files, `src/features/feed/Feed.svelte` (+11), `tests/browser/feed-controls.test.ts` (+87/-10), `docs/superpowers/progress.md` (+3). Matches criterion 5; the 100-copy loop from `695a72d` is gone.
- The fix, read against the whole of `Feed.svelte` at `27665e4`.
- The 100-copy proof: run 45035900385 at `695a72d`, conclusion success; browser shards 1, 2 and 3 each log "Running 113 tests using 1 worker" then "113 passed" with no flaky line (100 copies plus the file's other journeys). `695a72d` changes only the loop line (`for (let copy = 0; copy < 100; ...)`).
- The journey's check is not weakened: the line-96 predicate is the same; it gains a message and a `.catch` that rethrows with the clip log, so a failure still fails.
- The PR body names the test edit and why (review skill: a changed test is named).
- Conflict with #323 (`7c6b49a`): #323 changes only `overscroll-behavior: contain` to `none` in `Feed.svelte`'s styles. A trial merge of #323 into `27665e4` is clean (no conflicted files), and an overscroll rule does not touch media events.

## Is it sound for real players

- **No fight with a person's own start.** Nothing on the page lets a person start a clip directly: the `<video>` has no controls, `tabindex="-1"` and `aria-hidden`. A press on a clip goes through `pressClip`, which only adds to `started`; the effect still plays only `index === current`. The handler pauses only when `index !== current` at the moment the `play` event runs, which is exactly the case the effect already pauses. For the clip on screen it does nothing.
- **Fast swipes back and forth.** `current` is read when the event runs, not when it was queued. B started then left before its `play` event arrives: the handler pauses B, which the effect has already done; a second `pause()` is harmless. A left then returned to before a stray `play` arrives: `current === A`, the handler does nothing, A plays.
- **No loop.** `pause()` fires `pause`, not `play`; the handler sets no state, so the `$effect` does not rerun from it; and it does not rewind, so it cannot cause the WebKit restart it answers. `loop` restarting the clip on screen fires no `play` (no pause in between), and that clip is current anyway.
- **Sound and controls unaffected.** `muted` is still set only in the effect from `soundOn`; the sound button, keys and Share are untouched. The play/catch fallback to quiet play is untouched.
- **Svelte 5 binding.** `onplay` on `<video>` is a plain element listener (`play` does not bubble and is not delegated), attached per clip with its own `index`.

## Findings

UNIT: `src/features/feed/Feed.svelte`, `stopIfOffScreen`. VERDICT: note. REQUIREMENT: none broken; the journey title says other clips "wait at their start". REASON: a clip WebKit restarts by itself is paused where it is, a few milliseconds past its start, not at 0. EVIDENCE: the handler only pauses (by design, to avoid a second rewind); the log shows the stray play 16 ms after the pause. The effect rewinds it again on its next run (`currentTime > 0`), and the line-96 check reads only `paused`. EXPECTED: unchanged; a few milliseconds is not visible to a person, and the next swipe rewinds it. FIX: none here.

UNIT: `#325` checks. VERDICT: note. REQUIREMENT: lane 2 merges on green plus this review. REASON: CI at `27665e4` was queued, not finished, when this audit was written. EVIDENCE: `gh api repos/mcthaydt/RukenApp/commits/27665e4/check-runs`: every browser shard, postgres, verify and commit-authors "queued". EXPECTED: green at the head that merges. FIX: the merging session waits for it; nothing to change in the code.

## Not run here

- `pnpm lint`, `pnpm typecheck`, `pnpm test` and the browser journeys were not run in this container; CI runs them at `27665e4`. WebKit (the phone profile) cannot run in this container.
