# Submission screens: the second look (visual review, step 4)

2026-11-15, branch `slice-2/submit` (pull request #63), at `b541d53` (the code of the green `5fe1d50` plus one tracker commit). This look only finds. Nothing but this report and one tracker line was changed.

**The short of it.** Nothing here would stop a maker. All seven musts from the design pass are fixed, and so are most of its shoulds. What is left is mostly about short windows. On phones, and on a 1280 by 720 computer, help and choices still sit under the pinned bar or below the first screen (L2, L4, L5). The one-line box still shows only a slice of what was typed (L3). The new take-off flow works and its confirm screen is right. But the link to it on Live is not quiet: it is bigger and brighter than "Back to your games", and it sits in the top block right under the blue button's note (L1). Colours, corners, text sizes and page widths are right on every view. One link is under 44 wide.

25 findings: 0 must, 8 should, 17 small. Of the 15 design-pass findings left open, 10 are still a problem (S3, S4, S7, P2, P3, P4, P6, P8, P14, P16), 2 are partly fixed (P5, P9), and 3 need nothing now (P10, P12, P15).

## What ran, and what did not

- **CI pictures.** Run 43750058698 on `5fe1d50` (the whole suite, green). Its screen journeys left 390 pictures of the maker screens across the nine projects: Pixel 7 upright and sideways; iPad upright and sideways, in Chromium and in Safari's engine; iPhone 15 upright and sideways in Safari's engine; Chrome at 1280 by 720. About 30 were opened one by one: the Safari-engine phones and iPads, and the computer. Those are the views the local pictures cannot stand in for.
- **Local pictures.** The app was run in this session's container from `b541d53` (`pnpm build`, `wrangler dev`, a local Postgres, the tests' stand-ins for GitHub, mail and Stripe). A throwaway script outside the repository made the accounts and games. It took **840 pictures: 42 screen states on 10 views, each as the first screen and as the whole page.** Every first screen was looked at, as one contact sheet per state with all ten views side by side. The whole pages were looked at where a page is longer than its window. Each view was also measured in the page, with the same checks as the design pass. A second small script measured the positions quoted in L1, L2, L12, L14, L15, L18 and L21.
- **The 10 views:** iPhone SE (320 by 568), a large iPhone (iPhone 15 Pro Max), a Pixel 7 and an iPad (810 by 1080), each upright and sideways; and full pages at 1440 by 900 and 1280 by 720.
- **The 42 states:**
  - Your games (empty, full).
  - Question 1 (new, refused, changing a live game's name).
  - Question 2 (short, a 60-letter name).
  - The files question (connect, the list).
  - Where it plays (new, refused, refused with a long name).
  - The upright video (empty, refused, with a video).
  - The wide video (empty, with a video).
  - Who it is for (and refused).
  - The 18+ question (and refused).
  - Other websites (and refused).
  - The agreement in the flow, and `/legal/maker-agreement`.
  - Check and send (short, long name and line, the full-screen video).
  - Waiting for review.
  - Sent back (two to fix, one, all fixed).
  - Live (plain, long name, update waiting, update sent back, fixed and ready to send again).
  - Take it off (the confirm screen, and the game after it).
  - Throw it away.
  - `/help/record-screen` and `/help/github`.

Not done, and why:

- **No test, lint or typecheck was run.** Tests run only in CI.
- **Safari's engine only in CI's pictures.** The container has Chromium only. The local iPhone and iPad views are Chromium at those sizes, with touch. The take-off screens were not seen in Safari's engine.
- **Nothing was seen moving.** Only stills were taken. The step between questions, the drifting circles and playing video were not judged.
- No real device, no keyboard up on a phone, no large-text setting, no reduced motion.

## Measured, all 420 views (first screen and whole page)

| Check | Result |
|---|---|
| Page wider than the window | none |
| Anything outside the window | none (the design pass found three on the iPhone SE; all gone) |
| Text under 14px | none |
| Touch targets under 44 by 44 | one: "Mac" on `/help/record-screen`, 36 by 48, on all ten views (L6) |
| Red | only the "Take it off Ruken" button on the take-off screen, and "Throw it away" on Throw it away; all ten views |
| Round shapes | only Live's drifting circles (8 of the 10 views, in each Live state), plus the hidden file input on the video questions |
| A refused answer's reason | in view on every refused question, on all ten views (70 of 70) |
| Focus on the take-off screen | "Keep it on Ruken", on all ten views |

## What is right

- **The design pass's seven musts are fixed, in pictures.**
  - M1: the wordmark shows on Live.
  - M2 and M3: on upright phones, Check and send puts the two videos in a row, with the name, the line and the facts across the full width. No word breaks in the middle, and nothing runs past the right edge.
  - M4: every refused answer's reason is in view (measured).
  - M5: the wide video question on a sideways iPhone SE has its heading back.
  - M6: Sent back's cards have room between them.
  - M7: on an iPhone SE, a 60-letter name's heading is 5 lines, not 8, and the answer box is clear of the bar.
- **Also fixed, in pictures:** S1, S5, S6, S8, S9, S10, S12, S13, S14, P1 and P7. S2 and S11 are partly fixed (L8, L23).
- **Colour, corners and text size:** as measured above. Each screen has one blue button. Back, Keep it and Close are green. Red appears only where something can't be undone.
- **The take-off confirm screen** is right (see its own section).
- **Reads cleanly at every size:** question 1, the files question, both how-to pages and the agreement's page.

## Must fix

None.

## Should fix

**L1. Live: "Take it off Ruken" is not quiet.** (new)

Screens: Live, all five states. Views: all ten.

- The link is 18px white. "Back to your games", under it, is 14px sage, so the take-off link is the loudest link on the screen.
- It sits in the top block with the heading, not at the foot of the page.
- On phones the blue "Send a new version" is pinned at the bottom. Its note ("Copies the newest version of your game from GitHub and sends it for review…") ends right above "Take it off Ruken", so it reads as if it describes taking the game off.
- Measured: on the Pixel, the take-off link is at y=299 and Back at y=353. At 1280 by 720 the take-off link is at y=470, right under the blue button's note.
- The confirm screen keeps a mis-tap safe, but the brief asked for a quiet link.

Fix: set it like "Back to your games" (14px sage). Put it last, at the foot of the page, away from the blue button's note.

**L2. The wide video question at 1280 by 720: the blue button is below the first screen.** (new)

Screen: the wide video, empty and with a video. View: 1280 by 720.

- The frame fills the column, so "Choose video" sits at y=720 to 780 when empty.
- With a video, "Next" sits at y=764 to 824, on a page 920 tall.
- The maker has to scroll to find the one thing to press.
- 1440 by 900 and both iPads are fine.

Fix: cap the wide frame's height so the buttons fit at 720 (about 300 tall), or put the frame beside the words on short computer windows.

**L3. The one-line box shows about a quarter of the line on a phone.** (S3, still)

Screen: question 2 with a long line. Views: the three phones, upright. The box shows about 20 of 86 letters on the SE, and about 30 on the large iPhone and the Pixel. The maker sees the tail of what they wrote, not the line.

Fix, as before: a box that grows to two or three lines on a phone, or 18px text there.

**L4. On a phone, the first screen still hides help and choices under the bar.** (S4, still)

- Question 2: iPhone SE sideways: the bar cuts the hint in half.
- The files question, connect: "New to GitHub?" is under the bar on the SE upright and on all three sideways phones.
- Where it plays:
  - SE upright: the second choice is cut and its line hidden.
  - All sideways phones: the bar cuts both choices.
- The upright video, empty:
  - SE: the notes and "How do I record my screen?" are under the bar.
  - Large iPhone and SE sideways: the how-to link is under the bar.
- The upright video, chosen: "Choose a different video" is under the bar on the SE, the large iPhone and SE sideways.
- The wide video: SE upright and sideways: the bar cuts the format line.
- Who it is for:
  - SE upright: two of the five ages show.
  - Sideways phones: two to four show.
- The 18+ question: "Only adults will see this game…" is under the bar on the SE upright, on all sideways phones, and on the iPhone 15 in Safari's engine (CI).
- Other websites: SE and Pixel sideways: the hint is under the bar.

Fix, as before: on short windows put the notes and how-to links above the frame, and shrink the frame to what is left. Make the choices shorter, one line each when sideways.

**L5. Check and send on phones: the facts are still under the bar.** (P14, still, plus a new sideways case)

- Upright phones: the bar covers the facts (files, where it plays, age, websites) on the first screen. The maker can send without seeing them.
- Large iPhone and Pixel sideways:
  - The first screen is the heading and the two videos, nothing else.
  - The left third, under the heading, stays empty for the whole page.
- SE sideways: the first screen is the heading and the top of the videos.

Fix: on sideways phones, put the name, the line and the facts in the empty column under the heading. On upright phones, a smaller video row, or the facts before the videos.

**L6. "Mac" on the record-your-screen page is 36 wide.** (new)

Screen: `/help/record-screen`. Views: all ten (measured: 36 by 48). The other device links are wide enough only because their names are longer.

Fix: give these links a minimum width of 44.

**L7. Your games on an iPhone SE.** (P16, still)

- A game's name breaks inside a word ("…318346e / 0").
- The picture takes a third of the card.
- About 1.3 cards fit on the first screen.

Fix: a smaller picture on narrow phones, or the name above it. Break names only between words.

**L8. On two questions, the refused ring touches the line under it.** (S2, back)

Screens: who it is for, refused; the 18+ question, refused. Views: all ten. The ring's lower edge sits on "We check this when we look at your game." and on "Only adults will see this game…". The other refused questions have room under the ring.

Fix: the same gap under the ring as the other questions (12px).

## Small

**L9.** (P2, still) "What players will see": a small upright video sits at the left with white beside it (about 113 of 340 wide at 1280, read off the picture). On the wide video question the card still shows only the upright video, so the wide video the maker just added appears nowhere in it. Views: iPad sideways and computers.

**L10.** (P3, still) A "Needs fixing" card with a video: the video is about a third of the card's width (iPad: about 90 of 470) and the rest is blank. All views.

**L11.** (P4, still) On upright phones and the upright iPad, the upright video frame hugs the left and leaves about 40% of the row empty. On a sideways SE, "Taller than wide" touches the frame's edges.

**L12.** (P5, partly fixed)
- Phones: Throw it away's heading is still 4 lines on the SE (2 on the large iPhone and the Pixel). The take-off heading is 4 lines on the SE and 3 on the others (measured).
- Tablets and computers: Throw it away's two buttons are different widths (108 and 169 at 1280). The take-off screen's two match (192 and 191).

**L13.** (P6, still; the Owner's pattern) Waiting and Live say the game's name twice in one screen. With a long name that is 5 lines of name. It is left as the Owner-approved "name over the heading" pattern, and listed so the Owner sees it with a long name.

**L14.** (P8, still, and bigger off phones) The wordmark moves when going from a question to a how-to page or the agreement's page:
- phones: from (20, 20) to (16, 8);
- the upright iPad: from (20, 20) to (85, 48);
- 1280 by 720: from (40, 24) to (320, 48).

The take-off screen keeps (40, 24).

**L15.** (S7, still reads as a jump; the Owner's F8) On the upright iPad:
- the questions, Your games and the taken-off game start at x=85, in a 640-wide column;
- Check and send, Waiting, Sent back and Live start at x=20, 770 wide.

Going from question 7 to Check and send, the page jumps left. The tracker leaves this for the Owner's look.

**L16.** (P9, mostly fixed) Live with an update sent back, on computers: the right edges now line up. The exception is a fix card with no video sitting above the game's own video: the card is wider than the video under it (CI's computer picture).

**L17.** (new) Check and send on upright phones: the captions "On phones" and "On computers" sit at different heights. The upright video's caption drops "Change" to a line of its own; the wide one's does not. Sideways phones and the iPads are fine.

**L18.** (new) The take-off screen's two buttons are 16px apart. Throw it away's are 40px apart. Both are screens that can't be undone, and they should match, at the larger gap.

**L19.** (new) After taking a game off, the screen says only "Off Ruken. You took it off." and offers "Back to your games".
- Nothing says what changed: that players can no longer find it, and that it can be added again.
- Adding it again under the same name works (it gets a new address ending in `-2`).
- On the iPad sideways and computers this screen is centred in the window, where Live and Waiting start at the top left.

**L20.** (new) Changing a live game's name (question 1, opened from Live) shows "Finish later" at the top. That only makes sense for a game that isn't finished.

**L21.** (new) Sent back: staff's own line is 14px, `rgb(52, 69, 76)`, under the reason's 24px. It is the most specific thing the maker is told, in the smallest text on the card. On phones it falls under the bar.

**L22.** (new) After a refusal the page scrolls its reason into view (M4's fix), and this can push what was asked off the top:
- sideways phones: the question's heading;
- a sideways SE, question 1: the typed box too;
- the SE upright, on where it plays and the upright video: the heading.

The maker sees the reason but not the question.

**L23.** (S11, partly fixed) The agreement in the flow, on computers and the iPad sideways: "I agree" still comes before the words. It sits beside clause 1, and at 1280 by 720 the last three clauses are below the first screen. The Enter hint is gone, as asked.

**L24.** (new) Your games, empty:
- "Add a game" sits in a different place on the iPad sideways than on computers;
- the "Maker agreement" link hugs the text above it.

**L25.** (new) The question count grows at the end for an 18+ game. The age question says "Question 7 of 7". Choosing 18+ then leads to "Question 8 of 8", and the track gains a piece. This is what the code means to do (`counterOf`, pinned in `questions.test.ts`), but a maker who was told question 7 was the last gets one more. A question for the Owner more than a fault.

## The 15 design-pass findings left open, settled

| Finding | Now | Where |
|---|---|---|
| S3, the one-line box on a phone | still a problem | L3 |
| S4, the first screen on a phone | still a problem; more cases seen | L4 |
| S7, the jump on the upright iPad (the Owner's F8) | still reads as a jump; for the Owner's look | L15 |
| P2, "What players will see" | still a problem, both halves | L9 |
| P3, a video in a fix card | still a problem | L10 |
| P4, the upright frame's empty row | still a problem | L11 |
| P5, Throw it away's heading and buttons | partly fixed | L12 |
| P6, the name twice | still there; the Owner's pattern | L13 |
| P8, the wordmark moves | still a problem; bigger off phones | L14 |
| P9, ragged edges on Live, update sent back | mostly fixed; one case left | L16 |
| P10, "See it on Ruken" over "Back to your games" | moot: "See it on Ruken" is gone from Live. The same problem moved to the take-off link | L1 |
| P12, "Show" on "6 accepted" | resolved: the whole bar is the target | — |
| P14, the facts under the bar on Check and send | still a problem; a new sideways case | L5 |
| P15, Live's backdrop takes the video's colours | unchanged; nothing to fix before real videos | — |
| P16, Your games on an iPhone SE | still a problem | L7 |

## The take-off flow

- **Live.** The link "Take it off Ruken" is on every Live state, on every view. It is not quiet (L1).
- **The confirm screen** is right:
  - The heading is "Take (the game's name) off Ruken?", then "Players won't be able to find it or play it any more. Nothing changes on GitHub." and "You can't undo this.". Plain words that pass the drunk-grandma test.
  - "Keep it on Ruken" is first, green, and has the focus on all ten views (measured).
  - "Take it off Ruken" is the red button, and the only red thing on the screen.
  - Nothing on it is blue.
- **Problems:** the buttons are closer together than on Throw it away (L18), and the heading is 4 lines on the SE (L12).
- **After.** "Off Ruken. You took it off." with one blue "Back to your games". It says too little (L19).
- **From the code, not pictured:** a game that isn't live gets a 404 at the take-off address, and taking it off goes back to the game's page.
- **Not seen:** any of it in Safari's engine.

## Not judged

- **The pale tile in Safari's engine.** On the iPhone 15 in Safari's engine (CI), the upright video question shows a pale, empty tile right after a video is chosen. Most likely the video's first frame had not been drawn when the picture was taken. It needs a look on a real iPhone before it is called a fault.
- Anything moving, and anything on a real device.
