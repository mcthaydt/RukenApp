# Plan audit 1: the feed and the maker's page

Commit examined: `dfcfd97` (branch `claude/project-thread-v9kf2k`, PR #245), the spec `docs/superpowers/specs/2026-11-21-feed-and-makers-page-design.md`. Lane 3 (unit K's migration). Read against `main` at `771d13d`; `main` moved from the spec's `e7e2577` by docs only (the roadmap and one audit file), so the spec's reads of the code still hold.

Prompt: Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

**Verdict: FAIL, 3 red, 6 notes.** The plan is sound in shape: units, order, waits and lanes hold up against the code, and almost every name it builds on exists as it says. Three things must change before execution starts. All three are edits to the spec only.

## What was checked and holds

Each read at `771d13d`:

- Names the units build on exist as described: `mayMove`, `quietVideo` (`src/lib/quiet-video.ts`); `gamesServices().media`, `deviceOf`, `backFromPaywall` (with `PLAY_ADDRESS` matching only `/g/<slug>/play`, so F1 is a real change); `moreLiveGamesBy` and its "first went live" rule (`src/features/games/service.ts:1369`), which C2 moves into a helper; `chicagoDayOf`; `liveGameBySlug`; `freeSlug`; `AgeRating.age_18`; `PlayBasis.member` (staff always get basis `staff`, `may-play.ts:25`); `pageByHandle`, `countView`, `tapLink`, `handlesOf`, `savePage`, `saveTheme`, `addLink`, `savePhoto`, `removePhoto`; `isHandleShape`, `RESERVED_HANDLES` (already holds `new`); `cropSquare`; `membershipServices().arrival.remember`; `QuestionScreen` (`src/routes/make/parts/`); `showTheOwner`, `expectOneCard`, `forgetRateLimits`, `SITE_ANSWER_TIMEOUT`, `realClip`.
- The service's refusal words in I4 match `handle.ts` and `service.ts` word for word.
- `felt-deep` at 62% is the play menu's dim (`look.css:2797`). `look.test.ts:103` is the "red is only the danger button" test F task 4 names.
- `feed` is already in `FEATURE_ORDER` above `games`, `play` and `pages` (`tests/architecture.test.ts:12`), so C6's imports are allowed. A `.svelte` file already reaches another feature only through its `.browser.ts`; D14 adds the reverse rule.
- Things that do not exist yet and are planned as new: `liveGames`, `memberBeatsByGame`, `src/lib/random.ts`, `src/features/feed/`, `makersOf`, `timesWords`, `src/routes/[handle=handle]/`, `/make/page`.
- `pnpm run deploy` runs `prisma migrate deploy` first (`package.json:16`), as section 4 says. The Playwright projects are the five sizes in Chromium and WebKit, as section 4 says.
- Waits: C and F share no file; H reads C; D reads C, F and H and shares files with each; I reads H; K adds to H and I. No two units that may run at once own the same file, except D and I on `look.css` and `look.test.ts`, which the spec handles.
- Lanes: C, F, H, D, I are lane 2 (`src/lib/`, `src/features/games/service.ts`, the layout); K is lane 3 (a migration). None touches `src/features/money/`, `src/features/membership/`, `cloudflare/` or `.github/`.
- The two open owner decisions block only F task 4 and unit I (and K6), as stated.

## Red findings

### R1. The feed's order contradicts the Owner's approved feed rules, and the plan calls the approved feed unapproved

- UNIT: spec section 3 ("Not built"), unit C (C3, C4), section 9 ("The simple order is replaced").
- VERDICT: red.
- REQUIREMENT: CLAUDE.md, "Keep to the request": a decision the Owner has made is not reopened. Roadmap slice 3 item 5: "the feed algorithm (approved): a learned feed, play time first". The Owner's go of 2026-11-20 ("Ready to launch": every slice up to launch, in order).
- REASON: C4 puts games that went live under seven days ago first, newest first, then the rest by raw member beats over seven days. The Owner's approved feed design (kept private on the Owner's words, so its rules are not repeated in this public file) settles how games are ranked, and C4's rule and C3's uncapped count do not match it on several points. Section 3 lists the learned feed under "Not built, because each needs its own approval, data or slice", but it is approved and is in this slice.
- EVIDENCE: the private feed design of 2026-11-15, sections 2, 3 and 11, compared line by line with C3 and C4 (the comparison is in the message to the planning thread, not here). Spec line 58: "The learned feed (roadmap, slice 3, item 5) ... Not built, because each needs its own approval". Roadmap slice 3 item 5: "(approved)".
- EXPECTED: the spec says plainly that unit C's order is an interim order that differs from the approved design, names where slice 3 item 5 is planned (its own spec in this slice, before the slice's end, since the walk and the screens page must show the feed that launches), and either (a) builds C's order on the approved signals that need no new data, keeping the real numbers out of the public code as the private design asks, or (b) gets the Owner's yes to ship the interim order first.
- FIX: the spec only. Correct section 3's line about the learned feed; add item 5 to section 8 as a follow-on spec in slice 3 and move the slice end after it; then either change C3/C4 to (a) or add a third open decision for (b), asked as a card with a recommendation. No code.

### R2. Unit H cannot meet its own criteria inside the files it owns

- UNIT: section 6 table, unit H's "Files it owns"; H1, H2.
- VERDICT: red.
- REQUIREMENT: `staged-path`, "Splitting": each unit owns the files its output needs, and no two running units own the same file. H2: "No wordmark header." H1: `src/params/handle.ts` matches a path only when `isHandleShape` does.
- REASON: two files H must change are not on its list.
- EVIDENCE: (1) SvelteKit 3 reads matchers from `src/params/index.ts` (`defineParams({ question: ... })`, `src/params/index.ts:6`); a new `src/params/handle.ts` does nothing until it is registered there. (2) `src/routes/+layout.svelte:16` draws the wordmark on every path except `/`, `/make*` and `/g/*`, so `/<handle>` shows it unless the layout changes; the layout is owned by unit D, which starts after H merges.
- EXPECTED: H's row lists `src/params/index.ts` and `src/routes/+layout.svelte` (the one condition that hides the wordmark on `/[handle=handle]`), and D's row says it builds on H's change to the layout.
- FIX: the spec only: section 6's table rows for H and D.

### R3. K3 names a check that does not exist

- UNIT: unit K, K3.
- VERDICT: red.
- REQUIREMENT: CLAUDE.md, "Acceptance criteria come first ... as criteria a program or a person can observe"; "A check is a test that fails by itself."
- REASON: K3 says "the drift test passes". There is no drift test.
- EVIDENCE: no test, script or workflow runs `prisma migrate diff` or compares the migrations with `prisma/schema/`: a search of `tests/`, `.github/workflows/` and `package.json` for "drift", "migrate diff" and "pg_enum" finds nothing. Test databases are built by `migrate deploy` alone (`tests/support/database.ts:54`).
- EXPECTED: K3 names a check that fails by itself, for example a case in `tests/features/pages/schema.pg.test.ts` that reads `enum_range(NULL::"PageLinkKind")` from a migrated database and expects exactly `link`, `game_elsewhere`, `social`, or a test that runs `prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema --exit-code` against the test server.
- FIX: the spec only: K3's wording and K task 2's test file.

## Notes (recorded, not blocking)

- N1. F task 4 (only if the Owner keeps the red mark) names one `look.test.ts` test, but a second also fails if the `.pip` rule sits after `main.gamepage`: "uses no pip (red) anywhere" (`tests/lib/look.test.ts:556`) checks from `main.gamepage` to the end of the file. Name both, or say where the rule goes.
- N2. I11's test reads the first-level folders of `src/routes/make/`. `parts` (components, no route) has an address's shape, so the test as written fails until `parts` is listed or folders without a route are skipped. Say which.
- N3. Found, not for this plan: the game page's "More from" row lists the maker's 18+ games (`moreLiveGamesBy` returns them; `src/routes/g/[game]/+page.server.ts:47` does not filter). The spec's 18+ Call quotes the redesign's "maker pages" and filters the feed and `/<handle>` only. Report it with found 1 to 3, or extend the Call to that row.
- N4. Section 9's "the first thing to try is a sum kept per day": one exists. `PlayDay` (`prisma/schema/money.prisma`) holds each member's seconds per game per Chicago day, capped and without staff, written by the money roll-up. C3 could read it for whole days, plus today's beats. Also, "one indexed sum" is not backed by an index: `PlayBeat` is indexed by `(sessionId, receivedAt)` and `PlaySession` by `(gameId, startedAt)` and `(userId, startedAt)`, so the planned query should bound sessions by `startedAt >= since - PLAY_SESSION_LIFE_MS`, as `rollDay` does.
- N5. K is lane 3. Name what lets it merge: the standing permission of 2026-11-20 in `history.md` ("Merge PRs yourself once CI, reviews and audits pass") with its implementation audit, and that the migration reaches the site only when the Owner runs `pnpm run deploy`.
- N6. D task 7's list of journeys that open `/` includes `connect-github`, `make-questions`, `pay` and `play`, which none of the three search strings it names finds at `771d13d`; `look.test.ts` and `look-layout.test.ts` are found and are named elsewhere in the task. The builder searches anyway; the list is a hint, not a boundary.

## Follow-ups outside this change

- N3 above.
- Found 1 in the spec (Play works before launch; no Wishlist button) stands as the spec reports it.

## Cycle 2

Commit examined: `29a7be9` (the fixes are `8b35cc8`; `29a7be9` only deletes the planner's live-state file). Read as the diff `dfcfd97..29a7be9` of the spec, against the code at `771d13d`.

**Verdict: PASS, 0 red, 1 note.**

- R1, fixed. Section 3 now says the learned feed is approved and in this slice with its own spec, and calls unit C's order an interim order that ships only on the Owner's yes (Open 3, section 8). C's tasks 2, 3 and 5 and unit D wait on it; if the Owner says wait, the struck parts are named. Section 8 puts the learned feed's spec before the slice's end. The spec still holds none of the private design's rules or numbers (a search for them finds nothing).
- R2, fixed. H owns `src/params/index.ts` and the layout's one condition (table row and task 3); D's row and task 2 build on it.
- R3, fixed. K3 names two checks that fail by themselves: an `enum_range(NULL::"PageLinkKind")` case expecting exactly `link`, `game_elsewhere`, `social`, and the migration being exactly the one `ALTER TYPE`. K task 2 writes them first.
- N1, fixed: the `.pip` rule goes with the card's rules (`.card` is at `look.css:241`, `main.gamepage` at `look.css:2318`), so `look.test.ts:556` stands. N2, fixed: I11 skips folders with no route. N3: reported as found 4. N5, fixed: K's merge names the standing permission of 2026-11-20. N6, fixed: D task 7's list is a hint and the search words are named.
- N4, partly. Section 9 now names `PlayDay`. C3 now bounds sessions by `startedAt >= since - PLAY_SESSION_LIFE_MS`, which is right, but its reason, "so the index on a session's game and start is used", is not backed: `PlaySession`'s indexes are `(userId, startedAt)` and `(gameId, startedAt)`, and a range on `startedAt` alone, across every game, does not lead either one. Note, not red: the clause is a reason, not something a check observes, and section 9 already says the sum is not measured. The builder should drop the clause or add an index in a later unit with its own lane, not assume it.
