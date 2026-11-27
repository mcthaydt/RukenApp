# Trackpad swipe, implementation audit 1 (lane 2)

Pull request #429, reviewed at `6a84cae` (first read at `4d32c0a`; the only change since is the journey's WebKit path and the live-state file). Fresh lane 2 review, Opus 5.5, medium. Graphify (RukenApp is indexed) and the diff against the base `872bb55` were used to find what the change reaches.

**Verdict: `6a84cae` FAIL: 1 red.** The code does what the owner asked; the one red is process: the branch's live-state file is still in the head.

## What ran

- Unit: `tests/features/feed/tabs.test.ts`, 10 of 10 passed (at `4d32c0a`; unchanged since).
- `pnpm lint`: exit 0. `pnpm typecheck`: 0 errors, 0 warnings (at `4d32c0a`; `6a84cae` changes only a journey).
- Journeys, locally on tablet and computer (Chromium), at `4d32c0a`: `trackpad-swipe`, `feed-top`, `feed-leave-and-return`, `bar-through-moves`, 34 of 34 passed. The phone (WebKit) was not run here: this container has no WebKit.
- CI at `4d32c0a`: `browser shard 2 of 6` failed on the phone: `mouse.wheel: Mouse wheel is not supported in mobile WebKit` (run 46036993180). `6a84cae` answers it; CI quick run 46037896920 is green on every piece, gate included.
- Exploratory probe on tablet and computer (scratch file, deleted, not committed): a swipe with 16ms between moves goes to Followed; sideways wheel moves on a game page are not stopped (`defaultPrevented` false), so the listener does not reach past the feed; a swipe back started inside 200ms of the last coast move is ignored; a swipe after a rest goes back to Fresh. Screenshots in the review's artifact.

## Weighed

- **One gesture plus its coast steps exactly one tab.** `stepOfWheel` sums a swipe's moves and steps at most once until the wheel has rested 200ms (`WHEEL_REST`); the swipe state is module-level in `FeedTop.svelte`, so the new tab's bar sees the same swipe. Unit tests feed 120 coasting moves after the step and a turn back without a rest: one step each. Pass.
- **Sideways wheel is stopped so the browser does not go Back/Forward.** Non-passive window listener, `preventDefault` when `|dx| > |dy|`; the journey counts every sideways move `defaultPrevented` and no up-and-down one. `html` already has `overscroll-behavior: none` (`src/lib/look.css`), which also turns off Chrome's swipe Back. Desktop Safari on a real Mac is not proven (the PR says so). Pass.
- **#426's edge rule and #427's bar fix untouched.** The diff adds to `FeedTop.svelte` only the wheel effect and the module-level `wheeling`; touch handlers and `onBrowserEdge` are unchanged, and `feed-leave-and-return` and `bar-through-moves` pass. Pass.
- **Vertical scroll unaffected.** Up/down moves are never stopped and never step (journey: next clip and back; unit: a swipe that starts up and down stays a scroll). Pass.
- **No hijack elsewhere.** `FeedTop` is mounted only by `Feed.svelte` (`/`) and `Followed.svelte` (`/followed`); Search is its own route; every sheet over the feed is a `<dialog>`, which the listener skips. Probe: a game page's sideways wheel is not stopped. Pass.
- **The WebKit path at `6a84cae`.** On WebKit the journey dispatches the same moves as `WheelEvent`s at the screen's middle. They pass through the feed's real listener, so the step, the single slide, the single history entry and `defaultPrevented` on every sideways move are still proven there; what it cannot prove is the browser's own default (a real scroll or a real Back), which it says, and the up/down scroll check is skipped there only. Acceptable: no real trackpad exists on a phone, and Playwright's WebKit can send no real wheel. Pass.

## Findings

UNIT: `docs/superpowers/live/claude-project-thread-e1xyov.md`. VERDICT: red. REQUIREMENT: CLAUDE.md, "Live state in a file": the session deletes the file in its last commit before it hands the branch to the audit, so the commit the audit names is the one that merges. REASON: the file is still in the reviewed head. EVIDENCE: `git show 6a84cae:docs/superpowers/live/claude-project-thread-e1xyov.md` prints it ("Next step: CI on the phone fix, then a fresh lane 2 review"). EXPECTED: absent at the head handed to review. FIX: one commit deleting that file and nothing else; a re-review then checks the diff from `6a84cae` is only that deletion.

## Notes (not blocking, not fixed here)

1. A swipe back started while the last swipe is still coasting (inside 200ms of its last move) is ignored; on a phone every swipe steps. If the owner finds a quick flick back "sometimes does nothing", a reversal of direction could start a new swipe. Probe evidence: flick back with no rest stayed on `/followed`.
2. With two tabs, a coast that stepped again would go past the end and do nothing, so the journey cannot catch a double step; the unit tests do. Once Your turn is a third tab, a journey starting from the middle tab would.
3. A single sideways notch of a mouse's tilt wheel or Shift+wheel (one 100px move) steps a tab on the computer profile. Likely fine; recorded.
4. A gesture whose first wheel move is more up-and-down than sideways is not stopped; in Chrome later moves of a latched scroll may not be cancelable. Low risk given `overscroll-behavior: none` on `html`.
