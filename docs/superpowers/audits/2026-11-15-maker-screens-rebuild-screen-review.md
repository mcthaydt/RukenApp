# The rebuilt maker screens: the screen review

Date: 2026-11-15. Stage: the look review before the Owner sees the build (two passes), on branch `slice-2/submit` (pull request #63, a draft).

What was looked at: the pictures the journeys attach as `look: <screen>` in run 43705833839 (commit `52f1609`, green). The three `playwright-report` files of that run hold 498 pictures under 55 names; 41 of the names are maker screens, and those are what this review covers. The other 14 (sign in, the paywall card, Your account and the rest) changed only their button colours and are not reviewed here.

Compared against: `docs/superpowers/specs/2026-11-14-maker-screens-redesign-design.md` (later sections win, as the plan's "Which words win" table says), the plan `2026-11-15-maker-screens-rebuild.md`, and the Owner's rules: red only for what can't be undone, everything else blue, no super-rounded shapes, circles only as drifting decoration on Live.

## What ran, and what did not

- **Pass 1.** Every maker screen, in three sheets each: the two phones upright (Pixel 7, iPhone 15), the computer with the two phones sideways, and the iPad upright and sideways in Chromium.
- **Pass 2.** The iPad in Safari's engine for the five screens whose pictures differ most from Chromium's (measured: the share of pixels that differ, from 0.07% to 3.57% per screen; no screen's layout differs between the two engines); a second look at 12 screens; and each finding checked in the code on `8b26c62`, so a finding below is either confirmed there or marked "seen only".
- **Not run.** No test, lint or typecheck. The app was not started. Nothing was measured in a browser: overflow, tap targets under 44 and clipping are judged from the pictures and from the journeys' own checks, not measured again here.
- **Not seen moving.** The step between questions, a video playing, the full-size viewer, Live's drifting circles.
- **Views missing.** The Owner's list is ten views: iPhone SE, a large iPhone, a Pixel and an iPad, each upright and sideways, and two computer windows (1440 by 900 and 1280 by 720). The journeys have nine projects: Pixel 7, iPhone 15 and iPad, each both ways (the iPad in two engines), and one computer at 1280 by 720. **There is no iPhone SE (the smallest phone), no large iPhone and no 1440 by 900 window.** Finding V1.

A note on reading the pictures: they are full-page pictures, so the pinned bottom bar is drawn where the first screenful ends and appears to sit across the middle of a long page. That is the camera, not the screen. It is not a finding.

## What is right

The button rule holds on every screen: one blue button, green Back and Keep it, and red on exactly one button ("Throw it away"). Nothing else is red; "Needs fixing" is a white sheet with a blue edge, in sentence case. Chips and ticks have small corners. Choices are white with a blue edge and a tick when picked; pick-several has square ticks. The five layouts are there and the bar is pinned on a phone, a sideways phone and an upright iPad. "Finish later" is top right everywhere. The counter reads "of 7" and "of 8". The words match the plan on every screen read.

## Findings

Must fix before the Owner looks: 6. Should fix: 9. Small: 6. Each says where it was seen and whether the code confirms it.

### Must fix

**F1. No picture shows a video, so the screens built around the video cannot be judged.** Every video in every picture is a blank sage block: questions 5 and 6 once a video is in, Check and send, Waiting, Sent back, Live (the sharp video and the blurred one behind it), Your games and "What players will see". The journeys' video is 64 bytes that only look like a video (`tests/browser/support/game.ts`, `videoFile`), so no browser can draw a frame. The design's sections 5a, 5b and 5c are about the video being the hero, and the Owner's note was "they look like screenshots and not videos you can preview". Fix: the look pictures use a real, tiny clip in both shapes (the board's sample is 18,085 and 16,725 bytes), so a picture shows a frame. This changes a test's fixture, not what any test accepts. Confirmed in code.

**F2. On Sent back, a video that was sent back is a blank white hole in the card.** The "Needs fixing" card for the upright video is about 700 px tall on a phone and 400 on a computer, with nothing between the reason and "Fix this". The video in the card has no backdrop (`.sheet.fix video`), so until a frame is drawn it is white on white. Every other video has the sage tile behind it. Fix: the same backdrop as `.tile`. Confirmed in code. Seen in all nine views.

**F3. The other-websites question is not built like a question.** Three things, all nine views:
- The box is dark with a thin edge, not paper. The design's 4.1: "The answer is paper." It takes the base `textarea` style (`background: none`) instead of the white slab the name and the line get.
- The heading touches the box: no gap at all.
- "press Enter ↵" shows on a computer, and Enter makes a new line in this box. The design's 4.2 says the hint is not shown there. `QuestionScreen` is not told `enterHint={false}` for this question.
Confirmed in code.

**F4. "7 accepted" reads as a pill.** The folded green card is 56 tall with 20 px corners, so its ends are nearly round. Owner: "we don't do super rounded anything here". Its heading is also underlined like a link, next to a second underlined "Show", and it sits 6 px under the card above it. Fix: 12 px corners while folded, one thing to press, and the usual gap. Confirmed in code (`.accepted`).

**F5. "Back to your games" and "Throw this game away" sit side by side, a few pixels apart, on Sent back.** One is the safe way out and the other opens the screen that deletes. On a phone they are one thumb-width apart. The design puts "Throw this game away" at the foot of the screen, "there to be found, not read". Check and send has the same link directly under the heading on phones and upright iPads, above the game itself. Fix: the link goes to the foot on both screens, as on the questions. Seen in all views; the link's place is confirmed in `SentBackScreen.svelte` and `check/+page.svelte`.

**F6. The agreement says "no adult games", and question 7 offers 18+.** Point 3 of the agreement a maker agrees to reads "Ruken is for people 13 and up, so no adult games." Two screens earlier the same maker can pick "18+ · Only for adults" and tick Gore or Drugs. One of the two is wrong. The agreement's words are the Owner's (a legal text, and a change makes it version 2), so this is a question for the Owner, not a fix to pick. Confirmed in `maker-agreement-v1.txt` and `questions.ts`.

### Should fix

**F7. Spacing collapses around the game laid out.** On Check and send, Waiting, Live and the opened "ready to send" card: the line about the game touches the chips under it (on a sideways iPad the chips cover the bottom of the letters), "Change" sits hard under the name and the line on a phone, and on Live with an update sent back the "Needs fixing" card sits 6 px over the video. Seen in all views.

**F8. Two-half screens start at a different left edge from the questions on an upright iPad.** Questions sit in the 640 column (65 px in); the agreement, Check and send, Waiting, Sent back and Live start 15 px from the edge. The design's 15.2: "question and room screens start at the same left edge". Seen in both engines.

**F9. The file button does not fill the bar.** On an upright iPad and a sideways Pixel, "Choose video" is a small button beside Back, while "Next" on the same screen a moment later fills the bar. On a sideways iPhone it does fill. Seen only; the rule meant to stretch it is `.acts > .file` at `look.css` 1088.

**F10. On a sideways iPhone the answer box starts under the bar.** With a two-line question (question 2, question 4, the websites question) the first screenful shows the heading and then the bar across the top of the box or the choices; the maker has to scroll before they can see what they are typing into. Seen in the iPhone 15 sideways pictures only. An iPhone SE is shorter still (V1).

**F11. Repository names break in the middle.** On question 3 the rows are set in the large heading face, so "ruken-test/broken-game" breaks as "ruken-test/broken-" / "game" on a phone and "ruken-" / "test/broken-game" two across on an iPad. A real name is often longer. Fix: the text face at a size that keeps a name on one line, breaking only at the slash.

**F12. "GitHub didn't connect. Try again." sits above the card.** Every other refusal sits under the hint, beneath the answer. Seen in all views.

**F13. Live with an update sent back points the wrong way.** The headline is "Live", the line is "Fix it, then send a new version.", and the one blue button is "See it on Ruken". On Sent back the blue button names the fix ("Fix the upright video"); here the fix is a small link inside the card. Words and buttons are the plan's to set, so this goes to the task walk and the Owner rather than straight to a fix.

**F14. Check and send on a phone is not the drawn layout.** The design's 5b: the upright video on the left, and beside it the wide video with the name and the line under it. Built: the wide video beside it with a tall empty space under it, and the name and line below both. On a sideways iPad, "On phones" and its "Change" break onto two lines under the narrow tile.

**F15. "Add a game" is under the heading on a computer.** The design's 4.2: "the heading and Add a game on one line".

### Small

- **F16.** "What players will see" is a tall sage block in the left third of a white card, with the rest of the card empty. Even with a real video it will be a small upright clip in a wide card.
- **F17.** Question 4: "Computers only" has a line under it and "Phones and computers" has none, so the two cards look unfinished side by side.
- **F18.** Question 3, connected: two links of two sizes and colours stacked ("Don't see your game?" small and sage, "Change the branch or folder" larger and white).
- **F19.** A refused name: the hint sits against the box's focus ring with no gap.
- **F20.** Live: the "Ruken" wordmark is greyed by the dark layer, and the dark layer has a lighter fringe at the window's edges. Section 15.2 asked for "no smudge". Judge again once F1 gives it a real video.
- **F21.** The test names end in eight letters and digits ("Tiny game 73e9d4b4"), and the heading face draws digits in the text face by design, so every heading in the pictures looks like two fonts. A picture for the Owner would read better with a plain name where nothing is saved.

### The views

**V1. Three of the Owner's ten views are not in the pictures**: iPhone SE upright and sideways, a large iPhone, and a 1440 by 900 window. The Owner's rule is "Do not begin the visual screen audit until we have EVERY view we need". This review began on the nine views CI has, because they are what exists; it does not close the rule. Two ways to get the rest: add projects to `playwright.config.ts` (three more runs of every journey on every push), or shoot the missing views once, after the fixes, for the Owner's board. F10 is the finding most likely to be worse on the missing views.

## What comes next

1. The Owner's answer on F6, and on V1.
2. A fixes session for F1 to F5 and F7 to F12, F14 and F15, test first.
3. The plain-words task walk (Opus), on the same pictures or the fixed ones.
4. The Owner's board, showing only the screens that changed.
