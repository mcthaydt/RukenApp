# Design review round 2: the bolder /join and /help

**ab0cebaf FAIL: 1 red, 6 notes.** R1 to R4 are fixed. R5 is fixed on a computer and still open over a game's clip,
which is where most people meet the card.

Reviewed: branch `claude/project-thread-peczhs` at head `ab0cebaf`. Round 1's audit is `434b83f`
(`2026-11-22-join-help-design-round-1.md`). Reviewer: a fresh session, Opus 5.5, medium. Written 2026-11-22 19:01 UTC.
This review changes nothing but this file. It is committed on its own branch, directly on `ab0cebaf`.

## What ran

- The app ran as `verify` says, from a clean checkout of `ab0cebaf`: Postgres 16 and a fresh database, the four
  stand-ins, the site on 4173 and the game gate on 8788, all started by Playwright's own `webServer` list and stopped
  afterwards.
- A throwaway Playwright journey (not committed, now deleted) used the journeys' own helpers (`addGame`, `signUp`,
  `payAsNewMember`, `failTheirCard(number, 8)`). It set up each state and shot it at 320x640, 375x667, 810x1080 and
  1280x720, both the window as it opens and the whole page. That is seven states, four sizes and two pictures each, 56
  pictures:
  - `/join` signed out
  - `/join` signed in
  - `/join?next=/g/<a live game>/play`, signed out and signed in
  - the paused card
  - the member card
  - `/help`
- A second throwaway probe swapped the clip for a busy picture (400 bright blocks) behind the card at 375x667 and
  1280x720. It shot the card as built, the same picture with the card hidden, and the card with no fill or glass on its
  top. That is 6 more pictures.
- A program measured these at every size:
  - where each title line, button, close mark, plan row and tile sits
  - the page's width against the window's
  - every underlined element on the page (not only in `main`)
  - every font family on visible text
  - every see-through surface
  - contrast from the pictures' own pixels
- Looked at one by one: all 28 first-screen pictures, the 6 probe pictures, and the whole-page pictures of every page
  taller than its window by more than 48px: `/help` at 320, 375 and 1280, and `/join` at 320 and 375. For the other
  whole-page pictures, a program checked that their top matches the first-screen picture pixel for pixel; the clip
  states differ only because the clip moved between the two captures. So what they add is a strip of 8 to 48px at the
  foot.
- The pictures are in the project folder `design-loop/join-help/round-2-ab0ceba/`, named `<state>-<size>.png`,
  `<state>-<size>-whole.png` and `probe-busy-*.png`.

**Not run:**
- Safari's engine: the container has Chromium only, so the phone sizes are Chromium windows.
- The focus rings and the form's error line, by eye.
- Reduced motion and reduced see-through.
- A real game's clip: the test game's clip is a smooth gradient, which is why the probe uses a busy picture.

## First question: is it exciting?

- **/join on a computer: yes.** The card now fills the middle of the window in two halves: a 77px chalk title on the
  left, and the plans and the blue button on the right. It reads as a bold banner, not a pricing sheet on empty felt.
  It is still calm, in the same two faces and the same greens. This is the change round 1 asked for.
- **/help: yes, on a tablet now too.** At 810 the three tiles sit side by side in three tones under a 97px title
  (round 1's N1 is taken). On a phone it is bold and tidy.
- **/join over a game's clip: no.** This is the screen people see after they press Play. The top of the card is meant
  to be glass "so the game moves behind the title". In fact it is a near-black slab, darker than Ruken's own felt, and
  on a phone the card still covers the game. This is R6.
- **/join opened on its own on a phone:** the same stack as round 1 (title, ticks, plans, button, small print). It is
  bold but familiar. See N1.

## Round 1's reds

| Red | Now | Evidence |
| --- | --- | --- |
| R1: button cut off at 320x640 (and at 1280x720 over a clip) | **Fixed** | The button's foot is at 584 in a 640 window in all four join states at 320: signed out, signed in, and over a clip both ways. "Continue to payment" is one line, 240x56, at 18px. At 1280x720 over a clip the foot is at 372. The card over a clip now starts at y=72, the same as without one. |
| R2: paused title broke inside a word | **Fixed** | 320: "Your / membership / is paused" at 38.4px. 375: the same three lines at 45px. 810 and 1280: three whole lines. Every line holds whole words. |
| R3: the member card's full stop alone on a line | **Fixed** | 320 and 375: "You're / already / a member." 810: "You're already / a member." |
| R4: "Keep playing" small on tablet and computer | **Fixed** | 240x56 at 320, 295x56 at 375, 576x56 at 810 and 448x56 at 1280. These are the same sizes as "Continue" on each card. |
| R5: /join a stock paywall sheet that hid the game | **Fixed on a computer; open over a clip** | The two halves from 60rem: at 1280 the card is 1024 wide, with each half 512. The top over a clip is the glass tokens (`rgba(17, 19, 20, 0.12)`, `blur(24px) brightness(0.29) saturate(1.3)`). But the game does not show through it: see R6. |

## Other checks

| Check | Result | Evidence |
| --- | --- | --- |
| No underlined links | Pass | 0 underlined elements on the whole page in all 28 states and sizes (computed `text-decoration-line` on every visible element in `body`). |
| Icon-only marks understood at a glance | Pass | The X in the card's corner and the left arrow above "Help for makers" are the marks every app uses for "close" and "back". Both are 48x48 at every size and keep their words for a screen reader. The tile arrows say "open this", and the whole tile is the target. |
| Same fonts and colours | Pass | Two families on visible text: Ruken Digits with Young Serif, and Schibsted Grotesk. The colours on the card and tiles are the tokens round 1 listed. Over a clip, the top measures `rgb(14, 19, 15)` at 1280, which is no token. That is R6. |
| Frosted glass for anything see-through | Pass | The only see-through surfaces are the dim over the clip (`--dim-bg`, `--dim-filter`) and, over a clip, the card's top (`--glass-bg`, `--glass-filter`). Both are the glass tokens. |
| Contrast | Pass | White title and lines on the top over a clip: about 18:1 (the top's own colour is near black). Everything else is the same tokens on the same grounds round 1 measured, all of which pass. |
| Nothing scrolls sideways | Pass | `scrollWidth` equals `clientWidth` in all 28. No visible element passes either edge (but see N2). |
| One main action in view without scrolling | Pass | One blue button per card, whole in the window at every size. On `/help` the first tile is whole in the window at every size. |
| Plain words | Pass | No copy changed since round 1. |

## Red findings

### R6

UNIT: the card's top over a game's clip (`.behindcard ~ main.card.bold .cardtop` in `src/lib/look.css`).

VERDICT: red.

REQUIREMENT:
- Round 1's R5 EXPECTED: "a first look that a stock pricing sheet could not give, on a phone and on a computer".
- R5's fix (a): "so the game moves behind the big title".
- The change's own comment in `look.css`: "the top is frosted glass, so the game moves behind the title".
- The owner, 2026-11-22: "same font and colours".

REASON: the glass sits on top of the play menu's dim, so the clip is darkened twice. What shows behind the title is a
near-black slab, darker than the felt and in no Ruken colour. The game cannot be seen there. On a phone the card covers
80% of the window, so over a clip the person still sees nothing of the game they just tapped.

EVIDENCE:
- **The test clip.** The top measures a mean of `rgb(14, 19, 15)` at 1280x720 and `rgb(11, 17, 29)` at 320x640. Its
  relative luminance is 0.006. The dimmed clip around the card measures 0.050 to 0.073, and the felt `#112f2c` is about
  0.024. Pictures: `join-over-clip-1280x720.png`, `join-over-clip-810x1080.png` and `join-over-clip-320x640.png`.
- **The busy picture.** I measured the same spots behind the title, away from the words. Under the top as built the
  mean luminance is 0.010 at 375 and 0.009 at 1280. With the card hidden, under the dim alone, it is 0.059 and 0.066.
  So the top lets through about a seventh of the light the dim already lets through. By eye, the bright blocks are a
  dark smudge (`probe-busy-375.png`, `probe-busy-1280.png`).
- **The cause.** `backdrop-filter` reads what is behind the top, and that includes `.behindcard::after` (62% black).
  Then `brightness(0.29)` is applied on top of that.
- **The phone.** At 320x640 the card runs from y=72 to past the window's foot: 288x568 of 320x640, which is 80% of the
  window.

EXPECTED:
- Over a game's clip, the game can be seen behind the title at every size: what shows there is at least as bright as
  the dimmed clip around the card.
- The title and lines still pass contrast against the brightest backdrop.
- The colours stay Ruken's.

FIX: in `src/lib/look.css` only:
- Over a clip, give the top no fill and no glass of its own: `.behindcard ~ main.card.bold .cardtop { background: none;
  backdrop-filter: none; }` (and the `-webkit-` form). The title and lines then sit on the play menu's dim, which is
  already the frosted see-through layer, so the glass rule still holds.
- Measured with this change applied in the probe (`probe-busy-notopglass-375.png`): the game shows behind the title as
  clearly as around the card.
- The brightest backdrop under the dim is luminance 0.12 at 375 and 0.13 at 1280. That gives white text 5.9:1 at
  worst, which passes 4.5 for the 16 to 18px lines. The Glaucous Green ticks need 3:1 and get 3.4:1 at the brightest
  backdrop measured (0.134, beside the card at 1280), so they stay as they are.
- In `tests/browser/join-and-help-look.test.ts`, change the glass journey to check that the top has no fill of its own
  over a clip. Add a check that the screenshot's mean luminance behind the title, away from the words, is at least that
  of the dimmed clip beside the card.
- On a computer the left half then shows the game. On a phone the top 340px shows the game behind the title. That is
  the first look a stock sheet cannot give.

## Notes (not fixed here)

- **N1. /join opened on its own on a phone is still the familiar stack.** This only happens when someone opens `/join`
  directly, with no game behind it. It is bold and clear. Anything more (the game's name, a picture) is new words or a
  new picture, so it would be the owner's choice.
- **N2. The paused card is one pixel wider than its column at 320, and its halves are uneven at 1280.** At 320 the top
  and body are 289 wide in a 288 `main`. At 1280 the halves are 547 and 477, so "Update card" is 413 wide against 448
  on the other cards. "membership" at the title's size is wider than half the card, and a `1fr` track grows to fit it.
  Nothing scrolls sideways and it reads well. Idea: `grid-template-columns: minmax(0, 1fr) minmax(0, 1fr)`, with a
  title clamp that fits "membership" in 512px less padding.
- **N3. Short pages still scroll a little** (round 1's N7): 8px on a phone, 48px on a tablet and computer. This is the
  shared layout, not this change.
- **N4. On a tablet, the help tiles' names start at different heights** (615, 588 and 590 at 810), because each tile
  pushes its name and line to the foot and the lines differ in length. The tiles' feet line up, and it reads as
  intended.
- **N5. Two ways home on /help** (round 1's N4): the builder kept it on purpose, with a reason. No change asked.
- **N6. Phone sizes were shot in Chromium.** The `phone` project in CI is Safari's engine, so R6's check should run
  there too, and `backdrop-filter` behaves the same in both.
