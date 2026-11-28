# Signed-out plus page (#462), lane 2 review 3

- Commit examined: `b99d2caaa6b98c928c98df18f86999ac63caafc3` (round 2 examined `a80d7ec`, round 1 `5d52b3d`).
- Reviewer: a fresh session, Opus 5.5, medium. Date: 2026-11-28 (13:49 UTC, from `date`).
- Verdict: **PASS, 0 red, 3 notes.**

## What ran

Locally, on a fresh Postgres 16, with WebKit replaced by Chromium for the phone profile and the WebKit warm-up skipped (WebKit is not installed here; CI runs the real one on the full run):

- At `b99d2ca`: `make-signed-out`, `cookie-card-pad` and `controls-overlap` on phone, tablet and computer: 58 passed, 5 skipped (by design), 0 failed, no retries.
- The Like-then-plus check with `src/` from `a80d7ec`: fails on all three profiles (`aside.consent` count 1, expected 0). The fix makes it pass.
- The first-press pad walk with `src/` from `5d52b3d`: 2 failed, 1 passed. Reached was `Join Ruken, I agree, What we keep, Add a game, Ruken, Not now` and `Join Ruken, What we keep, Home, I agree, Ruken, Not now`, never Sign in. This matches the PR body (fails on phone and computer, tablet has room). I did not confirm which profile passed by name.
- A probe (`2026-11-28-signed-out-plus-page-3-probe.test.ts.txt`, beside this file), 27 of 27 passed on the three profiles:
  - Not now, Like on a live clip ("To like this game" card), then the plus: at 320×568, 375×667 and 667×375 (sideways as installed), before launch and after, no card on /make, no two controls overlap (every visible a, button and the card measured pairwise), Join Ruken and Sign in are hit at their middles and sit inside the screen, and Tab goes Home, Add a game, You, Ruken, Join Ruken, Sign in.
  - With that ask still pending: the pad's first press lands on Join Ruken, A opens `/cookies?for=sign-up`, the pad reaches I agree, A opens the sign-up form. Back on the feed afterwards there is no card and the earlier Like was not made on its own (Like not pressed).
  - With the ask pending, Sign in (tap on phone and tablet, click on computer) opens `/cookies?for=sign-in`, I agree opens the sign-in form.
  - With the ask pending, Home from the bar brings the card back on the feed with "To like this game", and Not now clears it. Nothing is stuck.
- CI at `b99d2ca`: the draft's quick run is all green (verify, postgres, 6 browser shards, gate, commit-authors, pr-rules), no retries. The full run has not run, since the pull request is a draft.
- The branch has no live-state file; it merges cleanly with `main` at `0ceeb12`.

## Round 2 findings

- **R1 (card back over the pitch after Like): fixed.** `src/routes/+layout.svelte` now keeps the card off `/make` whatever is pending. Checked by the new journey (fails at `a80d7ec`, passes now) and the probe at three sizes, before and after launch.
- **R2 (pad check passed on the old code): fixed.** The before-a-yes pad walk now starts from the first press with nothing focused and fails against `5d52b3d` on two of three profiles, as the PR body says.

## Notes (not blocking)

- **N1. #467 still conflicts.** `git merge-tree` of `b99d2ca` with #467's head `96d300b` conflicts in `src/routes/+layout.svelte` and `tests/browser/controls-overlap.test.ts`. Whichever merges second must keep `/make` free of the card (it would block Join and Sign in, and as a modal block the whole pitch) and re-run `make-signed-out` and `cookie-card-pad`. Not failed here.
- **N2.** A pending ask stays in memory after the person agrees on `/cookies` from the pitch. It is harmless today (the card only shows before a yes, and nothing else runs `answerAsk`), but anything that later runs the waiting press on a yes would make a Like the person may have forgotten. Recorded for whoever touches `consent/ask.svelte.ts`.
- **N3.** Coming back to the feed from the pitch, the card asks again about the Like. That is the press the person made there, so it reads sensibly; recorded only so a later change knows it is expected.

## Not checked

- Real WebKit and the full CI run (they start when the PR is marked ready).
