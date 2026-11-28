# Double slide after Back: implementation audit, round 2

- Pull request: #454, "A swipe made while Back slides in moves the feed"
- Commit examined: `6fe194c` (6fe194c6cd4f24470d21d99a0ab72e50349e030a)
- Lane: 2 (`src/lib/page-moves.ts`)
- Reviewer: a fresh session, Opus 5.5, medium
- Written: 2026-11-28 09:00 UTC

**Verdict: PASS.** Round 1's red (a wheel or trackpad scroll during the Back slide moved nothing) is fixed, and its new journey fails without the fix and passes with it.

## What changed since round 1

One line in `slideWhile`: `wheel` (capture, passive) now calls `skipTransition` like `touchstart` and `pointerdown`, and is removed with them when the slide finishes. New journey `tests/browser/back-then-wheel.test.ts` (computer piece only): browser Back and the arrow, wheel down and up through CDP `Input.dispatchMouseEvent`, 4 rounds each, checking the current clip, that the feed comes to rest on it, and that it has not moved 800 ms later. Progress notes updated; one flake recorded (`page-moves.test.ts:178`).

## What ran

This session's container: local Postgres 16, Chromium 1243 (Playwright 1.63). WebKit is not installed, so the WebKit warm-up was left out with a throwaway config (not committed) and the phone piece was not run here.

| Check | Result |
|---|---|
| `back-then-wheel.test.ts --project computer` at `6fe194c` | 4 of 4 passed (about 11.5 s each) |
| Same, with only the `wheel` listener line removed from `src/lib/page-moves.ts` (rebuilt) | 4 of 4 failed, each at "round 1": the current clip did not change |
| `controls-overlap.test.ts --project tablet` (Chromium) at `6fe194c` | 3 of 3 passed |
| CI at `6fe194c` (quick, draft run 46126951434) | all green: verify, postgres, browser shards 1–6, gate, commit-authors, pr-rules-run |
| `git merge-tree origin/main pr454` (main 15 commits ahead) | merges clean |

## Criteria

1–2, touch on Galaxy-size Chrome, both Backs: unchanged since round 1, which ran them 4 of 4 fail without and 4 of 4 pass with. CI's phone piece is green at `6fe194c`. PASS.
3–4, wheel, both Backs, down and up, comes to rest and stays: shown above. PASS.
5, each new journey fails without its fix: shown for both (touch in round 1, wheel here). PASS.
6, existing page-move journeys: green in CI's quick run. PASS.

## Overlap at 320×568, 375×667, 667×375

The diff touches no layout or styles. `controls-overlap.test.ts` measured every button and link against every other at all three sizes, before launch and after, signed out and signed in with a friend's face: passed on tablet (Chromium) here, and CI ran its pieces green. No overlap. PASS.

## CRUD

The change adds nothing a user can make. Not applicable.

## Notes (not blocking)

- A wheel or click during any slide (not only Back) now ends that slide early. That is the intended trade: input lands on the page that is there instead of the pictures.
- Keyboard and gamepad during the slide are not in the new journeys. Round 1's probe showed the gamepad moves one clip during the slide (it scrolls in script, not by hit test); keys go to the focused element, not by hit test either. Worth adding to the every-device e2e pass the owner ordered.
- Still not tried on the owner's physical Galaxy or a physical Mac trackpad.
