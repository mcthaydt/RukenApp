# Signed-out plus page and the pad on the cookie card: lane 2 review 1

- Pull request: #462, branch `claude/project-thread-ovvp0f`
- Commit examined: `5d52b3d437e86191efa33ea6e90ccfe982dece92` (`5d52b3d`)
- Reviewer: a fresh session, Opus 5.5, medium (the builder's model)
- Written 2026-11-28 11:26 UTC

## Verdict

**FAIL: 2 red.** Before a yes to cookies, which is how every new visitor first opens the plus, the cookie card sits on
top of the new pitch: Join Ruken and Sign in are covered at every size, and the pad cannot reach them while the card
is up (R1). Also, Sign in is a filled quiet button, while the criterion and the PR body call it a text link with an arrow (R2).
Everything else holds: the code is sound, the other criteria pass, and CI's draft run is green.

## What ran

- CI at `5d52b3d`: the draft (quick) run, run 46137195093, every job green: verify, postgres, all 6 browser
  pieces and gate. `pr-rules` and `commit-authors` green too. The piece logs show `cookie-card-pad` and
  `make-signed-out` ran on the real phone profile (WebKit) and passed with no retries. The full run has not run yet:
  it starts when the PR is marked ready.
- Locally, on this container (Chromium standing in for the phone's WebKit, which is not installed here; the warm-WebKit
  global setup was turned off for the same reason):
  - The changed and new journeys: `make-signed-out`, `cookie-card-pad`, `bar`, `make-questions`, `controls-overlap`,
    `fits-the-screen`, on phone, tablet and computer: **264 passed, 9 skipped, 0 failed**, on the first run.
  - The journeys the pad change in `src/lib/pad-focus.ts` and the feed's key change can reach: `gamepad`,
    `feed-controls`, `feed-shortcuts`, `scrollbar`, `cookie-consent`, `sheets-slide`, `game-page`, `feed-top`, on all
    three profiles: **342 passed, 0 failed**, on the first run.
  - No test passed only on a retry. No flakes to log.
- A probe of my own (not committed to the repo; copy in the project files at
  `audits/2026-11-28-signed-out-plus-page-1-probe.test.ts.txt`) uses the overlap journey's own `overlaps()` measure.
  It checked `/make` signed out at 320×568, 375×667 and 667×375 (Home Screen mode), before and after launch, with and without
  a cookie yes. It also walked the pad and the keyboard on `/make` with the card up, and read the bar's rings after
  a tap and after a click. Screens in the project files at `audits/2026-11-28-signed-out-plus-page-1/`.

## Acceptance criteria

| Criterion | Result | Evidence |
| --- | --- | --- |
| Signed out with no yes, the plus opens /make, shows "Made a game?", plus marked current | PASS | `make-signed-out` before-a-yes test; `/make` in `OPEN`, children in `GATED` (`src/features/consent/routes.ts`) |
| Join Ruken a real button, Sign in a quiet text link, both ≥48px, above the bar, back to /make; no "Your account" | **FAIL (R2)** | Sign in is `class="quiet"`, a filled sage button (`src/lib/look.css:800`), not a text link; the body says "**Sign in →** link" |
| Join makes an account and lands on Your games; Sign in lands there too | PASS | `make-signed-out` Join and Sign in tests |
| Fits without scrolling at 320×568 and 375×667; no page scroll sideways at 667×375 | PASS | probe: scroll 0 at all three, both launch states, with and without a yes |
| No two controls overlap on /make at the three sizes | **FAIL (R1)** | Before a yes: see R1. With a yes: none, both launch states |
| The pad reaches every button on the pitch | PASS with a yes; **FAIL before a yes (R1)** | `padReachesEverything` passes once the card is answered; with the card up the pad never lands on Join Ruken or Sign in |
| The pad reaches I agree, Not now, What we keep on 8 screens, 3 profiles, empty and full feed; A works | PASS | `cookie-card-pad` locally and in CI's phone run |
| The new checks fail on main | Not re-run here | Taken from the PR body, not checked by this review |

## Red findings

### R1. Before a yes, the cookie card covers the pitch's Join Ruken and Sign in

- UNIT: `/make` signed out (`src/routes/make/+page.svelte`, the consent card's place on it), and its check in
  `tests/browser/controls-overlap.test.ts`.
- VERDICT: red.
- REQUIREMENT: the PR's criterion "No two controls overlap on /make at 320×568, 375×667 or 667×375" and "The gamepad
  reaches every button on the pitch". The owner's standing rule (2026-11-27 23:12 UTC): a journey fails if any two
  controls overlap, on every page, at those three sizes, and any overlap blocks.
- REASON: this PR opens `/make` before a yes (it was gated, so before it showed the whole-screen Cookies? question).
  So a new visitor who presses the plus gets the cookie card floating over the pitch, on top of its only two buttons.
- EVIDENCE: the overlap journey's own measure, run on `/make` with `NOT_CONSENTED`, in Home Screen mode, same result
  before and after launch:
  - 320×568: `Join Ruken / Not now`, `Join Ruken / What we keep`, `Sign in / Not now`
  - 375×667: no box crossing is counted, but the card hides the whole pitch below its first line, Join and Sign in
    included (`make-none-before-375x667.png`); the measure skips it only because the card is a box that holds buttons
  - 667×375: `Join Ruken / I agree`, `Join Ruken / What we keep`, `Sign in / I agree`
  - 1280×720 (computer): `Join Ruken / I agree`, `Join Ruken / What we keep`, `Sign in / I agree`, `Sign in / What we keep`
  - The pad, from the first press with the card up, phone and computer: Home, then up to What we keep, I agree, then the
    Ruken wordmark. It never lands on Join Ruken or Sign in. The new `covered()` filter in `src/lib/pad-focus.ts` skips them
    on purpose, because they are under the card. A tap cannot reach them either.
  - `controls-overlap.test.ts` misses this because it runs every screen with `CONSENTED_STATE` only.
- EXPECTED: before a yes, at 320×568, 375×667, 667×375 and on the computer, Join Ruken and Sign in are not under the
  card or any of its controls, and a tap and the pad each reach them with the card still up. How is the builder's
  call. For example, the pitch could sit above the card, or the card could lie lower on this screen.
- FIX: the layout of `/make` signed out, or how the card stands on it: `src/routes/make/+page.svelte`, `src/lib/look.css`
  (scoped to this screen). Add a before-a-yes pass of `expectNothingOverlaps` for `/make` signed out to
  `tests/browser/controls-overlap.test.ts`, and a before-a-yes pad walk to `tests/browser/make-signed-out.test.ts`. Both
  must fail at `5d52b3d`.

### R2. Sign in is a filled button, but the brief says a quiet text link with an arrow

- UNIT: `src/routes/make/+page.svelte:25` and its check in `tests/browser/make-signed-out.test.ts`.
- VERDICT: red.
- REQUIREMENT: the PR's criterion "Join Ruken is a real button and Sign in is a quiet text link", and its body, "a
  **Join Ruken** button and a **Sign in →** link". The owner's rule (2026-11-23, quoted at `src/lib/look.css` `.go`):
  primary actions are buttons, secondary actions are the blue → links.
- REASON: the code and the check disagree with the brief. `class="quiet"` draws a filled sage button with no arrow
  (`make-yes-after-320x568.png`), and the journey asserts `/\bquiet\b/`, so it checks the code, not the criterion.
- EVIDENCE: `src/lib/look.css:800-821` (`.quiet` has a background, `--sage` on a card); the screenshot shows two filled
  buttons side by side.
- EXPECTED: Sign in is the blue text link with → (`class="go"`), still at least 48px tall, above the bar, and not
  overlapping Join Ruken at the three sizes. Or, if the builder holds that a quiet button is right here, the criterion
  and body are corrected to say so, with the reason in the PR. A brief and code that disagree cannot both stand.
- FIX: `src/routes/make/+page.svelte` (the class), `tests/browser/make-signed-out.test.ts` (the class assertion), and
  the PR body only if the second way is chosen.

## Checked and sound

- `src/features/consent/routes.ts`: only `/make` itself opens before a yes. `/make/[game]`, `/make/github`, `/make/new`
  and `/make/page` stay gated. The throw-away action on `/make` still calls `signedInOnly`, so a signed-out post goes
  to sign-in.
- `src/routes/make/+page.server.ts`: signed out returns `{ signedOut: true }` before reading any games or cookies;
  signed in is unchanged.
- `src/routes/make/+layout.svelte`: no "Your account" link signed out; signed in unchanged.
- `src/lib/look.css`: dropping the bottom margin from `.screen` under the bar. Signed in, `/make` at the three sizes:
  no overlap, no scroll (probe).
- `src/lib/pad-focus.ts`: the pinned-to-pinned move and the `covered()` filter. All gamepad, feed and sheet journeys pass
  on three profiles. On a full feed the pad still goes Play, Like, Save, Repost along the row.
- `src/features/feed/Feed.svelte`: with no clips the feed gives up and down to the pad; with clips it is unchanged
  (`feed-controls`, `feed-shortcuts` green).
- Outlines: after a tap (phone, tablet) or a click (computer) on the plus, no bar button has an outline or a ring
  (`outline-style: none`, no shadow). From the keyboard, Tab gives the bar its shadow ring and the pitch's links an outline.
- Keyboard: Tab goes through Home, Add a game, You, Ruken, Join Ruken, Sign in, I agree, Not now, What we keep, and Enter on
  Sign in opens sign-in.
- Copy: "six short questions" matches `/about` and the help guide. Nothing promotes a personal page (create-a-page is
  hidden until slice 4).
- CRUD: the only thing made here is an account; its create, read, change and delete are `me.test.ts` and
  `delete-account.test.ts`, as the journey says.
- Tests the PR changes (`bar`, `make-questions`, `controls-overlap`, `fits-the-screen`) are named in the body with why.
  Each change follows from the new behaviour.

## Follow-ups, not this change's to fix

- **Red, older than this change: the cookie card covers controls on other open screens before a yes.** These were
  measured the same way (phone sizes, Home Screen mode, `NOT_CONSENTED`):
  - `/your-turn`: Sign in under I agree at 320×568, and under I agree and Not now at 667×375.
  - `/followed`: Sign in under I agree at 320×568.
  - `/help`: Get your game on Ruken under the card's answers at all three sizes.
  - `/`: the clip's name, Play, Save and Repost under the card at all three sizes.

  `/search` is clear. The standing overlap journey never checks the before-a-yes state, so this has never been caught.
  This needs its own thread: the owner's rule says any overlap blocks.
- Note: with the card up, the pad's first press on `/make` lands on the bar's Home, not the screen's main button. This
  follows from R1: Join is covered, so no main control is on screen.
