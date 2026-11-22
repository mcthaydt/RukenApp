# Unit A (edit a live game's videos and rating): design review, round 1

- Commit examined: af42b33, branch claude/project-thread-85j3yr
- Written: 2026-11-21 17:46 UTC
- What ran: all 27 pictures in /mnt/project-files/screens/everything-editable-unit-a/ looked at one by one (9 screens at phone 375x667, tablet 768x1024, computer 1280x800). Labels and tap sizes checked against the source at af42b33 (GameLaidOut.svelte, VideoQuestion.svelte, QuestionScreen.svelte, src/lib/look.css). No code changed. The app was not run.
- Verdict: NOT a pass. 1 red, 5 medium, 3 low, 2 notes.

## Owner rules

- Live game edited in place, no new button: PASS. Screens 1, 3, 6, 8, 9 add only "Change" links and a "Waiting for review" mark.
- Videos and rating held, name and lines instant: PASS as far as the pictures show (name and line carry no waiting mark in any picture; changing them was not shot).
- Screen 9 (after "Keep the old one" on both) is the same as screen 1 at all three sizes: PASS.
- Tap size: every link and quiet button gets min-height var(--size-target) from look.css:214-220, so the small "Change" words still have a thumb-size target: PASS.

## Findings

### D1. RED. A video that was sent back still says "Waiting for review" (screen 8, all sizes)
- Evidence: 8-...-computer.png: the "Needs fixing / Wide video / It is too dark to see." card sits above the same wide video captioned "Waiting for review  Change". 8-...-phone.png and -tablet.png: the row "Video for computers  Waiting for review  Change" under a card and a blue button that both say the wide video needs fixing. Source: GameLaidOut.svelte:38-42 prints the mark for every part in game.waiting, sent back or not.
- Expected: a part that was sent back never says it is waiting. It says "Needs fixing", or nothing, since the card already says it.
- Fix: leave sent-back parts out of the waiting mark (where laid-out.server.ts fills `waiting`), or print "Needs fixing" for them. Add a browser check on screen 8 that the wide video's caption/row does not contain "Waiting for review".

### D2. MEDIUM. Open note N3, judged: fix it. A held change that has not been sent says "Waiting for review" (screen 8, all sizes)
- Evidence: screen 8 headline is "Fix it, then send it again.", yet the rating chip reads "7+  Waiting for review". Nobody is reviewing the 7+ until the maker fixes the video and sends. The words promise something that is not happening, and a maker may wait for a yes that cannot come.
- Expected: the mark is true in both states.
- Fix: two words for one mark. "Waiting for review" when the change is with staff; "Not sent yet" when the game has something to fix or the newest GitHub copy was refused. It pairs with the headline already on that screen. No new screen or button.

### D3. MEDIUM. The other video's row breaks on a phone when it is waiting (screens 3, 6, 8, phone)
- Evidence: 3/6/8-...-phone.png: "Video for" / "computers" wraps onto two lines on the left while "Waiting for review Change" is pushed to the right edge, vertically centred between the two lines. Every other row is left-aligned on one line. Fine at tablet and computer.
- Expected: one tidy row, or the mark and Change wrapping under the label, left-aligned.
- Fix: let that list item wrap (label on line one, mark and Change on line two, left-aligned) at 375. D4's shorter single link also cures it.

### D4. MEDIUM. Open note, the label for the other video's Change link: plain, but change its shape
- Evidence: Live draws one video with a bare "Change", then lists the other as "Video for computers  Change" (phone, tablet) or "Video for phones  Change" (computer). The words are plain. Three problems: (a) the label is body-size text among small chips, so it reads as a heading, not an item (1/3/6/9, all sizes); (b) on computer screens 6 and 8 it lands on the chip row beside "Uses no other websites" and looks like a stray sentence; (c) on screen 8 one screen calls the same thing "Wide video", "Fix the wide video" and "Video for computers".
- Expected: one obvious thing to tap, in the same voice as the rest.
- Fix (recommended): make the whole label the link, "Change the video for computers" / "Change the video for phones" (the aria-label pattern already in CHANGE_WORDS), on its own line under the chips, with the mark after it. Keep "for computers / for phones": it is plainer than "wide / upright". The "Wide video" name on the fix card and question heading is older, approved wording; mismatch reported as note T1, not for this unit.

### D5. MEDIUM. Three things squeezed into the bottom bar on a phone (screens 4 and 7, phone)
- Evidence: 4/7-...-phone.png: Back, Save and "Keep the old one" share the bar. "Keep the old one" wraps onto two lines against the right edge, and Save shrinks from about 242 px (screens 2 and 5) to about 140 px. Tablet and computer have room and read well.
- Expected: one main action in the bar; the way out is easy to see but apart from it.
- Fix: at phone width take "Keep the old one" out of the bar and put it in the page, straight under the waiting line (screen 4) or under "We check this when we look at your game." (screen 7). The bar goes back to Back + Save.

### D6. MEDIUM. The rating question does not say a rating is waiting, or what "the old one" is (screen 7, all sizes)
- Evidence: screen 7 shows 7+ ticked and "Keep the old one", with no line saying 7+ is waiting or that players still see 12+. Screen 4 (video) does have such a line. On screen 7 "the old one" has nothing to point at.
- Expected: the same help as the video question.
- Fix: one line under the choices: "Waiting for review. Players see 12+ until we say yes." (the live rating filled in).

### D7. LOW. "until it is a yes" (screen 4, all sizes)
- Evidence: "Waiting for review. Players see the old one until it is a yes." (VideoQuestion.svelte:124). "It is a yes" is not how people talk. On tablet and computer the line sits under the video in small type, first of three small lines, so it is easy to miss; on phone it is right under the heading, which is better.
- Fix: "Waiting for review. Players see the old one until we say yes." Put it above the video at every size.

### D8. LOW. The note under "Send a new version" got long and talks about files that are not waiting (screens 3 and 6, all sizes)
- Evidence: four sentences: "Send a new version copies the newest version of your game from GitHub and sends it for review. The files it copies take the place of the files that are waiting. A video or rating that is waiting stays. Players can still play it while you wait." In these pictures only a video (and a rating) wait; no files do. This is the N4 fix's wording.
- Fix: print the files sentence only when files are waiting, and shorten the pair to: "It replaces a version that is waiting. A waiting video or rating stays."

### D9. LOW. "Add your wide video" on a game that already has one (screens 2 and 4, all sizes)
- Evidence: heading "Add your wide video" (VideoQuestion.svelte:54) above the game's current video and "Choose a different video".
- Fix: when the game has that video, the heading says "Change your wide video".

## Notes (ideas, not defects)

- T1. One name for each video across the product ("wide video" in headings, cards and buttons; "for computers" on Live). An owner wording choice, older than this unit.
- T2. Screens 6 and 8: the rating chip shows the waiting 7+ only; what players see now (12+) is nowhere on Live. D6's line covers it on the question screen.

## About the pictures

- Phone and tablet Live shots are full-page, so the fixed bottom bar is painted across the middle and hides what is under it: on tablet 1, 3, 6, 9 the line and most of the chip row; on tablet 8 the bottom of the fix card ("Fix this") and the space between the card and the tall video; on phone 1, 3, 6, 9 the video's Change link. Those strips could not be judged. Next round, shoot the window, then scroll and shoot again.

## Clean screens

- 1 and 9 (all sizes), 5 (all sizes), 2 (all sizes, apart from D9).
