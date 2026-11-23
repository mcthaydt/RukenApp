# The landing page (/about): design review, round 2

- Commit examined: pictures shot at adde553 (branch claude/project-thread-2vpwcj); the branch head f2f06ca only reformats `look.css`, so the pictures stand for it. Styles and words read from the source at f2f06ca. This audit is committed directly on f2f06ca.
- Written: 2026-11-22 16:13 UTC
- Reviewer: fresh session, Opus 5.5, medium (Settings, design review round 2).
- What ran: the round 1 defects D1 to D8 checked from the pixels, then `visual-check` step 1 (words and design) on all 28 pictures in /mnt/project-files/design-loop/landing-page/round-2-adde553/, one by one: /about signed out, signed in and top screen only, and /join, /sign-in, /me and /help, each at 320, 375, 810 and 1280 wide (shot at 2x). The signed-in /about pictures were compared with the signed-out ones pixel by pixel. Contrast, sizes and positions were measured from the pixels (numbers below are in CSS pixels, half the picture's). The diff adde553 (`look.css`, `about/+page.svelte`, `about/sections.ts`, `me/+page.svelte`, the spec's layout line) was read. Judged against the acceptance criteria and layout sketch in docs/superpowers/specs/2026-11-22-landing-page-design.md and the owner's rules (frosted glass for anything see-through, an app feel at all times, spinners for every wait, no browser-default controls).
- What did not run: the app, the tests and the walk. The focus ring, keyboard order, the clip's loading spinner and what a held finger or pinch does cannot be seen in still pictures and are not judged here. No code changed.
- Verdict: **PASS** at f2f06ca. All eight round 1 defects are fixed. No new defect found. 7 notes, none blocking.

## Round 1 defects

| | Round 1 | Now | Evidence |
| --- | --- | --- | --- |
| D1 | Computer and tablet: lower half hugged the left, right 576 px empty | FIXED | about-computer: from "One price" to "Read the maker agreement" the column runs x=320 to 960 in a 1280 window (320 each side); the foot links sit at x=472 to 808, centred. about-tablet: column x=85 to 725 in 810 (85 each side). The spec's layout line now says the membership is two by two in the column. |
| D2 | /me: "What is Ruken?" 32 px above "Delete my account", tap areas overlapped 16 px | FIXED | Line centres now 57 px apart at all four sizes (me-phone rows 887–917 and 1004–1028 in the 2x picture). Two 48-tall areas leave 9 px clear. |
| D3 | 320: "Sign in" wrapped with no row gap, areas overlapped 20 px | FIXED | about-320: rows at 79 and 127, 48 apart, so the two 48-tall areas meet and do not overlap. |
| D4 | Tablet headline "Watch a / game. Then / play it." | FIXED | Two lines, "Watch a game." / "Then play it.", at all four sizes; set at 3rem between 48rem and 64rem. |
| D5 | 320: makers card title in three lines | FIXED | about-320: "Made a game? / Let people play it." in two. |
| D6 | 320: wrapped "Put your game on Ruken" set left | FIXED | about-320: both wrapped buttons (makers card, closing card) centre their two lines, matching "Watch the feed" above. |
| D7 | Membership: stray "year" on phone, six-line panel on tablet | FIXED | Phone: "$9.99 a month, / or $99 a year". Tablet and computer: two by two, the longest panel three lines; panels in a row share a height. |
| D8 | Step numbers hung in the gutter, "3 ." gap | FIXED | about-phone: the numbers start at x=16.5, the heading at x=17; the words at x=48. "1." "2." "3." are tight, in the text face. |

## What passes

| Check | Result | Evidence |
| --- | --- | --- |
| Sections in the spec's order (criterion 2) | PASS | All four sizes, signed in and out. |
| One blue button, visible without scrolling | PASS | "Watch the feed" is the only filled blue button, 48 tall at all sizes; its bottom edge at 557 of 640 (320), 509 of 667 (phone), 653 of 1080 (tablet), 656 of 800 (computer). |
| Layout against the sketch | PASS | Computer and tablet: hero in two halves, makers and players cards side by side, closing cards side by side, everything between them one centred column with the membership two by two in it. Phone and 320: one column. |
| The real clip, in a phone shape (criterion 3) | PASS | Floor Fifty's clip, 288 wide, its name linked under it. |
| Price matches the paywall card (criterion 4) | PASS | /about "$9.99 a month, or $99 a year"; /join "$9.99 a month", "$99 a year". |
| "What is Ruken?" on the four screens (criterion 6) | PASS | /join, /sign-in, /me, /help at all four sizes. |
| No sideways overflow (criterion 9) | PASS | Every picture is exactly its window wide (640, 750, 1620, 2560 at 2x); no word cut at 320. |
| No see-through surface (criterion 8, the glass rule) | PASS | Paper cards flat #ffffff; the four membership panels flat #111314; clip frame opaque. Nothing shows through anything, so no glass is needed. |
| Contrast | PASS | White on felt (#112f2c) 14.3:1. Sage (#b4cdc2: news line, "For makers", tax note) on felt 8.5:1. White on the membership panels 18.6:1. White on the blue button (#006eb8) 5.35:1. Blue outline words on white 5.35:1. |
| Sizes | PASS | Blue button and outline buttons 48 tall; the two-line wrapped buttons at 320 about 62 tall. |
| Signed in | PASS | Phone, tablet, computer: the only difference from signed out is the "Sign in" box and the playing clip (pixel compare: tablet and computer differ in one box at y=127–144). 320: the page is 48 shorter (the "Sign in" row is gone); the rest is the same words, offset by sub-pixel text smoothing only (checked by eye on a band). |
| Words (criterion 10) | PASS | Plain and short; one blue button per screen. |

## Notes (ideas, not defects)

- N1. Computer: the page now has three left edges, the hero and cards at x=64, the middle column at x=320 and the foot links at x=472. It reads as intended (wide blocks, a narrow reading column), but the three short rows at the top (the name, the links, the news line) stay at x=64 on a 1280 window; round 1's N3 (one top bar, name left, links right) would tidy it. The sketch draws only the phone's top, so this is not a difference from it.
- N2. Tablet and computer: the players card is shorter than the makers card, so it carries about 150 px (tablet) and 60 px (computer) of empty white under its buttons, since the pair share a height. Tablet: "Help for makers" still drops under its button while "See the price" stays beside its button (round 1 N1).
- N3. Phone: the foot links are 36 px apart, so their 48-tall areas overlap by 12 px. That is the look's own rule for stacked links ("a few pixels of air, never of words") and the same on every screen, not this page's choice; none of them is destructive.
- N4. /help: "What is Ruken?" follows "Record your screen" at 44 px where the guides are 56 px apart, so it still reads as a fourth guide (round 1 N1, unchanged).
- N5. Words a tired reader may stumble on, unchanged from round 1 N2: "half of what they pay makers goes to you", "Statements are final on the 10th", "After tax and Stripe's fees". Any rewrite must keep the maker agreement's meaning.
- N6. /sign-in (all sizes): the country box shows the browser's own drop-down arrow, and /join's two price choices are radio buttons. The owner's 15:51 UTC rule ("EVERYTHING should be custom") is being handled in its own thread ("Replace built-in browser controls with custom ones"); this change does not touch those controls, so it is not a defect here.
- N7. The membership panels are #111314 on felt, 1.3:1 at their edges, and the blue button's edge on felt is 2.67:1 (round 1 N4, N5). Both are the look's tokens; the words on them carry the contrast.

## Every picture

- about-320, about-signed-in-320, about-top-320: clean. D3, D5, D6, D8 fixed.
- about-phone, about-signed-in-phone, about-top-phone: clean; N3. D7, D8 fixed.
- about-tablet, about-signed-in-tablet, about-top-tablet: clean; N2. D1, D4, D7, D8 fixed.
- about-computer, about-signed-in-computer, about-top-computer: clean; N1, N2. D1, D8 fixed.
- join-320, join-phone, join-tablet, join-computer: clean; N6.
- sign-in-320, sign-in-phone, sign-in-tablet, sign-in-computer: clean; N6.
- me-320, me-phone, me-tablet, me-computer: clean. D2 fixed.
- help-320, help-phone, help-tablet, help-computer: clean; N4.
