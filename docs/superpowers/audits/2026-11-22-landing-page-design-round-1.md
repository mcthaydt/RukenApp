# The landing page (/about): design review, round 1

- Commit examined: pictures shot at 48e45f0 (branch claude/project-thread-2vpwcj); styles and words read from the source at the same commit.
- Written: 2026-11-22 15:50 UTC
- Reviewer: fresh session, Fable 5.2, medium (Settings, design review round 1).
- What ran: `visual-check` step 1 (words and design) on all 28 pictures in /mnt/project-files/design-loop/landing-page/round-1-48e45f0/, one by one: /about signed out, signed in and top screen only, and /join, /sign-in, /me and /help, each at 320, 375, 810 and 1280 wide (shot at 2x). The signed-in /about pictures were also compared with the signed-out ones pixel by pixel. Contrast, sizes and positions were measured from the pixels. `src/routes/about/sections.ts`, `+page.svelte` and the `.about` rules in `src/lib/look.css` were read. Judged against the acceptance criteria and layout sketch in docs/superpowers/specs/2026-11-22-landing-page-design.md and the owner's rules (frosted glass for anything see-through; an app feel at all times).
- What did not run: the app, the tests and the walk (step 2 is already done). The focus ring and keyboard order cannot be seen in still pictures and are not judged here. No code changed.
- Verdict: FAIL for this round. 2 medium and 6 low defects, 6 notes. Nothing is broken or unreadable; the page reads well on a phone. The fixes are all in `look.css` and three screens' markup.

## What passes

| Check | Result | Evidence |
| --- | --- | --- |
| Sections in the spec's order, each with its heading (criterion 2) | PASS | All four sizes: ways in, news line, hero, makers, players, One price, How Ruken works, Bring your fans, Safe to play, Makers' pay, two closing cards, two link columns. |
| One blue button, visible without scrolling | PASS | "Watch the feed" is the only filled blue button. Its bottom edge is at 537 of 640 (320 wide), 509 of 667 (phone), 702 of 1080 (tablet), 656 of 800 (computer). |
| The real clip, in a phone shape (criterion 3) | PASS | Floor Fifty's clip, 288 wide, with its name linked under it. On computer and tablet it is in the first screen whole; on phones the first screen shows its top 126 px (phone) and 71 px (320), under the button. |
| The price matches the paywall card (criterion 4) | PASS | /about: "$9.99 a month, or $99 a year". /join: "$9.99 a month", "$99 a year". |
| "What is Ruken?" on the four screens (criterion 6) | PASS | Present on /join, /sign-in, /me and /help at all four sizes. See D2 and D8 for where it sits. |
| Nothing overflows sideways (criterion 9) | PASS | No picture is wider than its window; no word is cut at 320. |
| No see-through surface (criterion 8, the glass rule) | PASS | Measured: paper cards are flat #ffffff, the four membership panels flat #111314, the clip frame opaque. Nothing shows through anything, so no glass is needed. |
| Contrast | PASS | White on felt 14.3:1. Sage (news line, "For makers", tax note) on felt 8.5:1. Slate "For makers" on a card 10.0:1. White on the blue button 5.35:1. Blue outline words on white 5.35:1. White on the black panels 18.6:1. |
| Button sizes | PASS | Blue button, outline buttons and "Join Ruken" all measure 48 tall. |
| Signed in | PASS | The only difference from signed out is that "Sign in" is gone from the top row (pixel compare: phone and tablet differ in that one box only; computer and 320 differ also in the clip's frame, which is the video playing). |

## Defects

**D1, medium. Computer and tablet: the lower half is not a centred column.** The sketch says "Everything else is one centred column." Measured on about-computer.png: from "How Ruken works" down to "Read the maker agreement" (about 965 px of page) the words run from x=64 to x=685 and the right 576 px of the window are empty. The footer links sit at the left edge too. The page reads as half finished on a computer; tablet has the same lean with less room. The pull request draft names no difference from the sketch. Expected: these sections centred as the sketch says. Bounded fix: centre `.about .plain` and `.sitefoot` (`margin-inline: auto`) from 48rem up, or name the left-aligned column in the pull request with a reason.

**D2, medium. /me: "What is Ruken?" sits 32 px above "Delete my account".** me-phone.png: the two lines are 32 px apart (rows at 887 and 951 in the 2x picture), and each link's tap area is 48 tall (`--size-target`), so the two overlap by 16 px. A thumb aimed at the new link can land on the delete link. Same at all four sizes. Expected: the look's own rule, "a few pixels of air". Bounded fix: move "What is Ruken?" up beside "Make games? Add yours to Ruken." or give it a full line of space above "Delete my account".

**D3, low. 320 wide: "Sign in" wraps under "For players" with no row gap.** about-320.png: the two rows are 28 px apart, so the 48-tall tap areas overlap by 20 px, and "Sign in" looks orphaned. Bounded fix: `row-gap` on `.about .ways` (0.75rem or more), or a smaller `column-gap` so the three fit on one row.

**D4, low. Tablet: the headline breaks mid-sentence.** about-tablet.png and about-top-tablet.png: "Watch a / game. Then / play it." in three lines, 388 px wide. Phone, 320 and computer all show "Watch a game. / Then play it." Bounded fix: set the two sentences as two lines (a break after "game.") and let the size shrink until the longer one fits the tablet's left half.

**D5, low. 320 wide: the makers card title breaks badly.** about-320.png: "Made a / game? Let / people play it." At 375 it is "Made a game? / Let people play it." Bounded fix: the same step the look already takes for card titles under 360 wide (`.screen .card h1` drops to the statement size): apply it to `.about .card h2`.

**D6, low. 320 wide: "Put your game on Ruken" wraps to two lines, set left.** about-320.png, in the makers card and the closing card. In the closing cards the button beside it ("Watch the feed") is centred and full width, so the pair does not match. Bounded fix: centre the words in a wrapped button; the D5 fix may also give it room.

**D7, low. The membership panels: a stray word on phone, tall thin panels on tablet.** about-phone.png: "$9.99 a month, or $99 a / year". about-tablet.png: four panels about 185 wide, one of them six lines ("Your money / helps pay / the makers / whose / games you / play") beside one of three, with about 100 px of empty black under the short ones. Bounded fix: `text-wrap: balance` on `.about .perks li`; two by two between 48rem and about 64rem, four in a row above that.

**D8, low. The numbers in "How Ruken works" hang in the gutter, with a gap before the dot.** All sizes (z crop of about-320.png): "3 ." starts at x=9 where every other line starts at x=16, and the digit and its dot are a space apart. The bullets in "Safe to play" sit inside the column. Bounded fix: `list-style-position` or padding so the numbers start at the column's edge; set the marker in the text face (or `font-variant-numeric`) so "3." is tight.

## Notes (ideas, not defects)

- N1. /help: "What is Ruken?" follows "Record your screen" at 44 px where the guides are 56 px apart, so it reads as a fourth guide. A little more space above it, or a place beside "Back to Ruken", would set it apart. Tablet, makers card: "Help for makers" drops under its button while "See the price" stays beside its button in the players card.
- N2. Words. All plain and short. Three lines a tired reader may stumble on: "half of what they pay makers goes to you" (Bring your fans); "Statements are final on the 10th" (the page never says what a statement is); "After tax and Stripe's fees" (Stripe is not introduced). Any rewrite must keep the maker agreement's meaning.
- N3. Computer: the top is three stacked rows (the name, the links, the news line) where Lyft's is one bar. The sketch only draws the phone's top, so this is not a difference from it. One row with the name left and the links right would use the width.
- N4. The four membership panels are #111314 on #112f2c felt: 1.3:1, so their edges are faint. They are the look's own "panels on the felt" token; the white words on them are what a person reads.
- N5. The blue button on felt is 2.67:1 at its edge. Its white words (5.35:1) and its size carry it. This is the look's blue everywhere, not this page's choice.
- N6. The dark band at the bottom of the phone frame (about 23 px, #2f2530) is in Floor Fifty's own clip, not the page. App feel: nothing in the pictures breaks it (no see-through layers, no browser-default controls on /about); what a held finger or a pinch does cannot be seen in a still.

## Every picture

- about-320, about-signed-in-320, about-top-320: D3, D5, D6, D8. The rest clean.
- about-phone, about-signed-in-phone, about-top-phone: D7 (stray "year"), D8. The rest clean; this is the size the page suits best.
- about-tablet, about-signed-in-tablet, about-top-tablet: D1, D4, D7, D8, N1.
- about-computer, about-signed-in-computer, about-top-computer: D1, D8, N3.
- join-320, join-phone, join-tablet, join-computer: clean. "What is Ruken?" sits under "Not now", 43 px apart.
- sign-in-320, sign-in-phone, sign-in-tablet, sign-in-computer: clean. "What is Ruken?" is the last line, 44 px under "Create an account".
- me-320, me-phone, me-tablet, me-computer: D2.
- help-320, help-phone, help-tablet, help-computer: clean; N1.
