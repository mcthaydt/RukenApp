# The rebuilt maker screens: the task walk

Date: 2026-11-15. Stage: the plain-words task walk before the Owner sees the build, on branch `slice-2/submit` (pull request #63, a draft), after the two-pass screen review (`2026-11-15-maker-screens-rebuild-screen-review.md`, pull request #126). This is a sibling of that review: its findings are F1 to F21 and V1, and this walk does not repeat them. Its own findings are W1 to W17.

The walker is a maker who is tired, a little drunk and has never sent a game anywhere. She does real tasks, one screen at a time, and the walk notes every place she would stop, guess wrong or give up.

## What was looked at, and what was not

- **Looked at.** The pictures the journeys attach as `look: <screen>` in run 43705833839 (commit `52f1609`, green), from its three `playwright-report` files: 55 names, nine views each. The walk was done on the Pixel 7 upright (phone first), with the 1280 by 720 computer for the screens that change most on a wide window. Words were checked against the code on `slice-2/submit` where a picture could not say what happens next.
- **Not run.** No test, lint or typecheck. The app was not started, so nothing was pressed: what a button does is read from the journeys and the code, and is marked "not seen" where neither shows it.
- **Not seen.** Where Back on question 1 goes; what "Finish later" says when pressed; what Next does on question 3 with no repository picked; the step between questions; any video playing (F1: every video is a blank block, so the walk could not judge whether she would recognise her own game in them).

## The tasks

1. Send a first game, from an empty Your games to Waiting for review.
2. Fix a game that staff sent back, and send it again.
3. Look after a live game: send a new version, fix an update staff sent back, change its name.
4. Throw a draft away.

## Task 1: send a first game

**Your games, empty.** She reads "You'll need your game on GitHub, ready to run in a browser, and two short videos of it", and presses Add a game. Fine. She has no idea what "ready to run in a browser" means, but question 3 helps her later.

**Question 1, the name.** Clear. Too short a name gets "Pick a name with at least three letters or numbers." Clear.

**Question 2, the line.** Clear. "Throw this game away" is the only link on the page; she doesn't need it.

**Question 3, the files.** This is where she slows down.
- **W1. "Folder", "repository" and "files" are three words for one thing.** The heading asks "Where are your game's files?", the card says "Connect it, then pick the folder", the line under it says "You choose which repositories Ruken can see", and after connecting she is shown a list of repositories, not folders. When the game won't start, the button says "Pick another folder". She picks from a list called nothing and is then told to pick a folder she was never shown. Fix: one word. The how-to already says "repository" once, as GitHub does; the screens could say "your game on GitHub" in the card and "Pick another" on the button, so nothing she reads names a thing she cannot see.
- **W2. After a failed reconnect she is told "Try again" with nothing to press.** On "connected, the reconnect failed" the screen says "GitHub didn't connect. Try again." above her list, and the blue button is Next. There is no Connect GitHub button any more; the only way to try again is the small "Don't see your game? Choose it on GitHub" link. She either presses Next (and it works, so the warning was noise) or looks for a button that isn't there. Fix: either say what still works ("Your games are still here. Pick one.") or give the retry a name she can find. Words are the plan's, so this goes to the fixes thread as a question.
- **W3. Nothing on the list looks like a choice until it is picked.** The two repositories are the same white slabs as the name box on question 1, with no circle or tick until one is pressed, and Next is already blue. On a phone she may think they are boxes to type in. Questions 4 and 7 have the same look, but there the heading is a question with obvious answers; here the rows are code names. Not seen: what Next does with nothing picked. Fix: if nothing is picked, Next says so in the usual refusal place; a hint "Pick one" would also do.
- **W4. "index.html", "branch" and "folder" sit under the list.** "Your game needs an index.html that runs in a browser" and "Change the branch or folder" are the next two lines she reads. She cannot act on either. The how-to explains index.html well; the line on question 3 does not point there. Fix: drop the index.html line here (the refusal card and the how-to both say it when it matters), or link it to the how-to's "Set up your game's folder".
- **W5. The refusal card does not name the repository it couldn't start.** "We couldn't start your game … We couldn't find one in that folder." She picked one of two similar names; the card doesn't say which, so she can't tell if she picked the wrong one or the right one is broken. Fix: name it ("in ruken-test/broken-game").

**The GitHub how-to.**
- **W6. The how-to has no way back at its foot.** "Back to Ruken" is a small link at the very top; on a phone the page is about four screens tall, and step 5 ("Come back to Ruken and choose Connect GitHub") is at the bottom with nothing under it. "Back to Ruken" also doesn't say she lands on question 3. Fix: the same link, as "Back to your game", at the foot too.

**Question 4, where it plays.** Clear. "Computers only: choose this if your game needs a keyboard or a mouse" answers the question she has.

**Questions 5 and 6, the videos.**
- **W7. "Record your screen" has no help.** She has never recorded her screen. GitHub gets a how-to; the videos, which the design calls the hero, get none. "MP4 or WebM" and "Export it as MP4 or WebM" (the refusal) are words she can't act on. Fix: a "How do I record my screen?" link to a short how-to (phone and computer), like question 3's. This is new words and maybe a new page, so it is the Owner's call.
- **W8. The refusal for a bad video lands under the bar.** On the Pixel upright, "That file doesn't look like a video…" starts at the bottom edge of the first screenful, half under the pinned bar. Next to it is a focus ring on Choose video, so she sees the button highlighted and nothing else changed. Not seen: whether the page scrolls to the refusal. Fix: the refusal sits above the file name, or the page brings it into view.

**Question 7, who it's for, and question 8 for an 18+ game.**
- **W9. Question 8 offers "Sex or nudity" as a tick, then says pornography is never allowed.** She can't tell where the line is between the two, and nothing tells her. This is the same question as F6 (the agreement says "no adult games"), and it goes to the Owner with F6, not to a fix. The Owner's decision (2026-11-15) allows a censored store version and bans pornography; the screen should say where that line is in one sentence, or the tick should go.
- **W10. "Only adults see it." under question 8: "it" is unclear.** She reads it as "only adults see this question". Fix: "Only adults will see this game."

**The agreement.** She presses I agree without reading, like everyone. Fine. Point 3's "no adult games" is F6.

**The websites question (from a chip on Check and send).**
- **W11. The refusal stays after she fixes the answer.** She types "not a website", presses Save, is told "Write each website like api.example.com…", corrects it, and the refusal is still there until she presses Save again. (The picture "a website typed" shows the right answer with the old refusal under it.) Small, but she may think the right answer is wrong too. Fix: clear the refusal once the box changes.

**Check and send.**
- **W12. Eight "Change" links, and two chips she can't read.** On a phone the game laid out has a Change beside every part: eight in a row. The design asks for this, and it is fine for a maker who knows what she sent; for her it is a wall of the same word. Two chips are not plain words: "12+" (12 plus what?) and "Runs on its own" (she never said that; it is how the screen names an empty websites answer). Fix: "For 12 and up" and "Uses no other websites".
- **W13. "Send for review" and "press Enter" on a computer.** On a computer the blue button has the Enter hint. Sending is the one step on these screens she can't take back herself (she can change things while it waits, but it is with staff). Enter on a page with no box to type in sends a game. Not a must; noted for the Owner's look.

**Waiting for review.**
- **W14. She is told to come back, but not when, and not whether she'll be told.** "We're looking at it. Come back here to see when it's live." She will forget. Ruken doesn't tell makers yet, so the screen could at least say about how long a review takes, if the Owner names a time. No mail is sent on `slice-2/submit` (`review.ts` says "No mail is sent yet, so the line must not promise one"), so this is a question for the Owner: a mail when it's reviewed (later work), or a time on the screen, or leave it.

## Task 2: fix a game that was sent back

**Sent back, for one thing.** Clear: "One thing to fix. Then send it again.", the card says what is wrong in plain words ("It's sideways. Turn it the right way up."), and the blue button names the fix. This is the best screen of the set. F2 (the white hole) and F5 ("Throw this game away" one thumb from "Back to your games") are the screen review's.

**Sent back, fixed.**
- **W15. "All 8 ready to send" on a game she answered seven questions for.** The number is fixed at 8 in `SentBackScreen.svelte` (it counts the websites answer as a part). She answered seven questions; "8" makes her think she missed one. Fix: "All ready to send", or count what was shown.

## Task 3: look after a live game

**Live.** Clear: "Players can find it on Ruken." "Send a new version" says what it does, and "Your game stays live meanwhile" stops her worrying.

**Live, an update waiting.** "Your update is waiting for review." and the same "Send a new version" button is still there, unchanged. She pressed it a minute ago; seeing it again she presses it again to be sure. Not seen: what a second press does. Part of W16.

**Live, an update sent back.**
- **W16. Fixing a line on a live game leaves her with the wrong button.** The line says "Fix it, then send a new version." The card says "This line isn't about your game", with "Fix this". She fixes the line. To send it, the only button is "Send a new version", which says it "copies the newest version of your game from GitHub". She didn't change anything on GitHub, so she doesn't press it, or presses it not knowing whether her line goes with it. The screen review's F13 saw the same screen from the button side. Fix (for the plan, not a straight fix): when what was sent back is a word or a video, not the files, the button says "Send it again" and its line drops the GitHub part; while an update waits, the button is gone or says what pressing again does.

**Changing a live game's name.** "Its address on Ruken stays the same, so links you've shared keep working." Good. Not said: whether players see the new name at once or after review. She'll want to know. Small; for the plan.

## Task 4: throw a draft away

- **W17. On the throw-away screen the red button is on top.** "Throw it away" (red) is first and "Keep it" (green) is under it. A tipsy thumb presses the first big button. The design's table (spec, "Throw a draft away") lists "Keep it, green · Throw it away, red", Keep it first. The focus is on Keep it, which helps a keyboard, not a thumb. Fix: Keep it first, as the spec lists it. The words ("You can't undo this.", "Nothing changes on GitHub.") are clear.

## Summary

She can send a first game. The places she stops are question 3 (W1 to W5, mostly words naming things she can't see), the videos (W7, no help recording; W8, a refusal under the bar), and what happens after (W14, nobody tells her it's live; W16, the live-game fix leaves her with a GitHub button). The one place she could do harm is W17, the red button on top.

| | Finding | For |
|---|---|---|
| Must fix | W2 "Try again" with nothing to press; W8 video refusal under the bar; W15 "All 8"; W16 the live-game fix button; W17 red on top | fixes thread (W2 and W16 words are the plan's) |
| Should fix | W1 one word for the repository; W3 rows that don't look like choices; W4 index.html and branch lines; W5 name the repository; W6 way back at the foot of the how-to; W10 "Only adults see it"; W11 stale refusal; W12 "12+" and "Runs on its own" | fixes thread |
| Owner | W7 a how-to for recording the screen (new words); W9 "Sex or nudity" with F6; W13 Enter sends; W14 does Ruken tell her when it's live | Owner, through the coordinator |

## The Owner's answers (2026-11-15, decision cards)

- **W7.** "Yes, a short how-to". Questions 5 and 6 get a "How do I record my screen?" link to a short how-to for phones and computers, like the GitHub how-to.
- **W9.** "Keep it, add one line". The "Sex or nudity" tick stays on question 8. One plain line under it says what is allowed and what isn't, in words that match the Owner's answer on F6.
- **W13.** "No, the button only". On Check and send only "Send for review" sends; Enter does not, and the "press Enter" hint is not shown there. It stays on the questions.
- **W14.** "Leave it for now". Waiting for review keeps "Come back here to see when it's live." Telling the maker comes with the texts work, later.
