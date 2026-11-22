# Implementation audit: feed game listing (PR #246), cycle 1

Examined commit c270b11 (lane 2; spec `2026-11-21-feed-and-makers-page-design.md`, unit C tasks 1 and 4).

Verdict: c270b11 PASS. No red findings.

## Checked against the criteria
- C1: `liveGames` selects `state: "live"` with a live copy, optional maker filter, and goes through the same `asLiveGame` as `liveGameBySlug`. Waiting, sent-back and taken-off games are excluded by the where clause and tested.
- C2: `liveSinceOf` is the old `moreLiveGamesBy` rule moved, unchanged in meaning (decided time, or the decision day's `wentOutAt` for a held yes, else live copy time, earliest wins, `tookEffect` reviews only). Later yeses and take-off and put-back do not move it; both tested. No existing test was edited or deleted (diff touches only added lines in the two test files).
- C5: `makersOf` returns handle, name and photoKey per account with a page; `handlesOf` untouched; tested including a no-page account and an empty list.
- Rules: commits authored by McThayDT, no Claude trailer, live-state file removed, PR body ends with the required line, spec tasks 1 and 4 ticked. CI on c270b11: all jobs green (run 44847150984).
- Not run by me: the Postgres tests (no database in this review container); CI's postgres job is the evidence.

## Notes (not blocking, not fixed here)
1. UNIT: spec C3 text. It still says the read uses "the index on a session's game and start". `PlaySession` indexes are (userId, startedAt) and (gameId, startedAt). Fix the wording when task 2 is built; the `startedAt` bound stays.
2. UNIT: `liveGames`. It reads every live game and each one's accepted reviews with no limit. Fine now; the feed caps at 50 after ordering (C6), so watch it once the games count is large.
