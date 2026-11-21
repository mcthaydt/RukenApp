# Slice 2, the rest (units S, R, F, P): implementation audit, cycle 1

**977e7a5 FAIL: 2 red, 6 notes**

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

- Commit examined: `main` at `977e7a5` (2026-11-20, `date` at writing: 2026-11-20T23:55Z). Lane 1 (this file); each fix takes the lane of what it touches.
- Brief: the plan `docs/superpowers/plans/2026-11-15-slice-2-rest.md` as it stood at `2f1bde5^`, and `docs/superpowers/specs/2026-11-17-game-page-and-play-shell-design.md` on `main` (its 2026-11-20 amendment, the Owner's Bento / Store sheet / RKN pick, wins over the plan's older words where they differ).
- Units on `main`: S (#194, dc96dc9), R (#206, c7f14bb), F (#218, bb16ec1), P (#231, d7e95ba), plus later changes to the same screens: H decision day (#219), A Accepted screen (#228), round 1 restyle (#226, #230), #233, #234, #238.
- The plan has this audit wait on unit G. G is not done (red 1); the code was audited now, at the coordinator's request.
- This file belongs at `docs/superpowers/audits/` in the repo; the reviewer wrote it to the project files, and the fix session commits it.

## What ran, on 977e7a5, in this session's container

| Check | Result |
|---|---|
| `pnpm test` (unit) | pass: 111 files, 1,596 tests |
| `pnpm test:pg` (local Postgres 16) | pass: 42 files, 636 tests |
| `pnpm typecheck` | pass: 1,820 files, 0 errors, 0 warnings |
| `pnpm lint` | pass |
| `pnpm test:browser` | not run here. CI's full run on d2ee8ba (same app code as 977e7a5, which only changes `.claude/hooks/rules.json`) passed all 6 browser pieces; the longest took 17m38s (shard 1), under the plan's 30-minute line. CI on 977e7a5 itself was still running at audit time |

## Plan against `main`

- **S, Task 30 (review command).** `POST /jobs/review`: 404 without the secret, two-space JSON, `readReviewOrder` refusals word for word, `plays_on` refused (R), `kind` on `waitingGames`, `reviewLook` writes no session, `firstGameStaff`. Journeys: Review Focus 1, 2, 3 each have a case in `review-job.test.ts`. H changed `accept`'s and `sendBack`'s answers for decision day (`acceptSays`, `decided`): an approved later change, consistent with the route. Met.
- **S, Task 31 (take off, put back).** `takeOff` writes the row first (state, `livePullId` null, pending dropped), then deletes `files/<publicId>/`, keeps clips; the action catches a failed delete and lands on Taken off. `putBack` never sets `live`; `deleteLeftFiles`; `filesLeft` asks the bucket only for `taken_off`; `hasAny` in the R2 and memory stores. Question line and Taken off words as planned ("Put it back on Ruken copies…" is round 1's approved wording). Review Focus 4 to 7 covered in `take-off.pg.test.ts` and `take-off.test.ts`. Met.
- **R, Task 26.** No `plays-on` question or route, every new game `phone_and_computer`, null filled on send, old `plays_on` send backs still read "Where it plays" (`send-back.ts:48`). Met.
- **F, Tasks 20 to 23.** `/g/<game>`: cost lines word for word (spec 3.4), price from `PREMIUM_PRICES_CENTS`, Join for non-members only, sitting line from 20 counted plays, device line with tablet by coarse pointer, Made by / More from only with a maker page, `<name> · Ruken`, arrival remembered. `/g/<game>/play`: sandboxed frame, no referrer, no name, token not in the address; 429 page; `/join` "Not now" back to the game. Beats: `attention.ts`, `POST …/beat` (400/204/429/410/404), architecture rules for `.browser.ts` entries. Task 23: `pay.test.ts` records the maker from a real link, last arrival wins. The first-time Menu line is gone and the tab reads RKN: both are the Owner's 2026-11-20 amendment (spec line 211, line 207), and the spec's criteria now say "No line shows beside the tab". Met except red 2.
- **P, Task 25.** Migration `20261120082539_shows_player_count` is the one `ADD COLUMN … DEFAULT false` with its comment line; `setShowsPlayerCount` owner-only, the action checks `live`; `playersThisWeek` counts distinct signed-in member and free plays with an attentive beat in 7 days, never staff, own or anonymous; switch is a plain form. Met.
- **G, Task 24.** Not done. Red 1.

## Findings

### Red 1: no real game has been sent, accepted and played on the test site (unit G)

UNIT: unit G, Task 24 (no repository file).
VERDICT: red.
REQUIREMENT: the plan's goal ("one real game is sent, accepted and played on the test site") and Task 24 Step 7: "Slice 2's row is "done" only when every unit is merged, `main` is green and Steps 3 and 4 passed."
REASON: G was never run; the project stopped before it, and the games domain's A7, A8 and A9 (a game played on its `g-<id>.ruken.dev` address) are also unchecked.
EVIDENCE: old `progress.md` at `c8c21e5^`: "G, a real game on the test site | not built (project stopped)" and "Not checked yet: A7 and A8 … and A9". Nothing on `main` since records it.
EXPECTED: Task 24 Steps 1 to 5 pass on ruken.io with the games domain (use the games-domain spec's section 5 for Step 1 and Step 4's addresses), recorded in `progress.md` with which game was used.
FIX: the coordinator sends the Owner Task 24's lines (O-A is done: the GitHub app was moved to ruken.io on 2026-11-20). No code unless a step fails; a failure is its own small pull request, test first, in the lane of what it touches.

### Red 2: More from is ordered by when the live files were copied, not by acceptance

UNIT: `src/features/games/service.ts:1364` (`moreLiveGamesBy`).
VERDICT: red (small).
REQUIREMENT: spec 3.2, "Their other live games, newest accepted first, at most 6", which spec 10 makes a criterion ("Made by and More from show only as 3.2 says"); the plan's interface says the same.
REASON: it orders by `livePull.createdAt`, the time the maker's newest live copy was made. An older game whose update was copied and accepted today jumps ahead of a game first accepted yesterday, and with decision day a copy can be days older than its yes.
EVIDENCE: `orderBy: { livePull: { createdAt: "desc" } }`. F's review raised it as a note ("order More from by acceptance date", old `progress.md` follow-ups); no test pins the order.
EXPECTED: newest accepted first, by the date the game first went live (its first accepted review that took effect; for a held yes, its decision day).
FIX: order by that date in `moreLiveGamesBy`, with a `service.pg.test.ts` case where copy order and acceptance order differ. Files: `src/features/games/service.ts`, `tests/features/games/service.pg.test.ts`. Lane 2.

### Notes (recorded, not fixed here)

1. `src/routes/make/[game]/+page.server.ts:149`: "Asked on a screen of its own, because it cannot be undone." Since S, taking off can be undone by Put it back. A comment only.
2. `src/routes/g/[game]/play/beat/+server.ts`: the body is read whole (`request.text()`) before the 1,000-byte check. The answer is right (400); the cap could come first (`content-length`, or reading at most 1,001 bytes). Carried from F's review.
3. `putBack` (service.ts:903): if the copy passes and `sendForReview` then refuses, the new files sit in the bucket and Taken off shows "Some of its files are still on Ruken." with Delete them, which is not why they are there. Unlikely (takeOff clears `toFix`, and the clips are kept). A taken-off game's question pages also still open and refuse on save ("That can't be changed right now."), from M (`askedQuestion` 404s only for `live`).
4. Carried open, unchanged on `main`: the drag flag can swallow one Enter after a drag (F review); the menu at 568 by 320 and the lone More from card on a tablet (#233 review); `gate.ts` comments still call the workers.dev address current (W audit N1); `LiveGame.playsOn` follow-up is done (no longer selected).
5. The slice end (end-to-end walk, design rounds, screens page, Owner's walk, retrospective) was skipped by the 2026-11-20 wrap-up. It is the next stage after these fixes and red 1, not a finding against the code.
6. Graphify's index is at `c8c21e5` and does not resolve the games service's inner functions (`liveGameBySlug`: "unresolved symbol"); callers were found by text search instead.

`pnpm lint` on 977e7a5: pass (eslint clean; "All matched files use Prettier code style!").
