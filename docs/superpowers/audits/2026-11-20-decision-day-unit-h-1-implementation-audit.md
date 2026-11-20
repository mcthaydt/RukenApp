# Decision day, unit H: implementation audit, cycle 1

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

- **Examined:** PR #219 at `8626f34`, against its base `main` at `bb16ec1`. Lane 3 (`cloudflare/`).
- **Brief:** `docs/superpowers/specs/2026-11-20-decision-day-design.md`, sections 1 to 3, 5.1, 7 (unit H), 9.
- **Reviewer:** a fresh session, Opus 5.5, medium. Finished 2026-11-20 05:24 UTC (from `date`).

## Verdict

**2 red, 1 red test gap, 4 notes.** Not ready to merge until R1 to R3 pass.

## What ran here, at 8626f34

- `pnpm test`: 108 files, 1566 tests pass.
- `pnpm test:pg` on a local Postgres 16: 41 files, 618 tests pass (the 17 new decision day tests included).
- `pnpm typecheck` and `pnpm lint`: clean.
- A throwaway repro test for R1 (below), added to `decision-day.pg.test.ts` and removed again: it fails as described.
- Not run: browser journeys, the Cloudflare cron under `wrangler dev`. CI on the PR was still running when this was written.
- Graphify's index is at `bb16ec1` and did not resolve the service's inner functions, so `GameReview` readers were found by text search: every reader outside the review command and the release is in `service.ts` and now uses `tookEffect` (lines 698, 1057, 1181; the name answer at 745 reads `ownGame`'s filtered reviews).

## Checked and passing

- The hourly cron: `wrangler.jsonc` has both crons, `crons.js` maps `"0 * * * *"` only to `/jobs/decision-day` and `"17 9 * * *"` to purge and money, an unknown or missing cron throws, `worker.js` knocks only on the cron's paths. `tests/wrangler.test.ts`, `crons.test.ts` and `purge-job.test.ts` cover it. The PR records the cron limit (Workers Free, 5 per account).
- Seat accounting: a seat is a held yes with no outcome whose game has not changed since (`seatsTaken` uses the same `lapsed` test as the release). A lapse after a new answer, a new video, a changed rating or new files frees the seat; a send back takes none; two yeses at the last seat give one seat (test at line 202).
- Updates and games that were live before bypass seats: `standingsOf` marks a live game `update` and a game with a yes that took effect `back`; `holdOrNot` returns at once for both and the at-once yes sets `acceptedSeenAt` when null (F5). Tests at lines 223 and 250.
- The release: oldest first, one transaction per day under the lock, `applied` and `lapsed` outcomes, the day's row with its seats, a second run changes nothing (tests 287 to 352).
- Makers read only decisions that took effect: a held yes leaves the address following the name and `addressStays` false; a held send back shows nothing to fix (test at line 116).
- `DECISION_DAYS_TEST_OFF`: refused when set to anything but `on`, and when `BETTER_AUTH_URL` is https. But see R2.

## Findings

### R1. A yes made while a day goes out is held for that gone day, and the game is stuck

- **UNIT:** `src/features/games/service.ts`, `holdOrNot` (about line 516).
- **VERDICT:** red.
- **REQUIREMENT:** spec section 2, "One lock (F6)": "Inside it, a hold picks the first decision day after now that has no `DecisionDay` row"; section 1.1; section 9, "A decision made at or after the moment, or while that day is going out, goes out the next decision day." Plan step 1 also asks for the test "a yes made while a release runs is held for the next day".
- **REASON:** `holdOrNot` picks the day with `nextDecisionDay(now())` *before* it takes the lock, and never checks for a `DecisionDay` row. A yes that starts just before noon and waits on the lock while the release runs is written with `goesOutOn` set to the day that just went out. No release ever sends it (that day has a row), and `standingsOf` keeps reporting it as held, so the Owner's next `accept` or `send-back` gets "You already decided" for good, until the maker happens to change the game.
- **EVIDENCE:** repro test: clock at 16:59:59Z on Friday 27 November; a transaction takes the lock and writes the 27 November `DecisionDay` row; `accept` is called and blocks; the clock moves to 17:00:01Z and the transaction commits. Result: `accept` returned `{"held":true,"day":"2026-11-27","seats":2,"taken":1}`; a release on 4 December said "Friday 4 December went out: 0 got in, 0 went back."; the game stayed `waiting`. The plan's test for this case is missing from `decision-day.pg.test.ts` (the test at line 214 only covers a yes made after noon, with no release running).
- **EXPECTED:** the yes is held for Friday 4 December.
- **FIX:** in `holdOrNot`, take the lock first, then pick the first decision day after `now()` that has no `DecisionDay` row (read `now()` after the lock too). Read the game's state, waiting pull and `changedAt` after the lock as well (today `waitingOf` reads them before it), so the standing is judged on what the lock protects. Add the plan's pg test (the repro above is a fair shape for it). Files: `src/features/games/service.ts`, `tests/features/games/decision-day.pg.test.ts`.

### R2. The test-only switch accepts addresses that only start like this machine's

- **UNIT:** `src/features/games/services.ts`, `scheduleFor` (line 49).
- **VERDICT:** red.
- **REQUIREMENT:** the PR's own rule for the new setting ("refused unless the site is on this machine, like `LAUNCH_TEST_SWITCH`") and `.env.example`'s line; `build`'s rule that code reuses what the codebase already has.
- **REASON:** it checks `own.startsWith("http://localhost") || own.startsWith("http://127.0.0.1")`. `http://localhost.example.com`, `http://localhostfoo.net` and `http://127.0.0.1.nip.io` all pass, so a site reached at such an address would quietly skip decision day. `LAUNCH_TEST_SWITCH` uses `isThisMachine` in `src/features/launch/now.ts:15`, which parses the URL and compares the host exactly. There is also no test of the switch at all (no test file mentions `DECISION_DAYS_TEST_OFF` or `scheduleFor`).
- **EVIDENCE:** `"http://localhost.example.com".startsWith("http://localhost")` is true; `grep -rn DECISION_DAYS_TEST_OFF tests` finds nothing.
- **EXPECTED:** the switch is refused for any address whose host is not exactly this machine, with a test for `on` on localhost, `on` on an https site, `on` on `http://localhost.example.com`, and a value other than `on`.
- **FIX:** export `isThisMachine` from `now.ts` (or move it to a small shared file) and use it in `scheduleFor`; add a unit test. Files: `src/features/games/services.ts`, `src/features/launch/now.ts`, a new or existing unit test under `tests/features/games/`.

### R3. The review command's new words have no test

- **UNIT:** `src/routes/jobs/review/+server.ts`.
- **VERDICT:** red (test gap).
- **REQUIREMENT:** plan, unit H step 1: "a route test ... for `list`, `look`, `accept` and `send-back`'s new words and kinds"; spec section 2's answers.
- **REASON:** the route builds "N of M seats are taken for Friday 27 November.", "X gets in on Friday 27 November. 8 of 10 seats are taken.", "X goes back to its maker on ...", the 409 for `CONFLICT`, and `decided` in `list` and `look`. None of it is tested: `tests/browser/review-job.test.ts` is unchanged and runs with decision day off, and the pg tests stop at the service (only the seat refusal's message is checked, at line 142).
- **EVIDENCE:** `git diff bb16ec1 8626f34 --stat` lists no change to any review route test; `grep "gets in on\|seats are taken for" tests` finds nothing.
- **EXPECTED:** a test that fails if any of those answers, the 409 status or the `decided` field changes.
- **FIX:** move the route's sentences into pure functions beside `dayWords` and unit test them, and add one check that `CONFLICT` maps to 409 (or test the route handler with a stand-in service). Files: `src/routes/jobs/review/+server.ts`, `src/features/games/review.ts` or `seats.ts`, their unit tests.

## Notes (not blocking, for the record)

- **N1.** `saveClip` sets `changedAt` in its own write before the clip upsert, not in the same write (spec F12 says "in the same write"). If the upsert fails, a held decision lapses with nothing changed. It fails safe, so it is only a note. `service.ts:280`.
- **N2.** `decisionDaysDue` returns every Friday since the first day, so each hourly run opens one locked transaction per past Friday just to find its row (about 52 a year, growing). Cheap now; one query for the days that already have rows would keep it flat. `seats.ts:181`, `service.ts:993`.
- **N3.** With `DECISION_DAYS_TEST_OFF=on` in every journey, no browser journey runs with decision day on. Unit A's journey ("after a release, the maker ... sees the Accepted screen") will need a way to turn it on for one run; worth naming in A's brief.
- **N4.** `standingsOf` is returned from `createGamesService` but nothing outside the service calls it. `service.ts:1386`.

## Follow-ups outside this change

None found.
