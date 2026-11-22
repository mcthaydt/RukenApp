# Unit A (edit a live game's videos and rating): design review, round 3

- Commits examined: pictures shot at 778190c; wording read from the source at 836401f (branch claude/project-thread-85j3yr). `git diff 778190c 836401f` touches only the two question screens' waiting line, the two flags that feed it, and one browser test.
- Written: 2026-11-21 18:27 UTC
- What ran: all 47 pictures in /mnt/project-files/screens/everything-editable-unit-a-round3/ looked at one by one (9 screens at phone 375x667, tablet 768x1024, computer 1280x800, with the -scrolled shots). The 836401f diff, the card heading's condition (GamePreview.svelte:17, +page.server.ts:183-185) and the shoot script read. No code changed. The app and the tests were not run.
- Verdict: PASS. E1, E2, E3 and the tablet-top gap are fixed. No new defects. 3 notes.

## Owner rules

- Live game edited in place, no new button: PASS. Live adds only "Change" links, one "Change the video for computers / phones" link and a small mark (screens 1, 3, 6, 8, 9).
- Videos and rating held, name and lines instant: PASS as far as the pictures show. Only the video and the rating carry "Waiting for review" or "Not sent yet". Changing the name or line was not shot.
- Screen 9 (after "Keep the old one" on both) matches screen 1 at all three sizes: PASS.

## Round 2 findings

| Finding | Result | Evidence |
| --- | --- | --- |
| E1 medium: Save cut off (screen 4, computer) | FIXED | 4-...-computer.png: the video frame is smaller (about 418 px wide, was 640), Save sits at about y=647 to 707 and "Keep the old one" at about y=745, all inside the 800 px window. No -scrolled shot was taken, which means the page now fits. The fix commit adds a browser check for it (not run here). |
| E2 low: mark floats between link and box on a phone (screens 3, 6) | FIXED | 3/6-...-phone-scrolled.png: "Waiting for review" sits about 27 px under "Change the video for computers" and about 34 px above the box, so it reads as the link's. The builder took the second fix round 2 offered (close the gap). The order still differs by kind: the mark comes before a bare "Change" (shown video, rating chip) and after the full-sentence link. Each mark sits beside the thing it describes, so it reads fine at all sizes. |
| E3 low: two ages on one screen (screen 7, computer) | FIXED | 7-...-computer.png: the card is headed "What players will see after we say yes" above 7+, and the line says "Players see 12+ until we say yes." Screen 4 computer has the same heading. Screen 5 computer has it too with nothing changed on that screen; that is right, since the wide video was already waiting when it was shot (shoot script order; +page.server.ts:183-185). Screen 2, shot with nothing waiting, says "What players will see". |
| Tablet tops of Live not in any picture | FIXED | 1/3/6/8/9-...-tablet.png now start at the top: heading, status line, note, links, and on screen 8 the top of the "Needs fixing" card. All read well. Computer 6 and 8 also start at the top. |

## The words at 836401f (no picture shows them)

- "Not sent yet. Players see the old one." (video question) and "Not sent yet. Players see 12+." (rating question): PASS. Plain, short and true. They match the "Not sent yet" mark on Live (screen 8) and Live's headline "Fix it, then send it again.", and they drop "until we say yes", which would promise a review nobody is doing. On a phone the shorter line takes one line less than the waiting one, so the layout in screen 4 and 7 phone pictures can only get roomier.
- The diff adds a browser check for both lines on the sent-back game (tests/browser/make-live-changes.test.ts). It was not run here.

## Every screen

- 1 and 9, all sizes: clean. One main button, links below, chips and Change links tidy.
- 2, all sizes: clean. "Change your wide video", Back + Save.
- 3, all sizes: clean. Headline "Your update is waiting for review."; the note adds "A waiting video or rating stays."
- 4, all sizes: clean. Waiting line right under the heading; "Keep the old one" is in the page on phone and tablet and under Save on computer; the bar is Back + Save.
- 5, all sizes: clean.
- 6, all sizes: clean. On a phone each chip has its own line: "7+ Waiting for review Change".
- 7, all sizes: clean.
- 8, all sizes: clean. "7+ Not sent yet Change"; no "Waiting for review" anywhere; one main button, "Fix the wide video".

## Notes (ideas, not defects)

- N1. Unsent state, computer only, read from the source: the line says "Not sent yet." while the card beside it is still headed "What players will see after we say yes". Both are true and they do not disagree. Leave it, or head the card "What players will see" plus nothing else in that state.
- N2. About the pictures: on phone screen 8 the strip between the fix card's video and the tall video's "Change" (the card's "Fix this" link and the tall video) is in neither shot, because the page is taller than two windows. The tablet shots show the same strip and it is fine. Nothing in rounds 2 or 3 changed it.
- T1, carried from rounds 1 and 2: screen 8 calls one thing "Wide video", "Fix the wide video" and "the video for computers". An owner wording choice, older than this unit.
