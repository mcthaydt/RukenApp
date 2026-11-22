# Flaky edit-page journey (#332): implementation audit, round 2

- Pull request: #332, branch `claude/project-thread-8e4lco`
- Commit examined: `dd0c01b` (round 1 was `799a269`, audit `2026-11-22-flaky-edit-page-1-implementation-audit.md`)
- Reviewer: the round 1 review session, Opus 5.5, medium. Lane 2.
- Written: 2026-11-22 17:51 UTC

**Verdict: dd0c01b FAIL: 1 red.** Round 1's red is fixed, and the note is done well. But the new comment in `TextAnswer.svelte` breaks a unit test: `pnpm test` exits 1.

## What ran

| Check | Result |
| --- | --- |
| `pnpm lint` | exit 0 |
| `pnpm typecheck` | exit 0, 2033 files, 0 errors (after clearing this container's own build output in `.svelte-kit/`, which it had read first) |
| `pnpm test` | **exit 1**: 1 failed, 1928 passed. `tests/lib/look.test.ts` > "no screen has a style block, a style attribute or a colour" fails on `src/routes/make/parts/TextAnswer.svelte` |
| `edit-page`, `join` and `make-questions` journeys, tablet and computer | exit 0, 132 passed |
| Every journey that holds a screen (`-g "come alive"` across those three files), `--repeat-each 5`, tablet and computer | 60 of 60 passed |
| The new name journey with `TextAnswer.svelte` put back to `799a269` | fails on tablet and computer: `Received: "Slow OwlQuick Owl"` |

Not run here: phone (WebKit), which is CI only in this container.

## Round 1's red: fixed

- `TextAnswer.svelte` now reads the sent `input` or `textarea` and binds both branches to one element. It also puts the selection back in a microtask queued from `onMount`. That runs after Svelte's own one: `remove_input_defaults` (`node_modules/svelte/src/internal/client/dom/elements/attributes.js:55`) queues its "set the value again" step through `queue_micro_task` (`dom/task.js`) while the page comes alive, and that happens before `onMount` runs, so Svelte's microtask is scheduled first. If Svelte instead flushes during a sync flush, its step runs at once, which is still before. The order holds either way.
- The new journey "a saved name selected before the screen has come alive stays selected, so typing replaces it" fails without the fix and passes with it (above). It also saves and reads the name back.

## Round 1's note: done

`holdNextScreen` moved unchanged to `tests/browser/support/hold.ts`. `edit-page:417`, `join:86` and `make-questions:209` use it now. None of them is weaker: every assertion is kept. The colour journey's 3 s delay becomes a real hold, and its 30 s announcer wait goes back to the default, because nothing slows it after release. `make-questions` drops its own `unrouteAll`, which `release` now does.

## Findings

### 1. Red: `pnpm test` fails on the new comment's "#332"

- UNIT: `src/routes/make/parts/TextAnswer.svelte:38`.
- VERDICT: red.
- REQUIREMENT: the brief's criterion 3 and the `build` quality bar: the checks exit 0. The test is `tests/lib/look.test.ts`, "no screen has a style block, a style attribute or a colour".
- REASON: the comment "the one-line box in #332's review" contains `#332`. The test's colour pattern `(?<!&)#(?:[0-9a-f]{3}|[0-9a-f]{6})\b` reads it as a hex colour.
- EVIDENCE: `pnpm exec vitest run tests/lib/look.test.ts` at `dd0c01b`: 1 failed, 135 passed, with `AssertionError: src/routes/make/parts/TextAnswer.svelte: expected '<!--…' not to match /<style|style=|rgb\(|hsl\(|(?<!&)#(?:[0-9a-f]{3}|[0-9a-f]{6})\b/i`. The same line is already in `f32b5b1`.
- EXPECTED: `pnpm test` exits 0.
- FIX: reword the comment without the `#` (for example "pull request 332's review"). Change only `TextAnswer.svelte`. Do not change the test.

## Notes

1. The draft's quick `verify` job in run 45050090042 shows success, but this test fails every time here. Before merging, check that the full run's `verify` runs `pnpm test` on the final commit.
