# Review 1 of #445: keep the first-open tip off the friends' faces

Examined: `53895ef` (head of `claude/project-thread-cu5tvs`, 2026-11-28 03:19 UTC). The pull request's own code and journeys are the same as at `d0179ec`, the head named for this review: `53895ef` only merges `main` (`2b777a8`, #442) and edits `progress.md`. Reviewer: a fresh session, Opus 5.5, medium. Lane 1 by paths (one copy line, two journeys, notes).

## Verdict

**FAIL: 2 red.** The change does what it says on screen: the tip clears the friends' faces at every size, before and after launch. But CI is red on both heads, for two reasons in the pull request's own files.

## What ran

- Read the whole diff `93f0bc6..53895ef` for the pull request's 4 files.
- A probe (`/mnt/project-files/audits/2026-11-28-swipe-tip-spacing-1-probe.test.ts.txt`, not committed) measured the tip (`.hints`) against the faces (`.friends`) on the first clip at `/` and `/followed`, signed in with a friend's like, at 320×568, 375×667 and 667×375, after and before launch. Phone (WebKit) and tablet (Chrome's engine), Playwright's 1.63 image, local Postgres 16. Gap from the tip's bottom to the faces' top, in px:

  | size | after launch | before launch |
  | --- | --- | --- |
  | 320×568 | 91 | 27 |
  | 375×667 | 238 | 202 |
  | 667×375 | 119 | 67 |

  The same numbers on both engines. At 320 the tip is 3 lines (1 + 2), as criterion 2 says; at 375 and 667 it is 2. The tightest gap is 27px at 320×568 before launch, matching the builder.
- `controls-overlap.test.ts`, phone and tablet, locally: phone 2 passed; tablet failed both tests (see red 2).
- `feed-controls.test.ts -g "first open|never ends"`, phone, tablet and computer, locally: 15 passed. `:1113` "the feed never ends" passes on a database with few games, which supports the builder's reading that its local failure came from a full database. It has not run in CI on this pull request yet: the CI runs on `d0179ec` and `53895ef` stopped early on other failures.
- `prettier --check` on the 3 changed code files: `feed-controls.test.ts` fails.
- CI: run 46100371482 at `d0179ec`: `verify` failed (formatting), shard 4 failed (`controls-overlap`, phone). Run 46100692629 at `53895ef`: `verify` failed (formatting), shard 5 failed (`feed-controls.test.ts:462`, tablet, see note 1), shards 3 and 4 cancelled.

## Red

**1.** UNIT: `tests/browser/feed-controls.test.ts`, lines 970 to 972. VERDICT: red. REQUIREMENT: green CI (`verify`, the format check). REASON: the shortened words let the `expect(page.getByText(...))` call fit on one line, and Prettier wants it there. EVIDENCE: `verify (quick, draft)` on both runs: "[warn] tests/browser/feed-controls.test.ts … Code style issues found"; `pnpm exec prettier --check` locally says the same. EXPECTED: the format check passes. FIX: `pnpm exec prettier --write tests/browser/feed-controls.test.ts`; that file only.

**2.** UNIT: `tests/browser/controls-overlap.test.ts`, the `overlays` list in `overlaps()`. VERDICT: red. REQUIREMENT: green CI; criterion 1 (the journey passes with this change). REASON: on the game page held sideways, the game's own video, while it is still loading, counts as a floating box over Back. It is `position: absolute` and painted (the loading shimmer, `data-loading`), so it is listed as an overlay, and Back sits on it. It is the backdrop Back is drawn on by design, the same video whose button `.gamepage .clipopen` the journey already leaves out; it does not hide Back. Once the video has loaded the check passes, so it fails only when the video is slow. EVIDENCE: CI at `d0179ec`, shard 4, `[phone] controls-overlap.test.ts:222` "signed out": `/g/tiny-game-29c8e120 at 667 by 375, sideways, before launch` → `" / Back to the feed"`. Locally on the tablet, both tests failed the same way at `/g/<slug>` 667×375 (after launch, and before launch), and with the name printed as HTML the first box is `<video … data-loading="" …>` in `div.clipbox` in `div.cell.hero`, the second `<a class="back" aria-label="Back to the feed">`. A fresh visit to the same page measured nothing over Back after the video loaded. Not new in this pull request: the overlay rule came with #435. It blocks here because it makes this pull request's journey fail in CI. EXPECTED: the journey fails only on something a person would see covering a control. FIX: in `overlaps()`, leave the game page's video (`.gamepage .clipbox video`, the backdrop) out of `overlays`, as `.gamepage .clipopen` already is, with a comment saying why; check it with a run of `controls-overlap.test.ts` on the phone and the tablet at the reviewed head, with the video held back from loading (for example by routing its `.webm` to never answer) so the check proves it. Only `tests/browser/controls-overlap.test.ts` (and the pull request body's "Tests changed").

## Notes, not blocking here

1. `feed-controls.test.ts:462` "Back from a game opened past the first page comes back to that very clip" failed on the tablet in CI at `53895ef` (run 46100692629, shard 5, job 140842235020): at line 471 the fourth clip stayed `data-current="false"` for 15 s. It is the flake already under "Flaky tests" in `progress.md` (seen on computer and phone, line 438/447 then). This pull request does not touch it. Add this sighting (tablet, the run and job) to that entry, as the rules say for any test that failed once.
2. The tip's old words stay in two merged specs. The pull request says why (records of a decision); fine.
3. In `progress.md`, the friend bubbles row's new follow-up text was added to the last column ("not measured (short path, no plan) Follow-up …") rather than to the notes column.

## Overlap rule (the owner, 2026-11-27)

Every size and both launch states were measured for the tip against the faces: no overlap anywhere, tightest 27px. The only overlap the journey reports is red 2, which is the journey counting the game page's backdrop, not a control being covered.
