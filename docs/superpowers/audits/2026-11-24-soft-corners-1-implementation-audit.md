# Soft corners (#397): implementation audit 1

Reviewed commit: `17d0885` (17d088508b5ff0c8b800c61b20ac506a5c05dfb3), branch `claude/project-thread-hiz4ft`. Lane 2 review, fresh session, Opus 5.5 medium.

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

Brief: the owner, 2026-11-24 18:22 UTC: "a long ease to all corner curves ... twice as far out, then melt into the edge ... soft and small buttons become nearly pill shaped ... our curved corners don't look like other people's", plus the eight acceptance criteria in the PR body.

## Verdict: PASS (0 red, 3 notes)

## What ran (on 17d0885, this container, Node 24.22.3)

- `pnpm lint`, `pnpm typecheck`: 0 errors, 0 warnings. `pnpm test`: 155 files, 2244 passed.
- Mutation of `tests/lib/corners.test.ts`: a `5px` radius and a 50% circle without `--corner: round` put into `look.css` made 2 of its 6 tests fail; restored.
- Browser journeys, phone (WebKit 26.6), tablet, computer: `corners`, `glass`, `look`, `real-buttons`, `fits-the-screen`, `feed`, `maker-page`, `edit-page`, `make-look`, `buttons`: 364 passed, 41 skipped by design, 0 failed. `edit-page` and `maker-page` cover the maker page's create, read, update and delete; the change adds nothing a user makes.
- The app run like a person (`verify` setup), sign-up and the feed, in Chromium, Playwright WebKit and Firefox 155:
  - Chromium and WebKit: `CSS.supports` true; card `superellipse(1.4)` at 40px, button 24px, bar 28px.
  - Firefox: `CSS.supports` false; fallback radii applied (card 32px, button 19px, bar 23px), plain round corners, nothing broken.
  - A card corner shot at 4x with the shape and with `corner-shape: round` forced: both engines draw the shape, which starts its curve farther out and eases into the edge; visibly different from a plain round corner (criteria 1, 2, 4).
  - The glass bar over a striped background at 4x: in Chromium the blur and the lens edge stay inside the shape, no bleed at the corner. Playwright's WebKit draws no backdrop blur here with or without the shape (a test-browser limit, same before and after), and its lens edge follows the shape (criterion 7).
  - Keyboard focus ring (Tab to the bar's middle button) follows the shape in WebKit and Firefox (criterion 7).
- CI on 17d0885 at the time of writing: verify, postgres, pr-rules, commit-authors and browser shard 5 green; shards 1 to 4 and 6 still running.

## Criteria

1. Tokens only: PASS (`tests/lib/corners.test.ts`, and it bites).
2. One shape, radii doubled: PASS (tokens 40/28/24/16/8 from 20/14/12/8/4; `*, *::before, *::after` rule).
3. Small button nearly a pill: PASS in the shape-drawing engines (24px on 48px).
4. Drawn in the journey browsers: PASS (`corners.test.ts` on all three devices; 4x shots).
5. Circles stay round: PASS (every `50%` rule has `--corner: round`; `@property --corner` with `inherits: false` keeps it off their children). The only `border-radius: inherit` (`Feed.svelte` `.band::before`) inherits from a non-circle.
6. Fallback at 75 to 85%: PASS (test; Firefox computed values).
7. Glass, edge, shadows, focus ring: PASS (`glass`, `look`, `real-buttons` journeys; shots above).
8. No layout moves: PASS (`fits-the-screen` journeys; only corner values change).

## Notes (not blocking, not for this PR unless the owner wants them)

1. UNIT: `src/lib/look.css` fallback. VERDICT: note. REASON: where the shape cannot be drawn (Firefox today) `--radius-button` is 19px, so a 48px button is a rounded rectangle, not "nearly a pill". EVIDENCE: Firefox computed 19px; 19 x 2 = 38 < 48. EXPECTED: acceptable by criterion 6 as written; the owner may want the fallback button at 24px. FIX: one number in the `@supports not` block and the 75 to 85% test.
2. UNIT: screens page. VERDICT: note. REASON: it shows no feed clip with its glass band, no game page and no maker photo, the places the circles and glass-on-video live. EVIDENCE: the artifact's eight sections. EXPECTED: the journeys above cover them by program; a picture would help the owner's look.
3. UNIT: real iPhone Safari. VERDICT: note. REASON: not measured (named in the PR). The fallback covers a Safari without `corner-shape`.
