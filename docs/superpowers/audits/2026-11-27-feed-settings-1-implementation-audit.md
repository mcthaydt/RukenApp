# Feed settings and learned feed unit D: implementation audit, round 1

- Pull request: #405, "Feed settings: Your feed, More / Less like this, and Good pick"
- Commit examined: `45ced1c85151e74ae17185bceeb9a8f0cbc4f93e` (branch `claude/project-thread-eij1zi`, `main` at `16f8996` merged in)
- Lane: 3 (migration `prisma/migrations/20261127004603_your_feed`), with lane 2 paths (`prisma/schema/`)
- Brief: `docs/superpowers/specs/2026-11-22-learned-feed-design.md` unit D (D1 to D7, sections 4.1, 6.1, 6.2, 10.1) and the PR's acceptance criteria; owner rules in `docs/superpowers/progress.md` and project memory
- Reviewer: fresh session, Opus 5.5, medium
- Written: 2026-11-27 01:37 UTC

**Verdict: FAIL, 2 red, 4 notes.**

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## What ran

| Check | Result |
|---|---|
| `pnpm lint` | exit 0 |
| `pnpm typecheck` | exit 0, 0 errors 0 warnings (2279 files) |
| `pnpm test` | 157 files, 2255 tests passed |
| `pnpm test:pg` (local Postgres 16) | 53 files, 801 tests passed |
| Journeys locally: `your-feed`, `feed-controls`, `cookie-consent`, `me`, `feed`, `fits-the-screen` on phone, tablet and computer | 167 passed, **6 failed** (all `fits-the-screen.test.ts:79` and `:98`, every device) |
| Same two `fits-the-screen` tests on `main` at `16f8996`, same container | 6 of 6 passed |
| CI quick run 45922092165 on the head | attempt 1: shard 3 failed (`feed-controls.test.ts:293` [phone, WebKit]); attempt 2 (failed pieces rerun, for evidence only, not as green): shard 2 failed (`fits-the-screen.test.ts:79` [phone]: view 39, expected 0) |
| Probe (scratch, not committed): `/settings/feed` overflow at phone 375×667, tablet, computer 1280×720, and 320×568 | below |

The container has no WebKit and no Docker, so "phone" ran in Chromium at the iPhone SE's size (same as the builder). WebKit evidence comes only from CI.

Probe, `document.body.scrollHeight - clientHeight` (the screen's view; the page itself was 0 everywhere):

| Device | Empty Your feed | 6 more chips + 2 less chips | At 320×568 |
|---|---|---|---|
| phone 375×667 | 206 px | 457 px | 545 px |
| tablet | 0 | 0 | 545 px |
| computer 1280×720 | 131 px | 215 px | 545 px |

On a phone, the empty Your feed shows the switch, the sentence, two suggestions, Add, and "What you want to see less of"; the second Add and Start over are below the bar (screenshot at phone size, empty state).

## Red

### R1. Your account no longer fits the window

- UNIT: `src/routes/me/+page.svelte` (the new "Your feed" line in the side links)
- VERDICT: red
- REQUIREMENT: owner, 2026-11-24 00:18 UTC: in-app screens fit the view, no page scrolling; check `tests/browser/fits-the-screen.test.ts:79` and `:98` (Your account fits down to 320×568, Delete my account in view)
- REASON: adding a sixth side link pushed Your account past the window at 320×568.
- EVIDENCE: locally on 45ced1c, `fits-the-screen.test.ts:79` fails on phone, tablet and computer at line 92 ("Expected: 0, Received: 39"), and `:98` fails on all three (received 23, 23 and 2). On `main` at `16f8996` the same six pass. CI run 45922092165 attempt 2, shard 2: the same failure at `:79` [phone]. The PR body's "Checks run" lists journeys run with `me` but not `fits-the-screen`, so this was not seen.
- EXPECTED: both tests pass on every device with the Your feed link present, with no change to the tests.
- FIX: make Your account fit again with the link on it (for example tighten the side links' spacing, or fold the new link into an existing line), touching only `src/routes/me/+page.svelte` and, if needed, the `.sidelinks` rules in `src/lib/look.css`. Name `look.css` in the body if it changes (lane 2 path). Run `fits-the-screen.test.ts` in full.

### R2. Your feed scrolls on a phone even when empty, and nothing checks its fit

- UNIT: `src/features/feed/YourFeed.svelte`; `tests/browser/fits-the-screen.test.ts` (the list of screens it checks)
- VERDICT: red
- REQUIREMENT: owner, 2026-11-24 00:18 UTC: "we shouldn't ever need to scroll, and if we do, it should still be single page but it scrolls within the view, but even then that should be rare" (quoted at `fits-the-screen.test.ts:8`); every new in-app screen is checked by that journey (`:81` lists the account screens)
- REASON: the new screen needs 206 px of in-view scroll on an iPhone SE in its emptiest state (131 px on a computer), so scrolling is the normal case, not the rare one; Start over is never on screen without scrolling. `/settings/feed` is in no fit check.
- EVIDENCE: probe above; phone screenshot of the empty state shows the second Add cut by the bar and Start over below it.
- EXPECTED: the empty Your feed (switch, sentence, both lists with their Add, Start over) fits on a 375×667 phone and a 1280×720 computer with view overflow 0; a person with many chips may scroll inside the view. `fits-the-screen.test.ts` checks `/settings/feed` empty, as it does the account screens.
- FIX: tighten the layout in `YourFeed.svelte` (for example put each list's Add on the chips' row as the spec's sketch in 6.2 draws it, and use smaller section headings), and add `/settings/feed` to the account-screens loop at `fits-the-screen.test.ts:81` (a new check, not a weakened one). Touch only those two files (and `look.css` if a shared rule must change, named in the body).

## Notes (not blocking, not fixed here)

- N1. `feed-controls.test.ts:293` "each key moves one clip, never before the first" failed once in WebKit [phone] (CI run 45922092165 attempt 1, shard 3: clip 2 stayed `data-current="false"` for 15 s after the key). It passed locally in Chromium on all three devices; the attempt-2 rerun of shard 3 was cancelled when shard 2 failed, so it is unconfirmed either way. The PR adds the ••• button, the Good pick card and a fixed "Got it." line to `Feed.svelte`, but for a signed-out visitor (this journey) only an empty `<p role="status">` (display none) and the GoodPick wrapper render. Record it under "Flaky tests" in `progress.md` if the full run shows it again; if it fails twice in a row, it becomes red.
- N2. The Good pick card (`GoodPick.svelte`) is never drawn by any test or shot: today every viewer is the crowd, so the journey answers through the API with a seeded ask (the PR body says so). The service side is unit tested (`ranker.test.ts` "Good pick?"). Its screen (frosted card over the clip, Yes/No, moving on) must be walked and shot when unit A makes a viewer `full`; carry that into unit A's brief.
- N3. The PR body says the purge clears "others' rows naming them or their games"; that holds for `FeedTaste` (`deletion.ts`, covered by `purge.pg.test.ts:450`), but other people's `GoodPickAsked` rows about a leaving maker's games stay (the games stay too, renamed). Those rows are the asker's own and name no person, so no rule is broken; word the body exactly.
- N4. "Settings › Your feed": there is no `/settings` page yet (it 404s), and the link sits on You. That matches the owner's 00:43 UTC note that the You-to-Settings move waits for member pages; nothing to fix now.

## What checked out

- D1: schema and migration match the spec, additive only (`migration.test.ts`); the CHECK `FeedTaste_kind_columns` ties a maker row to its maker and a game row to its game, tested in `taste.pg.test.ts:146`; cascades on user and game.
- D2: ••• writes a `game` row, never for the person's own game or a game that is not live (`taste.pg.test.ts:130`, journey).
- D3: chips, suggestions, Add, ×, Start over asking once with Start over in red and Cancel; Start over deletes the person's `FeedTaste` and `GoodPickAsked` rows only and sets `feedResetAt` (`taste.pg.test.ts:198`, journey). `ClipView` does not exist yet (unit B).
- D4: `ask` passes through only for a `full` viewer, only when the clip is on the page, and only when `GoodPickAsked` was newly written; answered once (`taste.pg.test.ts:219`, journey 409).
- D5: the journey covers create, read, update (switch, direction move) and delete of chips, a second account can neither see nor remove them, and a teen's feed is locked.
- D6: `askingFor` returns crowd when Learn is off (`feed-public.test.ts`); off hides chips and •••, refuses new chips with 409; on again forgets; anyone under 18 or of unknown age is locked.
- D7: `/settings`, `/api/feed/taste` and `/api/feed/good-pick` are gated; with no cookie yes the APIs answer 403 and no ••• shows (journey). The Good pick write on the open `/` and `/api/feed` routes only happens for a signed-in caller, which needs consent, and the write guard stays on otherwise.
- Ordering stays private: the public code only keeps rows and decides who is `full`; nothing here reorders the feed.
- Settings live under Settings (`/settings/feed`), not on the Me page. Sheets and the "Got it." line use the glass tokens; busy presses show the spinner only; no new `<style>` in a route; no underlined links; copy is plain.
- PR body: starts with the attribution lines, has "## Lane" and "## Acceptance criteria", names the changed existing test, ends "Requested by **McThayDT**".
