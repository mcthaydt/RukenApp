# Design review round 1: the bolder /join and /help

**3211a67 FAIL: 5 red, 9 notes.**

Reviewed: branch `claude/project-thread-peczhs` at head `3211a67` (the build is `aadead3`; `3211a67` adds only the
live-state file). Reviewer: a fresh session, Fable 5.2, medium. Written 2026-11-22 18:42 UTC. This review changes
nothing but this file.

## What ran

- The app was started as `verify` says (Postgres 16, the four stand-ins, the site on 4173, the game gate on 8788), from a
  clean checkout of `3211a67`, and stopped afterwards.
- A throwaway Playwright journey (not committed) set up each state with the journeys' own helpers (`signUp`,
  `payAsNewMember`, `failTheirCard(number, 8)`, `addGame`) and shot it at 320x640, 375x667, 810x1080 and 1280x720: the
  window as it opens, and the whole page. Six states, four sizes, two pictures: 48 pictures, each looked at one by one.
  - `/join` signed out
  - `/join` signed in (not a member)
  - `/join?next=/g/<a live game>/play`, signed out, the game's clip behind the card
  - the paused card (`/join?next=/me`, card failed 8 days ago)
  - the "You're already a member." card (not in the brief; the change restyles it, so it was shot too)
  - `/help`
- Measured by a program at every size: where each button, title and mark sits, the page's width against the window's,
  every underlined element, every font family in use, every see-through surface, and contrast from the pictures' own
  pixels (the commonest colour in an element's box against the colour of its words).
- The pictures are in the project folder, `design-loop/join-help/round-1-3211a67/`, named `<state>-<size>.png` and
  `<state>-<size>-whole.png`.

**Not run:** Safari's engine (the container has Chromium only, so the phone sizes are Chromium windows of a phone's size,
not the `phone` project's WebKit); the focus rings and the form's error line, by eye; reduced motion and reduced
see-through; an 18+ game behind the card.

## First question: is it exciting?

**/help on a computer: yes.** A 112px chalk title across the felt and three tiles in three tones is not what a help
page looks like anywhere else, and it is still calm. This one would make me look twice.

**/help on a phone: better than before, not striking.** The title is 48px on two lines and the first tile fills the
rest of the window. It reads as bold. **On a tablet it is the phone's page stretched** (note N1).

**/join: no, not yet.** It is tidier and louder than a plain card, but it is the paywall sheet every subscription app
ships: a title, three ticked lines, two plan rows, a blue button, small print. The only bold thing on it is the size
of the title. Nothing on it could only be Ruken. This is finding R5.

## What passed

| Check | Result | Evidence |
| --- | --- | --- |
| Plain words | Pass | Every line read at 320: no jargon on `/join`. On `/help`, "GitHub" is named and explained in the same tile ("A free place for your game's files"). |
| No underlined links | Pass on these two screens | 0 underlined elements in all 24 states and sizes (computed `text-decoration-line` on every visible element). See N6 for the pages the tiles lead to. |
| Close mark and back arrow understood at a glance | Pass | An X in the card's top corner and a left arrow above the title are the marks every app uses for these. Both are 48x48 at every size, and each keeps its words for a screen reader ("Not now", "Back to Ruken"). |
| Same fonts and colours | Pass | Two families at every size (Young Serif with Ruken Digits; Schibsted Grotesk). Every colour sampled from the pixels is a token: `#112f2c`, `#004f46`, `#b4cdc2`, `#ffffff`, `#111314`, `#34454c`, `#006eb8`. |
| Frosted glass for anything see-through | Pass | The only see-through surface on either screen is the dim over the clip, `.behindcard::after`: `rgba(17, 19, 20, 0.62)` with `blur(6px)`, which is `--dim-bg` and `--dim-filter`. The card, the band, the close mark and the tiles are solid. |
| Nothing scrolls sideways at 320 | Pass | `scrollWidth` equals `clientWidth` in all 24 (320 of 320 at the smallest), and no visible element's box passes either edge. |
| One main action visible without scrolling | **Fail on /join at 320x640 and, over a clip, 1280x720** (R1). Pass elsewhere: one blue button per card, and on `/help` the first tile is whole in the window at every size. |

### Contrast, from the pixels

| Words | On | Measured | Needs |
| --- | --- | --- | --- |
| Card title, the three "gets" lines (white) | Dusky Green band `#004f46` | 9.52:1 | 4.5 |
| The ticks, tile 3's number (Glaucous Green `#b4cdc2`) | `#004f46` | 5.64:1 | 3 |
| Close mark (white) | its square `#112f2c` | 14.32:1 | 3 |
| Chosen plan row (white) | ink `#111314` | 18.63:1 | 4.5 |
| Other plan row, paused line (ink) | paper | 18.63:1 | 4.5 |
| "Save $20.88" (ink, 14px) | `#b4cdc2` | 11.05:1 | 4.5 |
| Button words (white, 18 to 20px) | blue `#006eb8` | 5.35:1 | 4.5 |
| Small print (`#34454c`, 14px) | paper | 9.99:1 | 4.5 |
| Help title and wordmark (white) | felt `#112f2c` | 14.32:1 | 3 |
| "Three short guides…" (`#b4cdc2`, 24px) | felt | 8.49:1 | 3 |
| Tile 1: number (blue) / words (ink) | paper | 5.35:1 / 18.63:1 | 3 / 4.5 |
| Tile 2: number (`#004f46`) / words (ink) | `#b4cdc2` | 5.64:1 / 11.05:1 | 3 / 4.5 |
| Tile 3: words and arrow (white) | `#004f46` | 9.52:1 | 4.5 |
| Wordmark over the clip (white) | the dimmed clip | 11.87:1 on the phone and tablet shots, 7.77:1 at 1280 (brightest pixel beside it); 5.21:1 worked out for a pure white clip under the dim | 3 |

Nothing fails on contrast.

## Red findings

### R1

UNIT: the paywall card's height on a small phone (`.card.bold` in `src/lib/look.css`).
VERDICT: red.
REQUIREMENT: the brief, "one main action visible without scrolling"; `visual-check` step 1.
REASON: at 320x640 the blue button is cut off by the bottom of the window in all three join states, and over a clip it is cut at 1280x720 too.
EVIDENCE: the window is 640 high. Signed out, "Continue" sits at 588 to 644, cut by 4. Signed in, "Continue to payment" wraps to two lines at 20px in a 240px button, so the button is 64 high, 588 to 652, cut by 12, and the second line is sliced (`join-signed-in-320x640.png`). Over a clip the card starts 32px lower (its top margin is 48px, not 16px), so the button sits at 620 to 676: 36 of its 56px are below the window and its word cannot be read (`join-over-clip-320x640.png`). At 1280x720 over a clip it sits at 666 to 722, cut by 2. The journey "the one blue button can be seen without scrolling" passes because it runs signed out, with no clip, at the projects' sizes (375 wide at the smallest).
EXPECTED: the whole button, with its words on one line, inside the window at 320x640 and at 1280x720, signed out, signed in, and over a live game's clip.
FIX: in `src/lib/look.css` only, the `.card.bold` rules: make the card about 40px shorter where the window is short (the band's padding, the gap above and between the "gets" lines, the gap between the plan rows and their 4.5rem height are the room), and keep "Continue to payment" on one line at 320 (a smaller button font there). In `tests/browser/join-and-help-look.test.ts`, run the button journey at 320x640 signed out and signed in, and at 320x640 and 1280x720 over a live game's clip.

### R2

UNIT: the paused card's title (`.card.bold h1` in `src/lib/look.css`).
VERDICT: red.
REQUIREMENT: the drunk-grandma test (plain words anyone could follow); `visual-check` step 1, layout and polish.
REASON: on a phone the title breaks in the middle of a word.
EVIDENCE: at 320x640 it reads "Your / member / ship is / paused" (`join-paused-320x640.png`); at 375x667, "Your / membersh / ip is / paused" (`join-paused-375x667.png`). The title is 44px with 56px kept clear on its right for the close mark, which leaves 184px at 320 and 239px at 375; "membership" at 44px is about 260px wide.
EXPECTED: no word of any card title is broken across lines at 320 or 375.
FIX: in `src/lib/look.css` only, `.card.bold h1` and, if needed, `.card.bold .close`: keep clear of the close mark on the first line only (the mark is 48px high, the first line is 42px) and let the title be small enough at 320 for its longest word to fit. A journey in `join-and-help-look.test.ts` at 320 and 375 that fails when a word of the paused title is on two lines. The 44px floor in the existing journey is measured at 375 on "Join Ruken to play"; if the floor has to move at 320, say so in the pull request.

### R3

UNIT: the member card's title (`.card.bold h1` where the band has no close mark).
VERDICT: red.
REQUIREMENT: `visual-check` step 1, layout and polish.
REASON: at 320 the full stop sits alone on a fifth line.
EVIDENCE: `join-member-320x640.png` reads "You're / already / a / member / ." and the title is 209px high (125px at 375, where it fits on three lines). The title keeps 56px clear on its right for a close mark this card does not have.
EXPECTED: the title on three or four whole lines at 320, with no mark of punctuation on a line of its own.
FIX: in `src/lib/look.css` only: no right padding on the title when the band has no close mark.

### R4

UNIT: the member card's button (`a.button` in `.card.bold`).
VERDICT: red.
REQUIREMENT: the change's own rule in `look.css`: "The one blue button spans the card at every size and stands a little taller: it is the card's only action."
REASON: "Keep playing" is a small button in the corner on a tablet and a computer, while the other two cards' buttons span the card.
EVIDENCE: at 810 and 1280 "Keep playing" is 159px wide and 48px high in a 576px column (`join-member-810x1080.png`, `join-member-1280x720.png`); "Continue" and "Update card" are 576 by 56. The rule is written for `form > button`, and this one is a link in a paragraph.
EXPECTED: the same width, height and type size as the other cards' one button.
FIX: in `src/lib/look.css` only: let the rule reach `.card.bold a.button`.

### R5

UNIT: `/join`, the paywall card as a whole (`src/routes/join/+page.svelte`, `.card.bold` and `.behindcard` in `src/lib/look.css`).
VERDICT: red.
REQUIREMENT: the owner, 2026-11-22: "boring"; "make people stop in their tracks and become immediately aware this is nothing like our competitors", tasteful, same fonts and colours. The brief's first question.
REASON: the card is still the standard subscription sheet, and it hides the one thing on the screen that is Ruken's own: the game the person just tapped.
EVIDENCE: by eye, all 16 join pictures: title, three ticks, two plan rows, blue button, small print, in that order, as on any paywall. Measured: over a clip the card covers 75% of the window at 320x640 and 77% at 375x667, and the clip that is left is dimmed to 38%; a person sees a strip of blurred colour above the card and nothing of the game. Opened on its own at 1280x720 the card is 640 wide: half the window is empty felt on either side, the same shape as the plain card it replaced.
EXPECTED: a first look that a stock pricing sheet could not give, on a phone and on a computer, with the same fonts, colours and glass, and still one blue button.
FIX: bounded to `src/routes/join/+page.svelte`, the `.card.bold` and `.behindcard` rules in `src/lib/look.css`, and their journeys. The builder chooses; two changes that fit the rules as they stand: (a) when a game's clip is behind the card, make the band frosted glass (`--glass-bg`, `--glass-filter`) in place of solid Dusky Green, so the game moves behind the big title; (b) from 60rem, lay the card out wide in two halves, the band on the left and the plans and button on the right, so it fills a computer's window (this also lifts the button clear of the fold in R1). Anything that needs new words, the game's name on the card or a new picture is a product choice for the owner, not part of this fix.

## Notes (not fixed here)

- **N1. /help on a tablet is the phone's page stretched.** At 810 the three tiles are one column, each 778 wide and about 226 high with its words in the left third, and the third tile's line is below the window. The three-across layout starts at 60rem (960px). Idea: start it at 48rem; at 810 each tile would be about 250px wide, which the 28px names fit on two lines.
- **N2. The plan marks look like tick boxes.** A rounded square with a tick says "choose any"; these are "choose one". The chosen row turning black makes it clear enough. Idea: round marks.
- **N3. The page's edge moves between the two screens on a tablet.** At 810 the wordmark is at x=85 on `/join` and x=16 on `/help`. The help page is meant to be wider; a 16px gutter on a tablet is tight.
- **N4. Two ways home, 16px apart, on /help.** The "Ruken" wordmark and the back arrow under it both go to `/`. It reads fine; it is one more thing than the screen needs.
- **N5. "Save $20.88" sits on the yearly row's top edge,** 12px under the monthly row at 320. It reads, and nothing overlaps.
- **N6. The three guides the tiles open still underline "Back to Ruken"** (two underlined links on `/help/github` at this head), and `/sign-in` underlines "Forgot your password?" and "Create an account". Outside this change; they belong to the app-wide thread on underlined links.
- **N7. Short pages scroll a little.** A card that fits the window still leaves 8px to scroll on a phone and 48px on a tablet and computer (page height 648 in a 640 window; 1128 in 1080; 768 in 720). `/sign-in` does the same at this head, so it is the shared layout's bottom margin, not this change.
- **N8. The whole-page pictures over a clip show the clip ending at the first window's height.** That is how a whole-page capture draws a fixed layer (`.behindcard` is `position: fixed; inset: 0`); in a real window the clip stays behind the card as it scrolls.
- **N9. Phone sizes were shot in Chromium.** The `phone` project in CI is Safari's engine; the wrap points in R1 to R3 may differ by a few pixels there, so the fixes' journeys should run on that project too.
