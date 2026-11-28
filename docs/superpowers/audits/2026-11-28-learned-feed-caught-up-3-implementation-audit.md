# Learned feed caught-up line: implementation audit 3 (main merge)

PR #440, examined at 1c5f29a56ce477a3a6eb39cc24a05f69c64d6b2a (1c5f29a), the merge of main (93f0bc6, with #435 friend
bubbles and e611fe7 first-open tips) into bb299c3. Lane 2. Reviewer: Opus 5.5, medium. Fresh session. Written 2026-11-28 03:01 UTC.
Prior audit: 2026-11-28-learned-feed-caught-up-2-implementation-audit.md, bb299c3 PASS. Scope: the merge resolution only.

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## Verdict: FAIL (1 red, 2 notes)

## What ran (at 1c5f29a)

- `git show --remerge-diff 1c5f29a`: one conflict, `src/features/feed/Feed.svelte` in the sideways block. The builder
  kept #440's `.caughtup + .hints` rule and main's `.side` comment, and dropped #440's old "under the bar" comment,
  which main's `.side` block replaced. The textual resolution is correct.
- Playwright 1.63 in Playwright's own image (`mcr.microsoft.com/playwright:v1.63.0-noble`, WebKit for phone), `--retries 0`:
  - `controls-overlap.test.ts`: phone 2/2 passed, tablet 2/2 passed; computer 2 skipped by the test itself.
  - `feed-caught-up.test.ts`: phone, tablet, computer passed. It measures the line against every control at
    320×568, 375×667 and 667×375: no overlap.
  - A review probe (not committed; copy in project files `audits/2026-11-28-learned-feed-caught-up-3-probe.test.ts.txt`):
    the line and the first-open tips on the same first clip, measured at the three sizes. Failed on all three profiles.
- PR CI at 1c5f29a: all 12 checks green (quick draft run).
- Not run: `pnpm test`, lint, typecheck locally (CI's verify job ran them green at this head).

## Red 1: upright phone, the first-open tips cover the caught-up line

UNIT: `src/features/feed/Feed.svelte`, styles for `.hints` in `@media (orientation: portrait) and (max-width: 499px)`.
VERDICT: red.
REQUIREMENT: the brief's "a line to read, never in the way", and the standing rule that nothing floating sits on another
(owner, 2026-11-27 23:12 UTC; the merge carries it).
REASON: a semantic conflict git did not flag. Before the merge the upright tips stood at 38% down, so only sideways needed
`.caughtup + .hints`. Main (e611fe7) moved the upright phone's tips up to `top: calc(0.75rem + var(--size-target) + 0.75rem)`,
the same top as `.caughtup`, and nothing pushes them down when the line is there. The tips are z-index 3, the line 2, so
the tips hide it.
EVIDENCE: probe, line box vs tips box, all three profiles alike:
- 320×568: line {x 63.5, y 72, w 193, h 43.9}, tips {x 12, y 72, w 196, h 116.4}: overlap.
- 375×667: line {x 91, y 72, w 193, h 43.9}, tips {x 12, y 72, w 251, h 96.1}: overlap.
- 667×375: line ends at y 115.9, tips start at y 116: no overlap.
Screenshot: project files `audits/2026-11-28-learned-feed-caught-up-3/probe-375x667.png` (the line peeks out from under the tips).
When it happens: the tips show once per device and the line follows the account's plays, so a returning adult on a new
phone whose first page starts on seen games gets both on clip 0. #440 already planned for this case sideways.
EXPECTED: on clip 0 with both showing, the tips stand under the line at every size, with no overlap.
FIX: in the narrow-portrait media block, add `.caughtup + .hints { top: calc(0.75rem + var(--size-target) + 0.75rem + <line height + gap>); }`
(the sideways rule uses 3.5rem over its base). Add a regression to `tests/browser/feed-caught-up.test.ts` (or a new
journey) that shows the line and the tips on the first clip and measures them apart at 320×568, 375×667 and 667×375.
Files: `src/features/feed/Feed.svelte` and that test only.

## Notes (not blocking)

1. Sideways, the gap between line and tips is 0.1px (115.9 vs 116). Not an overlap, but the two glass boxes touch. A
   little more room would read better.
2. `feed-caught-up.test.ts` only checks the line against controls; floating tips are not controls there, which is how
   this slipped past a green CI.
