# PR #453 implementation audit, round 1: maker's page bar, Back over the clip, Join button, no notice on What we keep

Lane 2 fresh review, Opus 5.5, medium. Examined commit 7371ca8 (`7371ca8b2dd17ff24934b694396b4d9faad3822a`). The branch has since gained three `progress.md`-only commits (tip 7563947); this verdict carries to them.

**Verdict: FAIL, 1 red.**

## What ran

| Check | Where | Result |
|---|---|---|
| `pnpm lint` | 7371ca8 | 0 |
| `pnpm typecheck` | 7371ca8 | 0 (after clearing the local journey build's `.svelte-kit/output` and `.svelte-kit/cloudflare`, which are not part of the tree) |
| `pnpm test` (unit) | 7371ca8 | **1 of 2,454 failed**: `tests/lib/look.test.ts:496` (red 1) |
| Journeys: controls-overlap, cookie-consent, game-page, real-buttons | 7371ca8, tablet + computer | 107 passed, 3 skipped (computer skips the overlap walk by design) |
| Same four journeys, PR's test files on main's code | 19045c3 | 6 failed, each for the reason the PR fixes (below) |
| Journeys: maker-page, fits-the-screen, legal-pages, plain-pages, wishlist, sideways-phone, bar, glass, edit-page, follow-a-maker | 7371ca8, tablet + computer | 161 passed, 25 skipped |
| Phone project (Safari's engine) | not run here | WebKit cannot start in this container (`playwright install webkit` fails its host check). The phone results come from the PR's CI run only. |

The new checks fail on main by themselves:
- `controls-overlap` (signed out and signed in, tablet): on main, `/g/<game>` reports "Watch the video full size / Back to the feed" at 320×568 and 375×667, and the maker's page reports the bar's Home, Add a game and You over the game cards and Play (4 pairs at 320×568, 12 at 375×667).
- `cookie-consent:65`: on main the notice is on `/privacy` (expected 0, got 1).
- `real-buttons:250`: on main Join is `a.joinlink` with a transparent background.

Overlap, measured by `controls-overlap` on 7371ca8 at 320×568, 375×667 and 667×375 (Home Screen sideways), before launch and after, signed in and out, with the maker's page (2 live games) and the game page: no pair overlaps in the tablet engine. The phone engine's measurement is CI's.

## Findings

### Red 1: the Join button's new class is not one of the look's classes

- UNIT: `src/routes/g/[game]/+page.svelte` (`<a class="button join">`) against `tests/lib/look.test.ts`.
- VERDICT: red.
- REQUIREMENT: the suite exits 0 (CLAUDE.md, "A check is a test that fails by itself"); the look test's rule that every class a screen uses is one of the look's, written out plainly.
- REASON: the PR renames `joinlink` to `join` in the page and in `look.css` but not in the look test's class list.
- EVIDENCE: `pnpm test` at 7371ca8: `tests/lib/look.test.ts:496 … src/routes/g/[game]/+page.svelte: expected [ 'card', 'code', … ] to include 'join'`. The same test passes on main (141 of 141). `tests/lib/look.test.ts:390` still lists `"joinlink"`, which nothing uses any more.
- EXPECTED: `pnpm test` exits 0.
- FIX: in `tests/lib/look.test.ts`, replace `"joinlink"` with `"join"` in the game page's group of `CLASSES`. Only that file.

## Notes (not blocking)

- `src/lib/look.css:4156`: the comment over `.gamepage .playtile` still says "with Join as the last word of the cost". It is now under the cost on a row of its own.
- The PR body's fourth criterion says "What we keep (`/cookies`) or the privacy page". What we keep is `/privacy` (the notice's link, `src/features/consent/Notice.svelte:104`); the code skips both `/cookies` and `/privacy`, which is right. Only the body's wording is off.
- Join is green glass (`--glass-safe`) on the solid blue Play tile, with no backdrop of moving content behind it. White on the mix is about 8.5:1, so it reads well; this follows the brief's "filled glass button" and the existing `.consent .safe` pattern.

## Re-check for round 2

Run `pnpm test` (must exit 0) on the fix commit. A one-line test-list fix needs no journey re-run beyond CI.
