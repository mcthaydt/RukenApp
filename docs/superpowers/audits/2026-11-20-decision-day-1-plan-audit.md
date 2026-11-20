# Plan audit, cycle 1: decision day and the weekly seats

- **Examined:** `docs/superpowers/specs/2026-11-20-decision-day-design.md` at `ae622ff` (branch `claude/project-thread-8yfid9`, pull request #204).
- **Against:** the Owner's words recorded in the spec's section 0; `main` at `dc96dc9`; the #193 plan (`docs/superpowers/plans/2026-11-15-slice-2-rest.md`, Units R, F, P); #195 at `0582f7e` (`docs/superpowers/specs/2026-11-17-game-facts-design.md`, Units L, K, Q, V and the `firstLiveAt` hand-off); the Accepted screen handover patch (`/mnt/project-files/handover/2026-11-20-accepted-screen-and-rate-wip.patch`, which `git apply --check` applies cleanly to `ae622ff`).
- **Lanes:** D lane 3, H lane 3, A lane 2, as the spec says. The lanes are right.

> Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## Verdict

**Red: 10 red findings, 6 notes.** D cannot start yet: findings 2, 3 and 5 change what D stores. The Owner's words are recorded faithfully (500 a week at most, growing every 3 months; the label's floor of 20), the seat numbers check out (10 × 1.5ⁿ rounded half up gives 10, 15, 23, 34, 51, 76, 114, 171, 256, 384, then 500 at step 10, 30 months), and the three open cards are marked where they land. The reds are about what a held decision does to code on `main` that already reads `GameReview`, what a maker can still change while a decision is held, and ordering against the other open units.

## Red findings

### 1. Held and lapsed reviews read as real decisions on `main`

- UNIT: section 4 (`GameReview.goesOutOn`), unit H (`service.ts`).
- VERDICT: red.
- REQUIREMENT: 5.1, "nothing is given away early"; 2, "the maker is told nothing about a decision that lapsed".
- REASON: the spec stores a held decision as an ordinary `GameReview` row, but several readers on `main` treat every row as a decision that took effect, and the spec does not change them.
- EVIDENCE: `src/features/games/service.ts:477` (`ownGame` reads any `accepted` review) and `:525` freezes the address once one exists; `:798` `everLive` is any `accepted` review, and `src/routes/make/[game]/[question=question]/+page.server.ts:173` shows it to the maker as `addressStays` on the name question, so a held yes changes what the maker sees before decision day. `:814` and `:891` `sentBackLast` read the newest review whatever it is. The table is add-only, so a lapsed yes stays `accepted` forever and keeps freezing the address of a game that never went live.
- EXPECTED: every reader of `GameReview` counts only decisions that took effect (an at-once decision, or a held one that went out and was applied).
- FIX: spec section 4 defines "a decision that took effect" (with finding 2's record) and lists the readers H changes: `ownGame`, `gameSelect`/`makerView` (`everLive`, `sentBackLast`, `partsToFix`), `gamesOf`. H's step 1 adds a test that a held yes leaves `addressStays` false and the address following the name. Files: the spec only.

### 2. Nothing records whether a held decision was applied or lapsed

- UNIT: section 4 (D), section 3 (the release), 5.2 and 5.3 (A).
- VERDICT: red.
- REQUIREMENT: 5.2 "the measured count of that day's yeses"; 5.3 "the measured rate"; the release's answer "8 got in".
- REASON: after a day goes out, a lapsed decision and an applied one look the same: both are a review whose `goesOutOn` names a day with a `DecisionDay` row. The game's later state cannot tell them apart.
- EVIDENCE: spec lines 66 to 70 define only "held" (no `DecisionDay` row yet); line 57 says a lapsed decision is skipped but writes nothing for it; `GameReview` is add-only, so the release cannot mark the row.
- EXPECTED: the count of a day's yeses, the rate and "was live before" (finding 4) read only applied decisions.
- FIX: D adds one add-only record written by the release for each applied decision (for example `GameReview` gains nothing and a new `ReleasedReview { reviewId @unique, day }`, or the release writes a `lapsed` row instead; either one, stated in section 4). Section 3 says the release writes it in its transaction; 5.2 and 5.3 count from it. D's step 1 adds the schema test. Files: the spec only.

### 3. A held decision does not lapse when the maker changes anything but the files

- UNIT: section 2, "A maker changes a waiting game"; the release (section 3).
- VERDICT: red.
- REQUIREMENT: 2, "a held decision applies only to the files and answers it was made on".
- REASON: the lapse test is only "the waiting pull changed", but on `main` a waiting game takes every answer and new videos without a new pull.
- EVIDENCE: `service.ts:492-498`, `saveAnswer` accepts every question for a `waiting` game (name, line, rating, an 18+ game's marks, other websites, repository); `service.ts:182-198`, `saveClip` refuses only a `live` game, so a waiting game's videos are replaced in place; `src/routes/make/[game]/check/+page.server.ts:36` says a change to a waiting game "is saved at once". So the Owner can say yes to a game rated 16+ with one video, the maker can change the rating and both videos on Saturday, and on Friday the release puts that live with no person's look.
- EXPECTED: any change by the maker to a waiting game after a decision makes that decision lapse.
- FIX: D adds `Game.changedAt` (timestamptz, null), written by `saveAnswer`, `saveClip` and `pullLatest` for a waiting game; a held decision lapses when `changedAt > decidedAt` or the pull differs; seats taken (section 4, line 70) use the same test. H's step 1 adds a test for a changed rating and a changed video. Files: the spec only.

### 4. "A game that was live before" is not defined, and a put-back game looks new

- UNIT: section 1 (what is not held), section 2, unit H.
- VERDICT: red.
- REQUIREMENT: 1, "a game that was live before (taken off and put back)" is decided at once and uses no seat.
- REASON: on `main` a put-back game is in state `waiting` and the review command calls it a `game`, not an `update`, so a plain reading holds it and takes a seat; and with findings 1 and 2 an `accepted` review no longer proves it was live.
- EVIDENCE: `service.ts:663-667`, `putBack` calls `sendForReview`, which writes `state: "waiting"` for anything not live (`:344`); `src/routes/jobs/review/+server.ts:57` and `waitingGames` (`service.ts:711`) set `kind` from `state === "live"` only.
- EXPECTED: one stated test for "was live before": it has a decision that took effect as a yes (finding 2), or `firstLiveAt` is set once K is on `main`.
- FIX: section 2 states the test and that `list` and `look` call such a game `"kind": "back"` or keep `game` with no seat (the spec's choice); H's step 1 already tests a put-back yes, and names the test it uses. Files: the spec only.

### 5. The Accepted screen would show for a put-back game

- UNIT: 5.2, D's migration, A.
- VERDICT: red.
- REQUIREMENT: 5.2, "a game that was live before ... never show it".
- REASON: D sets `acceptedSeenAt` only for games live when it merges, and nothing sets it for an at-once yes; a game taken off before D merges, or put back later, opens on Accepted.
- EVIDENCE: spec line 92 ("D's migration sets `acceptedSeenAt` for games already live"); `takeOff` (`service.ts:628-645`) leaves no live state, so a `taken_off` game has none to match.
- EXPECTED: Accepted shows only for a game that a release made live for the first time.
- FIX: D's migration sets `acceptedSeenAt` for every game with an `accepted` review, whatever its state; the at-once yes writes `acceptedSeenAt` when null; 5.2 states the show rule. D's and A's step 1 test a taken-off-then-put-back game. Files: the spec only.

### 6. Holding, the seat count and the release can race

- UNIT: section 2 (`accept`), section 3, unit H.
- VERDICT: red.
- REQUIREMENT: 9, "a yes ... with no seat left ... is refused"; "every held decision for that day takes effect together".
- REASON: the spec takes no lock. Two yeses at once can both see 9 of 10 and take an 11th seat; and a yes made at 11:59:59 that commits after the release has read that day's decisions is left on a day that already has its row: never applied, yet `accept` refuses it as "already decided", so the game is stuck until a later spec.
- EVIDENCE: section 3, line 57 (one transaction for the release only); section 4, line 67 (held means "no `DecisionDay` row yet"); `accept` on `main` (`service.ts:363-383`) uses a plain transaction.
- EXPECTED: seats never exceed the day's number; a decision is held for a day only if that day has not gone out when it commits.
- FIX: hold and release both take `pg_advisory_xact_lock` on one fixed key; inside it, a hold picks the first decision day after now that has no `DecisionDay` row, counts seats, and writes. H's step 1 adds a `pg` test for two yeses at the last seat and for a yes against a running release. Files: the spec only.

### 7. The release picks the latest missed day, not the oldest

- UNIT: section 3.
- VERDICT: red.
- REQUIREMENT: section 3, "a missed day goes out the next time the job runs".
- REASON: line 56 picks "the latest decision day whose moment has passed and that has not gone out": with two missed days, the later one goes out first and the earlier an hour later, out of order, and each `DecisionDay` row's `wentOutAt` disagrees with its order.
- EVIDENCE: spec lines 56 and 59.
- EXPECTED: every due day goes out, oldest first, in one run.
- FIX: section 3 says "each decision day whose moment has passed and has not gone out, oldest first, each in its own transaction", and the answer names each; H's step 1 tests two missed days. Files: the spec only.

### 8. H's order misses R, F, P and K, which change the same files

- UNIT: section 7, H's "Waits on".
- VERDICT: red.
- REQUIREMENT: `staged-path`, Splitting: "no two running units own the same file".
- REASON: H owns `service.ts`, `review-order.ts` and the review route; the spec keeps it apart only from Q.
- EVIDENCE: plan `2026-11-15-slice-2-rest.md` lines 37 to 40 and Task 26: R changes `review-order.ts` (refuses `plays_on`), `service.ts` (`LIVE_MAY_BE_SENT_BACK`, `startGame`) and the review job's tests; F and P change `service.ts` (Task 25: `setShowsPlayerCount`, `liveGameBySlug`); #195 K changes `service.ts` (`firstLiveAt` in the yes, line "service.ts (the answers and reads, `firstLiveAt` ...)"). `progress.md` shows R, F, P not started, so all can overlap H.
- EXPECTED: H runs alongside none of R, F, P, K, Q; whichever starts second starts from a `main` holding the other. D likewise with P and K (already stated).
- FIX: H's "Waits on" cell names R, F, P and K beside Q, with the shared files. Files: the spec only.

### 9. The rate's definition differs between the spec and the patch A starts from

- UNIT: 5.3, unit A, the handover patch.
- VERDICT: red.
- REQUIREMENT: 5.3; "A takes it as a starting point ... and changes the query to count a held decision only from its decision day".
- REASON: 5.3 says each game counts "by its first decision that has gone out" with "yeses over all such games", which reads as the first decision's outcome; the patch counts a game as in "if any decision on it was a yes" (a game sent back, fixed and then let in counts as in). The floor of 20 is counted inside the 90 days in the patch, which the spec does not say. A is told to change only the held part, so it would ship a definition the spec does not state.
- EVIDENCE: spec lines 100 to 103; patch `acceptance.ts` lines 4-5 and the query (`bool_or("decision" = 'accepted')`, `WHERE "firstDecided" >= since`), and its test "Sent back twice, then let in: one game, and it got in".
- EXPECTED: one definition, the same in 5.3, the patch and A's tests, counting only decisions that took effect (findings 1 and 2).
- FIX: 5.3 states: a game counts once, dated by its first decision that took effect, in the last 90 days; it got in if any decision that took effect was a yes; the floor counts the same window (the patch's choice, recommended), or the other reading, as a call the Owner may overrule. Files: the spec only.

### 10. H changes an existing check and names a test that cannot run as written

- UNIT: unit H, step 1 ("A worker test").
- VERDICT: red.
- REQUIREMENT: `review`, "A pull request that changes or deletes an existing test ... names each one and why"; CLAUDE.md, "A change does not quietly edit its own check".
- REASON: the daily-only cron is pinned by an existing test, which the spec does not name; and nothing on `main` runs `cloudflare/worker.js`'s `scheduled` (it imports the built site), so "the hourly cron knocks only on `/jobs/decision-day`" has no harness.
- EVIDENCE: `tests/wrangler.test.ts:160-162` expects `crons` to equal `["17 9 * * *"]`; the worker tests there read the file as text (`:164-179`); no test calls `__scheduled`.
- EXPECTED: the spec names `tests/wrangler.test.ts` as changed and why, and the cron-to-jobs choice is a check that runs.
- FIX: H puts the cron-to-paths table in a small pure module beside `worker.js` (an unknown cron throws), unit-tested; H's owned files and its pull request body name `tests/wrangler.test.ts`. Files: the spec only.

## Notes (not blocking, recorded)

1. **Who writes the first decision day.** D owns `decision-days.json` and tests "a day's seats at the first day", but H writes the date. D should ship it with no first day (`null`: off) and `seats.ts` handle that; H writes the date in its last commit, after the Owner's approval, so "the first Friday after H merges" holds.
2. **Calendar months.** "The same date 3 months later" is undefined for 29 to 31 (30 November + 3 months). Say the date is clamped to the month's last day.
3. **5.1's line for a put-back game.** A put-back game is `waiting` but decided at once, so "We tell everyone on Fridays" is wrong for it. Show 5.1's line only for a game that would be held.
4. **A cron that fires a moment early** finds nothing due and the day goes out an hour later. Within section 9's "within the hour"; worth one line in section 3.
5. **"Cloudflare's free plan allows it"** (line 107) has no source. Cite Cloudflare's limits page for cron triggers per account.
6. **The patch is unchecked.** It applies cleanly to `ae622ff`, but typecheck and lint have not run on it (as the spec says); A's first step should run them before building on it.

## What was checked and found right

- Section 0 matches the Owner's words and card answers as recorded in project memory (500 a week at most; the label until 20).
- Seat sequence and the 2.5-year figure, computed.
- `America/New_York` with a weekday and time keeps noon across daylight saving; `"0 * * * *"` lands on 16:00 and 17:00 UTC, both noon New York.
- The `firstLiveAt` hand-off agrees with #195 section 3 ("if a later spec makes games go live on a set day after the yes, it is that write instead").
- Q's "not alongside a decision day unit" in #195 matches H's.
- D alone holds the migration, and H merging hold with release keeps a held decision from being written by a `main` that cannot send it out.
