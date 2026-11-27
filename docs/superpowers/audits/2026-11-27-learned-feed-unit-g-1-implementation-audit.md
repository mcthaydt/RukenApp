# Implementation audit: learned feed, unit G (Like, Save, Repost), round 1

- Pull request: #404, branch `claude/project-thread-njbixv`
- Commit examined: `14c77a157b49ecf50ab7d7e845094c8672881d86` (`14c77a1`), base `main` at `16f8996`
- Lane: 3 (`prisma/migrations/20261127004437_game_marks/`)
- Brief: `docs/superpowers/specs/2026-11-22-learned-feed-design.md` sections 6.1, 7 ("For every unit") and Unit G (G1, G2, G4, G5); the pull request's acceptance criteria; CLAUDE.md; the owner's standing rules.
- Auditor: a fresh session, Opus 5.5, medium. Written 2026-11-27 01:32 UTC (from `date`).

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## Verdict

**FAIL: 2 red.** The data side is sound: an add-only migration, one row per person, game and kind, the cascades, the purge and the consent gate all hold. Two things stop it: the cookie yes does not carry on to the press as G5 asks, and the "without the cookie yes" journeys fail every time on the phone, so the full run will go red.

## What ran

| Check | Where | Result |
|---|---|---|
| `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck` | cloud container | all exit 0 |
| `pnpm test` (unit) | cloud container | 156 files, 2,250 tests passed |
| `pnpm test:pg` (all database tests, with `marks.pg.test.ts` and `purge.pg.test.ts`) | local Postgres 16 | 53 files, 797 tests passed |
| `feed-marks.test.ts` [computer] | local, Chromium | all passed |
| `feed-marks.test.ts` and `feed-controls.test.ts:293` [phone], `--repeat-each 4` | Playwright's own image `mcr.microsoft.com/playwright:v1.63.0-noble`, WebKit | `feed-controls.test.ts:293` passed 4 of 4; the three "without the cookie yes" tests failed 12 of 12 (R2) |
| Audit probes (G5 path, accessible names, sizes) | local, Chromium and WebKit | see R1 and the notes |
| CI on `14c77a1`, run 45921705015 (quick, draft) | GitHub | `verify` and `postgres` passed; browser shard 3 failed on `feed-controls.test.ts:293` [phone] (see "CI failure" below), the other shards were cancelled after it |

Not run: the full browser suite on all three profiles (CI's full run does that when the pull request is marked ready).

## Checked and holding

- **Migration is add-only.** `migration.sql` creates the `MarkKind` type, the `GameMark` table, a unique key on `(userId, gameId, kind)`, an index on `(gameId, kind)` and two foreign keys with `ON DELETE CASCADE`. Nothing is altered or dropped; `tests/features/feed/migration.test.ts` checks this. It matches `prisma/schema/feed.prisma`.
- **G1.** `marks.ts` `set()` returns "own" for the maker's own game before writing anything; `createMany(... skipDuplicates)` makes two presses at once one row; the count is a `count()` of rows. The route answers 403 "This is your game." `ofClips()` makes two reads per page whatever the number of games. The maker's clip shows none of the three buttons (journey, and `own` in `ofClips`).
- **Who may press.** The route checks JSON content type (415), the body shape (400), sign-in (401), that the game is live (404) and the adults-only rule (403, the same `adultsOnlyRefusal` the wishlist uses). SvelteKit refuses a form from another site (403, journey).
- **Consent.** `/api/feed/marks` is listed as Gated in `consent/routes.ts`; `/me/saved` and `/me/reposts` are Gated by `/me`. Without `rk_consent` the route answers 403 and nothing is written (journey). The notice's words are the spec's: "To like this game", "To save this game", "To repost this game", each followed by the notice's own words (`Notice.svelte`, `cookies/+page.server.ts` `FOR`).
- **Purge.** `deletion.ts` deletes the person's marks and every mark on their games inside the purge transaction; the cascades back it up; `purge.pg.test.ts` passed.
- **G2.** Saved and Your reposts list live games, newest first (`orderBy: madeAt desc`), each a link to `/g/<slug>` and a bin button (`aria-label="Remove <name>"`, 48 × 48 px measured on a 375 px wide screen). Empty lists say what to do.
- **CRUD (G4).** Create: each of the three from the feed. Read: after a reload and on both lists. Delete: Repost from its list, Like and Save from the feed, and the empty Saved list afterwards. A mark has nothing to update (it is on or off). See N3 for the one remove path no journey presses.
- **Owner rules.** Custom icons (inline SVG), frosted glass discs (`--glass-bg`, `--glass-filter`, `--glass-edge`), no underline (`.game` and `.go` have `text-decoration: none`), no spinner and no "Loading" text (presses show at once and go back on failure), 48 px discs (`--size-target`, measured 48 px wide), plain words. No `<style>` block in a route file. Nothing private (no ordering or weights) is in the change.
- **Pull request body.** Starts with the attribution lines, has "## Lane" and "## Acceptance criteria", names every changed test and why, ends "Requested by **McThayDT**".

## Red findings

### R1

- UNIT: `src/features/feed/Feed.svelte` (`press()`), with `src/routes/api/feed/marks/+server.ts`
- VERDICT: red
- REQUIREMENT: spec Unit G, G5: "'I agree' carries on to sign in or to the press." The same spec's 6.1 sends a press to the clip it was made on.
- REASON: after "I agree" the person lands on the feed's first clip with nothing pressed, and a signed-out press goes to sign in and comes back to the feed's first clip with nothing pressed; the press is lost both times.
- EVIDENCE: audit probe on `14c77a1` [computer]: with no cookie yes and signed out, pressing Like opened `/cookies?for=like&next=%2F`; after "I agree" the page was `http://localhost:4173/` and no row was written. With the cookie yes and signed out, Like went to `/sign-in?next=%2F`. `press()` hard-codes `next=/` in both `goto` calls. The journey's G5 test (`feed-marks.test.ts:172`) only checks that the notice opens and that a direct POST answers 403; nothing checks what "I agree" does next. The wishlist already carries a signed-out press through sign-up and makes it (`src/routes/g/[game]/wishlist/+server.ts`, the `rk_wish_pressed` cookie and its `GET`).
- EXPECTED: after "I agree", a signed-in person's press is made; a signed-out person goes on to sign in, and once signed in the press is made. Either way they come back to that game, with the button showing the press.
- FIX: carry the press (game and kind) through the notice and sign-in, the way the wishlist does, and make it once on the way back; add journey steps: no consent, signed in, press Like, "I agree", the like is kept; and no consent, signed out, press Save, "I agree", sign in, the save is on Saved. Files: `src/features/feed/Feed.svelte`, `src/routes/api/feed/marks/+server.ts` (or a sibling route under `/api/feed/marks/`, which the Gated pattern already covers), `tests/browser/feed-marks.test.ts`.

### R2

- UNIT: `tests/browser/feed-marks.test.ts:166-187` ("without the cookie yes") on the phone profile
- VERDICT: red
- REQUIREMENT: the journeys pass on the three devices (CLAUDE.md Settings, device matrix; Verification). The pull request body says the phone profile did not run.
- REASON: on the small phone the cookie card covers Like, Save and Repost, so the journey's click never lands, every time.
- EVIDENCE: Playwright's WebKit image, `--project phone --repeat-each 4`: all three tests failed 12 of 12 with `locator.click: Timeout 5000ms exceeded` and "`<p>We save a few small things in your browser…</p>` from `<aside class="consent above-bar">` subtree intercepts pointer events". The same three tests pass on computer. Screenshot of the phone feed with no cookie yes: the card's text and buttons sit over the side column from Like down to Share.
- EXPECTED: the three journeys pass on phone, tablet and computer, pressing the buttons the way a person on that phone can.
- FIX: in the journey, take the path a person has on a small phone: press the card's "Not now" (it stores nothing and keeps the cookie no), then press the mark; or make the marks reachable above the card. The journey change alone is enough for this finding. Files: `tests/browser/feed-marks.test.ts`, and `Feed.svelte` or the consent card's styles only if the second way is chosen.

## CI failure on `14c77a1`

Browser shard 3 of 6 (quick, draft), job 140253700855: `tests/browser/feed-controls.test.ts:293` "each key moves one clip, never before the first" [phone] timed out at line 309 (clip 0 stayed `data-current="false"` for 15 s). The test is unchanged by this pull request, and the change adds no key handling. In Playwright's WebKit image it passed 4 of 4 on `14c77a1`. `progress.md` records this test failing the same way before (fixed at its cause in an earlier round). Not caused by this change as far as the evidence goes; it needs a rerun, and if it fails again it goes under "Flaky tests" in `progress.md`. Not a finding against this pull request.

## Notes (not blocking, not fixed here)

- N1. Screen readers never hear the like count: the button's name is always "Like" (`aria-label`), and the count under it is `aria-hidden`. Probe: name "Like", word "1". Something like `aria-label="Like, 1 like"` once a game has likes would let them hear it.
- N2. `/me` now calls `liveGames()` twice per load (once for Saved, once for Your reposts, inside `listOf`) only to decide whether to show two links. One read, or a count of live marked games, would do.
- N3. The Remove button on Saved has no journey of its own; the journey presses Remove only on Your reposts (same component, a different route file). The save itself is deleted in the journey from the feed, so G4 holds; a press on Saved's Remove would cover `me/saved/+page.server.ts`'s action.
- N4. On the phone, the Saved row's name and line sit indented from the heading with a wide gap between them (screenshot at 375 × 667). Small, and a design round may want it tighter.
- N5. Share is now the only round button in the column without a word under it. The spec asks words only for Like, Save and Repost, so it holds; the design round may want them to match.
- N6. The cookie card overlapping the feed's own buttons on the phone (R2) already happens with Play and Share on `main`; the very transparent glass makes the overlap hard to read. It is outside this change; worth a look in the polish pass.

## Probes

The probe tests this audit ran are not committed. Copies are in the project files under `audits/2026-11-27-learned-feed-unit-g-1-probe.test.ts.txt`.
