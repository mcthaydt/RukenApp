# Unit A (edit a live game's videos and rating): design review, round 2

- Commit examined: 5abd08d, as named by the coordinator. The pictures are the evidence; this commit was not in the reviewer's checkout, so nothing was checked against the source this round.
- Written: 2026-11-21 18:08 UTC
- What ran: all 48 pictures in /mnt/project-files/screens/everything-editable-unit-a-round2/ looked at one by one (9 screens at phone 375x667, tablet 768x1024, computer 1280x800, with the -scrolled shots), and the shoot script beside them read. Round 1's computer picture of screen 4 opened once to compare. No code changed. The app was not run.
- Verdict: NOT a pass, narrowly. All nine round 1 findings are fixed. 1 new medium, 2 new low, and one strip of the tablet pictures that could not be judged.

## Owner rules

- Live game edited in place, no new button: PASS. Live adds only "Change" links, one "Change the video for computers / phones" link and a small mark (screens 1, 3, 6, 8, 9).
- Videos and rating held, name and lines instant: PASS as far as the pictures show. Only the video and the rating ever carry "Waiting for review" or "Not sent yet"; the name and the line never do. Changing the name or line was not shot.
- Screen 9 (after "Keep the old one" on both) matches screen 1 at all three sizes: PASS.

## Round 1 findings

| Finding | Result | Evidence |
| --- | --- | --- |
| D1 red: sent-back video said "Waiting for review" | FIXED | Screen 8: computer shows a bare "Change" under the wide video; phone and tablet show "Change the video for computers" with no mark. |
| D2: held rating not sent said "Waiting for review" | FIXED | Screen 8, all sizes: "7+ Not sent yet Change" under the headline "Fix it, then send it again." |
| D3: other video's row broke on a phone | FIXED | 3/6-phone-scrolled: the link on one line, "Waiting for review" on the next, both left-aligned. |
| D4: label for the other video's Change link | FIXED | One link, "Change the video for computers" (phone, tablet) / "for phones" (computer), on its own line under the chips at every size. |
| D5: three things in the phone bottom bar | FIXED | 4/7-phone: the bar is Back + Save at full width; "Keep the old one" is in the page. |
| D6: rating question did not say what waits | FIXED | Screen 7, all sizes: "Waiting for review. Players see 12+ until we say yes." |
| D7: "until it is a yes", line placed low | FIXED | Screen 4: "Waiting for review. Players see the old one until we say yes." right under the heading, above the video, at all sizes. |
| D8: long note about files not waiting | FIXED | Screens 3 and 6: the files sentence is gone; the note adds only "A waiting video or rating stays." |
| D9: "Add your wide video" on a game that has one | FIXED | Screens 2 and 4, all sizes: "Change your wide video". |

## New findings

### E1. MEDIUM. Save is cut in half at the bottom of the window (screen 4, computer)
- Evidence: 4-video-question-video-waiting-computer.png: Back and Save start at about y=762 and are cut off by the bottom of the 800 px window; "Keep the old one" is fully below it (it shows only in the -scrolled shot). Screen 2 at the same size, without the waiting line, fits: Save ends at about y=796. The waiting line added above the video pushed everything down about 26 px. Round 1 shot this screen full-page, so it could not be seen then.
- Expected: the main action is fully visible without scrolling, as on screen 2.
- Fix: at computer width take about 30 px back when the waiting line shows (a slightly shorter video, or less space under the heading), so Save and "Keep the old one" fit in 800 px. Add a browser check that Save's box is inside the window on this screen at 1280x800.

### E2. LOW. The mark sits before one link and after another (screens 3 and 6)
- Evidence: under the video shown, and on the rating chip, the mark comes first: "Waiting for review  Change" (3/6-computer), "7+ Waiting for review Change" (6, all sizes). For the other video it comes after: "Change the video for computers  Waiting for review" (3/6-tablet). On a phone that mark drops to its own line about 38 px under its link and about 34 px above the "Show how many people played it" box, so it floats between the two (3/6-phone-scrolled).
- Expected: one order everywhere, and on a phone the mark clearly belongs to its link.
- Fix: put the mark first there too, or close the gap on a phone so the mark sits tight under its link.

### E3. LOW. Two ages on one screen (screen 7, computer)
- Evidence: 7-age-question-rating-waiting-computer.png: the line says "Players see 12+ until we say yes." while the card headed "What players will see" shows 7+.
- Expected: the two do not seem to disagree.
- Fix: when a rating waits, head the card "What players will see after we say yes", or leave it. Round 1 note T2 (Live shows only the waiting 7+) is the same thought and still stands as a note.

## About the pictures

- Tablet, Live (screens 1, 3, 6, 8, 9): the first shot and the -scrolled shot are both scrolled to the end; they differ only in the video frame. The top of Live at tablet (heading, the status line, the note under it, and on screen 8 the top of the "Needs fixing" card) is in no picture and was not judged at that size. The same words read fine at phone and computer.
- Computer, screens 6 and 8: the first shot is also already scrolled (the Ruken name is cut off at the top on 6; the top of the fix card is missing on 8).
- Likely cause, not checked: `shoot` goes to the same address again at each size, and the browser puts the scroll back where the last size left it. Fix for the next shoot: `window.scrollTo(0, 0)` before the first screenshot.

## Notes (ideas, not defects)

- T1, carried: screen 8 still calls one thing "Wide video", "Fix the wide video" and "the video for computers". An owner wording choice, older than this unit.
- T2, carried: see E3.

## Clean screens

- 1, 2, 5 and 9 at all sizes; 8 at all sizes; 4 and 7 at phone and tablet; 3 and 6 apart from E2. Tablet Live tops not judged, as above.
