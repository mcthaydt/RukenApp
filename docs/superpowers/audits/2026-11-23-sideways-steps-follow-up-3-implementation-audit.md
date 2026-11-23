# Sideways steps follow-up, implementation audit 3 (re-point after main merge)

Pull request: #366. Examined head: `4fe2380` (4fe23800397e28a43de6697f13cd2b35c15b59aa). Prior audit: cycle 2 at `9b88015`, PASS. Lane 2. Reviewer: Opus 5.5, medium. Written 2026-11-23 15:32 UTC.

## Verdict

**4fe2380 PASS**

No red findings. One note.

## The PR's own diff is unchanged

- `4fe2380` is one merge commit on top of `9b88015`: `git log 9b88015..4fe2380` lists only main's commits (#362, #363, #333) and the merge. It has no conflict markers and no hand edits of its own.
- Merge bases: `9b88015` with the old main is `c0d05cc`; `4fe2380` with main is `509aa6e` (main's head when examined).
- `git diff c0d05cc 9b88015` and `git diff 509aa6e 4fe2380`, with `index` and `@@` lines dropped, are byte-identical (sha256 prefix `5a6686a4f8ddadda` for both). Same 10 files, 229 insertions, 46 deletions. So the cycle 1 and 2 code reviews stand.
- Files both main and the PR touch: `docs/superpowers/progress.md`, `src/lib/look.css`, `tests/browser/bar.test.ts`. Each merged cleanly into separate hunks.
- `git ls-tree -r --name-only 4fe2380 docs/superpowers/live/` lists nothing.

## Interaction with #333 (landing page) and #363 (feed)

- `/about` is now first in `NO_BAR` (`src/routes/+layout.svelte:41`). The PR's new sideways rule is scoped to `:root:not(:has(nav.bar)) .screen` and `.screen .acts`. `src/routes/about/+page.svelte` has no `.screen` or `.acts`, so the right-edge Back/Save column and its padding never reach the landing page. The `about.test.ts` journeys pass at this head (below).
- The PR's wide-frame rule (`@media (orientation: landscape) and (max-height: 449px) and (max-width: 699px)`) only matches `.screen main > form:has(> [data-frame="wide"])` and `.vframe[data-frame="wide"]`; neither appears in #333's 875 new lines of `look.css`.
- #363 changed `src/features/feed/Feed.svelte`. The feed always shows the bar, so `:root:not(:has(nav.bar))` is false there; the PR does not touch Feed.svelte.

## Checks run at 4fe2380

- `pnpm install --frozen-lockfile`: ok.
- `pnpm lint`: exit 0. `pnpm typecheck`: exit 0, 0 errors, 0 warnings. `pnpm test`: 149 files, 2162 tests passed.
- `playwright test tests/browser/bar.test.ts tests/browser/sideways-phone.test.ts tests/browser/about.test.ts` on phone, tablet and computer against local Postgres 16: 117 passed, 21 skipped, 0 failed (2.9 min). WebKit is not installed in this container, so the phone project ran on Chromium at the iPhone SE size; CI's phone project is the WebKit evidence.
- CI on `4fe2380` when examined: `verify (quick, draft)`, `postgres (quick, draft)`, `commit-authors` and `pr-rules-run` succeeded; browser shards were still running.

## Note (not blocking)

- N1: The PR body's "Open" section still says "`/about` joins the no-bar list in `bar.test.ts` once #333 lands." #333 already added `/about` to that check (`tests/browser/bar.test.ts`, the "no bar where the game or a step has the whole screen, or on the landing page" test). The line can be dropped from the body; no code change needed.
