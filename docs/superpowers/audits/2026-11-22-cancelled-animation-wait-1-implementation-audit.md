# Implementation audit: a cancelled animation no longer breaks the screenshot wait (#327), round 1

Examined: `ed3a118` (head of `claude/project-thread-8e4lco`). Lane 2 (`tests/browser/`, shared journey support). Reviewer: fresh session, Opus 5.5, medium.

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## Verdict: PASS

No red findings. One note.

## Acceptance criteria

| # | Criterion | Result | Evidence |
|---|---|---|---|
| 1 | Without the fix a cancelled animation fails the wait with the AbortError; with it the wait goes on | PASS | Repro below, run here in Chromium (Playwright's bundled build). |
| 2 | Diff against `main` is only `look.ts` and `progress.md` | PASS | `git diff --stat $(git merge-base origin/main ed3a118) ed3a118` and `git diff --stat origin/main...ed3a118`: 2 files, +5 −2. The five edit-page commits and their five reverts cancel out. `git merge-tree --write-tree origin/main ed3a118` merges clean (main is 9 commits ahead). |
| 3 | Lint, typecheck, full browser run green | Not judged here | CI run 45042637911 on `ed3a118` was queued when this audit was written. Merge waits on it as usual. |

## What the change does, checked

- `animation.finished.catch(() => undefined)` per animation, inside `Promise.all`. Before, `Promise.all` rejected at the first cancelled animation and the journey failed. Now each cancelled one settles at once and `Promise.all` **still waits for every other animation** to finish. The repro shows it: with a transition cut off at 100 ms and a separate 1500 ms animation running, the old wait threw at once and the new wait resolved after 1496 ms. A plain 1000 ms animation with nothing cancelled resolved after 1011 ms (old) and 1011 ms (new): the wait is not shortened.
- Hides no real failure: under the Web Animations spec the `finished` promise rejects only when the animation is cancelled (always with an `AbortError` DOMException); there is no other rejection path. A cancelled animation has stopped, so the screen is at rest as far as that animation goes.
- Weakens no check: `showTheOwner` compares nothing (its own doc comment); it only attaches a picture for the owner. The fonts wait, the infinite-animation filter, the screenshot and its narrow "Unable to capture screenshot" catch are unchanged.
- WebKit (the `phone` project, iPhone SE, runs only in CI): WebKit implements the same spec (cancel rejects `finished` with `AbortError`), and the catch takes any rejection reason, so the fix does not depend on the engine's error name or message. Not run here: this container has only Chromium (`/opt/pw-browsers`). The CI run on `ed3a118` covers it.
- Comment and `progress.md` entry match the code and the cause.

## Repro (Chromium, here)

```
old cut-off: threw Error: page.evaluate: AbortError: The user aborted a request.
old plain: resolved after 1021 ms
new cut-off: resolved after 1496 ms
new plain: resolved after 1011 ms
```

The script set a 2 s opacity transition on a button, removed its class after 100 ms (cancelling it) while a 1500 ms `element.animate` ran, and called the old and new wait bodies.

## Notes (not blocking, not fixed here)

- UNIT: `tests/browser/support/look.ts:319`. VERDICT: note. REQUIREMENT: none. REASON: the catch could test `error.name === "AbortError"` and rethrow anything else, to state the intent in code. EVIDENCE: spec gives no other rejection, so behavior would not change. EXPECTED: optional. FIX: none in this pull request.
- Pre-existing, unchanged: an animation that starts after `getAnimations()` is read is not waited for.

## CRUD

No user-made thing is added or touched. Not applicable.
