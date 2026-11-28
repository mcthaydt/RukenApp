# Signed-out plus page (#462), lane 2 review 2

- Commit examined: `a80d7ec7d0e25d785b2fba1f8e226665f6ac0805` (round 1 examined `5d52b3d`).
- Reviewer: a fresh session, Opus 5.5, medium. Date: 2026-11-28 (13:03 UTC, from `date`).
- Verdict: **FAIL, 2 red, 3 notes.**

## What ran

Locally, on a fresh Postgres 16, with WebKit replaced by Chromium for the phone profile (WebKit is not installed here; CI runs the real one):

- At `a80d7ec`: `make-signed-out`, `cookie-card-pad` and the before-a-yes block of `controls-overlap` on phone, tablet and computer: 44 passed, 1 skipped (the overlap check is skipped on computer by design), 0 failed.
- At `5d52b3d` with `a80d7ec`'s `make-signed-out.test.ts` and `controls-overlap.test.ts`: 5 failed, 3 passed (phone and tablet). The overlap check fails at 320×568 and 667×375 before and after launch; the class check fails on Sign in; Join's click times out on the phone. The pad walk passes there on both profiles (R2).
- A probe (`2026-11-28-signed-out-plus-page-2-probe.test.ts.txt`, beside this file) at `a80d7ec` and `5d52b3d`: keyboard, touch and pad at 320×568, 375×667 and 667×375 (sideways as installed), and a Like pressed on the feed before the plus.
- CI at `a80d7ec`: the draft's quick run is all green (verify, postgres, 6 browser shards, gate, commit-authors, pr-rules), with no retries. The full run has not run, because the pull request is a draft.

## Round 1 findings

- **R1 (card over Join and Sign in): fixed for a first visit, not for every way in (see R1 below).** On a first visit to /make before a yes there is no card. Join and Sign in are hit at their middles at all three sizes; nothing overlaps (the journey's own measure); Tab goes Home, Add a game, You, Ruken, Join Ruken, Sign in; Enter and touch on Join go to `/cookies?for=sign-up…`, then I agree opens the form; Sign in goes to `/cookies?for=sign-in…`, then the sign-in form. From the first press the pad lands on Join Ruken, A opens the cookie screen, the pad reaches I agree, and A opens the form. Nothing gets stuck.
- **R2 (Sign in a filled button): fixed.** Sign in is `class="go"`, the blue words with →, and the journey checks it is neither `button` nor `quiet`.

## Red

**R1.** UNIT: `src/routes/+layout.svelte` (the `ASKED_NEXT` condition). VERDICT: red. REQUIREMENT: the PR's criterion "Join Ruken and Sign in … have nothing drawn over them before a yes", and round 1's R1. REASON: a press on the feed that asks for the yes leaves `consentAsk.reason` set, and `ASKED_NEXT` lets the card back on /make whenever a reason is set, so it covers the pitch there. EVIDENCE: probe "a like pressed on the feed, unanswered, then the plus". Signed out with no yes, Not now, then Like on a clip, which opens the card with "To like this game…". Then the plus: /make shows that card. On the phone (375×667) `elementFromPoint` at Join's middle is the card's `aside.consent`; the whole pitch under "Made a game?" is covered. The pad's full walk (`padReachesEverything`) fails with "the pad cannot reach these on /make: Join Ruken, Sign in". The card also talks about liking a game on a screen that has none. Not now clears it, so the person is not trapped, but the screen's only buttons are hidden behind a question about another screen. EXPECTED: on /make before a yes, no card, whatever was pressed on the screen before. FIX: in `src/routes/+layout.svelte`, drop the `|| consentAsk.reason !== null` exception for `ASKED_NEXT`, since nothing on /make asks for the yes in place; or forget a pending ask when the page changes. Add the like-then-plus case to `tests/browser/make-signed-out.test.ts` and check that it fails at `a80d7ec`. Files: `src/routes/+layout.svelte`, `tests/browser/make-signed-out.test.ts`.

**R2.** UNIT: `tests/browser/make-signed-out.test.ts`, "a gamepad reaches every button on it, with no cookie question in the way". VERDICT: red. REQUIREMENT: CLAUDE.md "A check is a test that fails by itself"; round 1 asked for "a before-a-yes overlap check and a pad walk. Both must fail at 5d52b3d"; the PR body says the pad walk fails at `5d52b3d`. REASON: this check passes at `5d52b3d`, so it does not encode round 1's finding. EVIDENCE: at `5d52b3d` it passes on phone and tablet. `padReachesEverything` moves the focus onto each Tab stop by script and then presses every way, so it can reach Join from the card's answers. A person's walk from the first press is different. In the probe, at `5d52b3d` on the phone, down from the first press goes Home ×6, What we keep, I agree, Ruken and never reaches Join Ruken (fails). At `a80d7ec` the first press lands on Join Ruken (passes). EXPECTED: a pad check that fails at `5d52b3d` and passes at the fix. FIX: in that test, also walk from the first press with the pad alone, with no focus set by script, and expect it to reach Join Ruken and Sign in; or assert that no cookie card is on the screen while the pad walks. Run it at `5d52b3d` to show the failure, and make the PR body's claim match. Files: `tests/browser/make-signed-out.test.ts`, the PR body.

## Notes (not blocking)

- **N1. #467 conflicts with this change.** `git merge-tree` of `a80d7ec` with #467's head conflicts in `src/routes/+layout.svelte`: #467 rewrites the same `{#if}` line and drops `aboveBar`. It also conflicts in `tests/browser/controls-overlap.test.ts`. #467 makes the card a modal `<dialog>` on every page. Whichever merges second must keep /make free of it, because a modal over the pitch would block Join and Sign in entirely. It must also re-run `cookie-card-pad.test.ts`, whose walks assume a card that is not modal. This is not failed here.
- **N2.** The sideways keyboard probe in a plain browser tab hit the "turn upright" screen. That is by design (the owner blocks a sideways phone in a browser), so the sideways checks above ran as installed, as the journeys do.
- **N3.** The PR body starts with `<!-- attribution: Requested by McThayDT -->`, not the project's `claude-projects-attribution` comment. `pr-rules` passed, so this is for the builder's next body edit only.

## Not checked

- Real WebKit (CI covers it on the full run).
- The full CI run, which starts when the PR is marked ready.
