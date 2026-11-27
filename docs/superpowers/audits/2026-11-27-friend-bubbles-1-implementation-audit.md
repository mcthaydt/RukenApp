- Current task: lane 2 review of PR #435 (friend bubbles), Opus 5.5, medium.
- Last commit reviewed: 3624269 (non-layout parts); layout waits for the builder's small-phone change.
- Next step: review the new head's layout (small phone, sideways phone, gamepad), then post the verdict.
- Open decisions: none.

# Friend bubbles: implementation audit 1 (draft)

Reviewer: fresh session, Opus 5.5, medium. Lane 2.

## Done so far at 3624269

- `friendsWhoLiked` (src/features/feed/marks.ts): tagged-template `$queryRaw`, every value bound as a parameter (`${viewerId}`, `${[...gameIds]}` as text[]); no injection path.
- Mutual only: joins MakerFollow both ways and MakerPage; self-follow is refused in follows.ts ("own"), so the viewer never shows. Postgres test covers one-way both ways, viewer, no page, saves/reposts.
- Speed: EXPLAIN ANALYZE on a copy of the three tables with 200k likes (one game 50k), 1,100 follows by the viewer, 100 mutual: the planner starts from the viewer's followers (MakerFollow_makerId_idx), then point lookups; 1.65 ms.
- Checks run: pnpm lint 0, pnpm typecheck 0, pnpm test 2414/2414, pnpm test:pg 831/831 (Postgres 16, local).

## Findings so far

1. UNIT: docs/superpowers/live/claude-project-thread-cu5tvs.md. VERDICT: red. REQUIREMENT: CLAUDE.md "Live state in a file": the session deletes the file in its last commit before it hands the branch to the audit, and reads the commit from git rev-parse. REASON: the file is in the head under review and its "Last commit" line says "see git log". EVIDENCE: `git diff origin/main...3624269 --stat` lists it. EXPECTED: not in the diff. FIX: delete that file only.
