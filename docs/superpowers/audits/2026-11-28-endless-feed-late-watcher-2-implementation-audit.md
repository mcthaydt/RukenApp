# Endless feed, late watcher: implementation audit 2

- Pull request: #448, `claude/project-thread-85sv54`
- Commit examined: `805ce42` (round 1 examined `6df05c4`; the only new commit is `805ce42`)
- Lane: 2 (`src/features/feed/Feed.svelte`, shared by every feed tab). One fresh review.
- Reviewer: fresh session, Opus 5.5, medium. Written 2026-11-28 06:59 UTC (from `date`).
- Verdict: **FAIL: 1 red.** R1 and R2 from round 1 are fixed in the code and the notes, CI is green, and nothing else changed. The one red is in the pull request's body only (R3): it does not name the existing journey this round changed. The fix needs no new commit.

## What changed since round 1

`git diff 6df05c4 805ce42`: two files only.

- `tests/browser/feed-controls.test.ts`, the journey "Back from a game opened past the first page…" (`:462`): it now routes `**/api/feed?*` behind a promise, swipes to the spinner, waits until `section.more` is at least 90% in view, and only then lets the page through. This is round 1's probe B in shape, and the same hold "the feed never ends" (`:1124`) uses. What the journey checks after that is unchanged. `openFeed` does not wait on `/api/feed` (the first page comes with the page itself), so the hold cannot stall the opening; requests after the release go straight through, so Back is not held either.
- `docs/superpowers/progress.md`: the wrong sentence "This is the same order the `:438` entry's trace showed" is gone from the `:1113`/`:1111` entry (R2). The `:438` entry now says its cause was found: the journey's own race, with the CI run and the 27 ms timing, and says the entry's earlier guess was wrong (R1's progress note).

`Feed.svelte` is the same as at `6df05c4`, which round 1 found right.

## What ran

Locally, in Playwright's own image (`mcr.microsoft.com/playwright:v1.63.0-noble`; phone = WebKit, tablet and computer = Chromium), local Postgres 16, at `805ce42`, `--retries 0`:

| Run | Result |
| --- | --- |
| `:462` alone, `--repeat-each 5`, all three devices | **15 of 15 pass** |
| The whole `feed-controls.test.ts`, `--repeat-each 2`, all three devices | **192 of 192 pass** (3.6 min) |

CI on `805ce42` (run 46118558247, quick draft): `verify`, `postgres`, all six browser shards and `gate` green; `commit-authors` and `pr-rules-run` green. Phone (WebKit) ran in shard 2 (job 140897738606): `:462`, `:1124` and `:1208` passed on phone, 32 passed in that shard. No retries on a pull request run.

## Other checks

- UI: not touched since round 1 (no `src/` change), so no new overlap measurement; round 1 ran `controls-overlap` at 320×568, 375×667 and 667×375 on this `Feed.svelte`, all passing.
- CRUD: the change adds and touches nothing a user makes.
- The test edit itself is sound: it changes the journey's steps (it holds a network answer), not what it asserts. But the PR body does not name it (R3).

## Findings

**R3**
UNIT: PR #448's body.
VERDICT: red.
REQUIREMENT: `review` skill, Checks and reviews: "A pull request that changes or deletes an existing test, golden or `verify` step names each one and why in its body."
REASON: `805ce42` changes the existing journey `tests/browser/feed-controls.test.ts:462` "Back from a game opened past the first page…", and the body never names it.
EVIDENCE: the body read at 06:59 UTC names only the new journey (`:1208`) and "the feed never ends"; no line mentions `:462`, "Back from a game opened past the first page", or the hold.
EXPECTED: the body names that journey and why it changed: it now holds the next page until the spinner is on screen, because unheld the page the feed asks for on opening could land before the swipe (CI on #448, run 46115550409, tablet, 27 ms); its assertions are unchanged; and this is the cause of the `:438` Flaky tests entries.
FIX: edit PR #448's body only, through the hook-checked route, keeping the attribution first lines and "Requested by **McThayDT**". No file changes, so this audit's other results at `805ce42` still stand; a reviewer re-reads the body and posts the verdict on `805ce42`.

## Notes (not blocking, carried from round 1)

- N1 (round 1): a person who swipes back up from the spinner to the last clip just as the page lands, with the watcher late, is still moved forward. Predates this change; no report shows it.
