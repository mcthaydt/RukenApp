# Submission screens: the design pass (visual review, step 2)

2026-11-15, branch `slice-2/submit` (pull request #63), at `99a9a87` (the code of the green `6eae0ba` plus one tracker commit). This pass only finds. Nothing but this report and one tracker line was changed.

**The short of it.** Three things would stop a maker or look broken, and all three are on phones or on Live: on **Live the "Ruken" wordmark is hidden** behind the blurred video on every view (M1); on an **upright phone, Check and send squeezes the game's name and line into a strip** beside the tall video, breaks words in the middle and, on an iPhone SE, pushes "Change" off the right edge (M2, M3); and **on five questions the words that say what is wrong land under the pinned bar**, so the maker sees a ring and no reason (M4). The rest is polish. Colours, corners and touch targets are right everywhere.

37 findings: 7 must, 14 should, 16 small.

## What ran, and what did not

- The app was run in this session's container from the branch (`pnpm build`, `wrangler dev`, a local Postgres, the tests' stand-in GitHub, mail and Stripe). **No test, lint or typecheck was run.**
- A throwaway script outside the repository made three accounts and about 22 games, one in every state, and took **420 views: 42 screen states on 10 views**, each as the first screenful, the whole page and the foot of the page. 0 errors.
- The 10 views: iPhone SE (320 by 568), a large iPhone (iPhone 15 Pro Max), a Pixel 7 and an iPad (810 by 1080), each upright and sideways, and full pages at 1440 by 900 and 1280 by 720.
- The 42 states: your games (empty, full); question 1 (new, refused, changing a name); question 2 (short, a 60-letter name); the files question (connect, the list, a broken repository, "Pick another", done); where it plays (and refused); the upright video (empty, refused, with a video); the wide video (empty, with a video); who it is for (and refused); the 18+ question (and refused); other websites (and refused); the agreement in the flow; `/legal/agreement`; Check and send (short, long name and line); the full-screen video; Waiting for review; Sent back (two fixes, one fix, all fixed); Live (plain, long name, update waiting, update sent back, "Send it again"); Throw it away; `/help/record-screen`; the GitHub how-to.
- Every view was looked at, as contact sheets of the first screenful for all ten views and of the whole page where a page scrolls.
- Each view was also measured in the page: width past the window, things outside the window, targets under 44 by 44, targets under 8px apart, clipped boxes, red, round shapes, text under 14px, and anything the pinned bar covers when the page is scrolled to its foot.

Not done, and why:

- **Chromium only.** The container has no WebKit, so the iPhone and iPad views are Chromium at those sizes with touch. Safari's own text sizes, its video controls and its bars were not seen.
- **Nothing was seen moving.** Stills only: the step between questions, the drifting circles and playing video were not judged.
- No real device, no keyboard up on a phone, no large text setting, no reduced motion.
- "Pick another" on the files question (S13) is read from the still, not measured with a scroll position.
- Your games is outside this pass's scope; one thing seen on the way is noted last.

## Measured, all 420 views

| Check | Result |
|---|---|
| Page wider than the window | none |
| Touch targets under 44 by 44 | none |
| Red | only "Throw it away" on the Throw it away screen (`rgb(203, 47, 67)`), all 10 views |
| Round shapes | only Live's five drifting circles |
| Text under 14px | none |
| Covered by the bar at the page's foot | nothing on the maker screens |
| Wider than the window, clipped | iPhone SE upright only: Check and send (short and long) 330 in a 320 window; Sent back, all fixed, 354 in 320 |
| Outside the window | iPhone SE upright only: "Change the wide video" on Check and send (short and long) and on Sent back, all fixed |

## What is right

- **Colour.** One blue button a screen, green Back, Keep it and Close, red only on "Throw it away". No pill, no circle outside Live.
- **Touch.** Every target is at least 44 by 44 on every view.
- Question 1 on all ten views; the track and "Question 5 of 7"; "press Enter" only on computers and never beside "Choose video" or "Send for review".
- The pinned bar on phones and the upright iPad: the blue button is always in reach.
- The upright video question once it is refused: it scrolls its reason into view above the bar on every view. (The others do not: M4.)
- Check and send, Waiting and Sent back on computers and both iPads: two videos in a row, name and line full width, facts as square chips.
- Throw it away: Keep it is first and has the ring, red is second, "You can't undo this." is plain.
- The two how-to pages read cleanly at every size.

## Must fix

**M1. Live: the "Ruken" wordmark is hidden.**
Screen: Live, all five states. Views: all ten. On phones a faint "R" shows; on computers nothing. The blurred video (`.backdrop`, `position: fixed; z-index: 0`) is painted over the top bar, because only `main.live` is raised (`z-index: 1`) and `.topbar` is not. The way home is not seen, and the backdrop is on top of it, so it likely cannot be pressed either (not tried).
Fix: raise the top bar above the backdrop on Live (`position: relative; z-index: 1` on `.topbar`), or put the backdrop under everything in `.screen` (`z-index: -1` with `isolation: isolate` on `.screen`).

**M2. Check and send on an upright phone: the name and the line are squeezed into a strip.**
Screens: Check and send; Waiting for review; Sent back, all fixed ("All ready to send"). Views: iPhone SE, large iPhone, Pixel, upright. The tall video takes the left; the wide video, the name, the line and their "Change" links share what is left (about 115px on an SE, 205 to 225 on the others, read off the pictures). Words break in the middle: "Harbo / r 09ec", "wonderf / ul", "Wobbl / ebotto / m"; inside the Sent back card on an SE, "Ho / urs" and "abou / t", "tappi / ng.". A 100-letter line is 13 lines on an SE, a 60-letter name 9. Under "On phones" the left column is then empty for the rest of the page.
Fix: on a window under 500 wide, lay it out as the iPad does: the two videos in one row (they may shrink, as the sideways phone already does), then the name, the line and the facts across the full width. Never break inside a word unless the word alone is wider than the line (`overflow-wrap: break-word`, not `anywhere`).

**M3. "Change" and "Hide" break in the middle of the word, and on an iPhone SE run off the right edge.**
Screens and views: Check and send, short and long, iPhone SE upright: "Chan / e" beside "On computers" runs past the window (measured: the screen is 330 wide in a 320 window, and "Change the wide video" lies outside it); "Chang / e" beside "Plays on phones and computers". Sent back, all fixed, iPhone SE upright: "Hid / e", and the "Change" beside "On computers" is cut to "C / e" at the card's edge (354 in 320). Live, long name and update sent back, iPhone SE upright: "Chang / e". Check and send, iPad sideways: "Chang / e" beside "On phones".
Fix: `white-space: nowrap` on these links, let a link drop to the next line whole, and give the grid's children `min-width: 0` so nothing pushes past the window.

**M4. A refused answer's reason is under the pinned bar.**
The ring shows; the words that say why do not, until the maker scrolls.
- Question 1, refused: iPhone SE sideways.
- Where it plays, refused: iPhone SE upright and sideways; Pixel sideways (half cut).
- Who it is for, refused: iPhone SE, large iPhone and Pixel upright (on the Pixel the line is half cut); all three phones sideways.
- The 18+ question, refused: iPhone SE upright; all three phones sideways.
- Other websites, refused: iPhone SE sideways; Pixel sideways (cut).
Fix: do what the video question does: after a refusal, scroll the reason into view, with a scroll margin as tall as the bar. Or put the reason above the choices, under the heading.

**M5. The wide video question on a sideways iPhone SE: the heading is crushed.**
Screen: wide video, empty and with a video. View: iPhone SE sideways (568 by 320). The frame takes the row and leaves the words about 125px: "Question 6 of / 7", then "Add / your / wide / video" on four lines, and the notes and the how-to link are under the bar. On the large iPhone and the Pixel sideways the words have about 200px: the notes wrap to eight short lines, the last two under the bar, and "How do I record my screen?" is not on the first screenful.
Fix: on a sideways phone put the wide frame under the heading (it is short there), or cap the frame at half the row.

**M6. Sent back: two cards touch.**
Screens: Sent back with two things to fix; Live with more than one. Views: all ten. The second "Needs fixing" card starts exactly where the first ends (0px), so the two read as one card with a dent. `a.sheet.fix { margin-block: 0 }` cancels the gap the page gives its other cards.
Fix: 12 to 16px between cards.

**M7. A long name in a question's heading.**
Screens: question 2 with a 60-letter name; the same name goes into the headings of where it plays, who it is for, the 18+ question and other websites. Views: iPhone SE upright (the heading is 8 lines and the answer box is at the bar), iPhone SE sideways (the box is cut by the bar), Pixel sideways (the hint is cut). Long words break in the middle and leave one letter on a line.
Fix: put the name on the small line above ("Question 2 of 7 · the name") and keep the heading to the question, or step the heading down a size once it passes three lines.

## Should fix

**S1. Numbers in headings and names are thin beside heavy letters.**
Screens: everywhere a name or a count is set in the heading face: "Throw Tiny Tapper 9979 away?", "Who is Deep Field 4d5b for?", "Glass Harbor 09ec", "12+", "6 accepted", "Say what Low Tide 5238 is." Views: all ten; loudest at 48 to 64px on the iPad and computers. `Ruken Digits` is Schibsted Grotesk at weight 400 standing in for the digits of a heavy serif, so "d1fd" reads as three typefaces. A real name with a number in it ("Game 2") will show it.
Fix: use the 600 or 700 file for `Ruken Digits` where it stands in a heading, or let the serif draw its own digits.

**S2. The refused ring touches the hint under it, and looks like the focus ring.**
Screens: every refused question. Views: all ten. The ring's lower edge is about 2px from the hint and on computers runs over the top of "We check this when we look at your game." (old F19, still there). The refused ring (4px, 3px out) and the focus ring (3px) cannot be told apart, so a refused box looks merely focused.
Fix: 12px under a ringed box; give "refused" its own sign, such as the reason's words directly under the box in the same white.

**S3. The one-line answer shows about 20 of its 100 letters on a phone.**
Screen: question 2 with a long line. Views: the three phones, upright. The box is one line at 24px, so the maker sees the tail of what they wrote and not the line.
Fix: a box that grows to two or three lines on a phone, or 18px text there.

**S4. The first screenful on a phone hides what the maker needs.**
- Files question, connect: iPhone SE upright: "New to GitHub?" and the note are under the bar.
- Upright video, empty: iPhone SE upright: both notes and "How do I record my screen?" are under the bar; large iPhone: the link is just under it.
- Upright video, chosen: iPhone SE upright: only the video shows; "Choose a different video" is below.
- Where it plays: iPhone SE sideways: both choices are cut by the bar.
- Who it is for: sideways phones show two to four of the five ages.
Fix: on short windows put the notes and the how-to link above the frame, shrink the frame to what is left, and let the choices be shorter.

**S5. The two links under a video are set three ways, with no room between them.**
Screens: both video questions. "How do I record my screen?" is 18px white while the files question's how-to links are 14px sage: two looks for one kind of link. The link hugs the note above it (0px). With a video chosen, "How do I record my screen?" and "Choose a different video" are stacked with 0px between on phones and the 1440 upright question, and side by side 4px apart on both iPads and on the wide question on computers, where they read as one underlined run.
Fix: one look for how-to links; always one link a line; 8px between; "Choose a different video" first, since it is the action.

**S6. "Throw this game away" lines up with nothing.**
Screens: every question, Check and send, Sent back. On the upright iPad, sideways phones and computers it sits at the window's left edge, left of the column and, on computers, left of the wordmark too. On upright phones it sits right under the answer, mid-screen, not at the page's foot. On sideways phones it peeks half-cut above the bar (see P13).
Fix: start it at the column's left edge and keep it at the foot of the page, clear of the bar.

**S7. On an upright iPad four screens start at the window's edge, the questions further in.**
Screens: Check and send, Waiting, Sent back, Live. View: iPad upright. Their words start at the window's edge and their bar runs the whole width; every question starts further in, with a bar as wide as its column. Going from question 7 to Check and send the page jumps left. The tracker records this as a kept deviation (F8) left for the Owner's look, because two 300-tall videos need the width. From this pass: it does read as a jump.
Fix, if the Owner wants it: keep the wide row for the videos only and start the words and the bar where the questions start.

**S8. Live after a fix: the thing to do is the quiet button.**
Screen: Live, "Send it again". Views: all ten. The line says "Fixed. Send it again when you're ready.", but "Send it again" is the outline button and the blue one is "See it on Ruken". On Sent back the same step is the blue button, and on Live with something still to fix the blue button is the fix. On a sideways iPhone SE the outline button's note is under the bar.
Fix: when a send is waiting on the maker, make it the blue button and "See it on Ruken" the link, as the "to fix" state already does.

**S9. The full-screen video leaves a strip of page under it.**
Screen: a video opened from Check and send. Views: 1280 by 720: scrolling shows a strip of green page with "Throw this game away" under the player. Pixel upright: a black band above the video with Close half on it. The controls are the browser's own, so Safari's will differ (not seen).
Fix: make the viewer cover the window and stop the page behind from scrolling.

**S10. Other websites: the typed words sit on the box's top edge, and the box shrinks when refused.**
Screen: other websites, refused. Views: all ten. "not a website" touches the top of the box (no room above the first line), and the box is about a quarter shorter with the ring than without (read off the pictures at 1440: about 118px, then about 89px), so the page jumps.
Fix: the same padding as the one-line boxes; one height in both states.

**S11. The agreement on a computer: "I agree" comes before the words, and Enter agrees.**
Screen: the agreement in the flow. Views: 1440, 1280, iPad sideways: the button is at the top left beside clause 1 with six clauses below the fold, and computers show "press Enter" beside it. A stray Enter agrees to a contract.
Fix: drop the Enter hint (and the key) on this screen. Consider the button after the last clause on wide windows.

**S12. The agreement on an iPhone SE: a third of the card is indent.**
Screens: the agreement in the flow and `/legal/agreement`. View: iPhone SE upright. The numbers take about 64px of a 280px card, the words get about 195px, and clause 3 runs 13 lines.
Fix: on a window under 400 wide, hang the number in a 28px gutter.

**S13. Files question: small things on an iPhone SE.**
The repository's name breaks at its hyphen in the list ("ruken-test/broken- / game") and inside the refusal's sentence (also on computers). Four small lines in three styles are stacked under the list (old F18). After "Pick another", the first screenful looks the same as before (the card on top, the button now "Next") and the Folder box with the ring is below it (from the still; not measured).
Fix: do not break a repository's name at a hyphen; two notes at most; scroll to the box that takes the focus.

**S14. The record-your-screen page is four devices long.**
Screen: `/help/record-screen`. Views: phones: three screens of scrolling; an Android maker passes the iPhone steps first, a Mac maker passes three others.
Fix: four links at the top ("iPhone or iPad", "Android phone", "Windows computer", "Mac"), or open only the one that matches the device.

## Small

**P1.** Where it plays: "Phones and computers" has no second line, so the two cards are uneven (old F17). All views.
**P2.** "What players will see": a small video at the left and empty white to its right (old F16). iPad sideways and computers. On the wide video question the card shows only the upright video, so the maker's new wide video appears nowhere in it.
**P3.** "Needs fixing" card with a video: the video is about 145 wide and the rest of the card is blank. All views.
**P4.** Upright video frame on upright phones and the upright iPad hugs the left with about 45% of the row empty beside it. On sideways phones "Taller than wide" touches the frame's edges.
**P5.** Throw it away: the heading breaks "Throw Tiny / Tapper / 9979 away?" on phones and the upright iPad, where there is room for two lines; on tablets and computers the two buttons are different widths and stacked at the left.
**P6.** Waiting for review and Live say the game's name twice in one screenful: the small line over the heading, and the big name beside it.
**P7.** Two names for one thing: "The maker agreement" in the flow, "Maker agreement" on `/legal/agreement`.
**P8.** Going from a question to a how-to page or `/legal/agreement` on a phone, the wordmark moves about 4px left and about 12px up, and the side margin gets about 4px narrower (read off the pictures).
**P9.** Live with an update sent back, computers: the fix card is about 670 wide and the video under it about 470; ragged right edges.
**P10.** Live with an update sent back, phones: "See it on Ruken" (18px white) sits right over "Back to your games" (14px sage); two link looks, close together.
**P11.** Live while an update waits for review still offers "Send a new version" with the same note. A question for the Owner more than a fault: should a second send be offered while one is waiting?
**P12.** Sent back, "6 accepted": "Show" is a small link at the far right of a wide bar; the whole bar could be the target.
**P13.** Half-cut links peeking over the bar on sideways phones: "Throw this game away" on the questions; "Back to your games" on Live, update sent back (iPhone SE); "Change something" on Waiting (Pixel).
**P14.** Check and send, upright phones: the blue bar is over the facts on the first screenful, so the maker sends before seeing the last three facts unless they scroll. Words such as "Check it, then send" help; a smaller video row (M2) fixes it.
**P15.** Live's blurred backdrop takes the colours of the game's own video. With the test video the upright phone is navy with a grey-brown right edge. Worth a look with real videos before launch; nothing to fix now.
**P16.** Outside this pass's scope, seen on the way: Your games on an iPhone SE: the picture takes a third of the card and names wrap to three lines.

## Old findings still open

From `2026-11-15-maker-screens-rebuild-screen-review.md`: F16 (P2), F17 (P1), F18 (S13), F19 (S2). F8 is S7.
