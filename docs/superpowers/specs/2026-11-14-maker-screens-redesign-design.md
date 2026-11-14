# The maker's screens, redesigned: one question at a time

Date: 2026-11-14. Status: a proposal, waiting for the Owner's "fine" on the board. Nothing here is built.

The board, clickable, on phone and computer: https://claude.ai/artifact/TKBmpXPQwnjZQTtbUwi5BL (private to the Owner until shared).

The Owner's words, 2026-11-14, after seeing the before/after board of the maker's screens:

- "Why are we not using the blue color for the button, we aren't being consistent."
- To "the one main button on every screen across the whole site goes blue; other buttons stay green": "A, and run the screens through fable; it just feels like it's poor UX; like these are not passing drunk grandma for UX at all; extended forms should be typeform-coded".

Lines marked **Owner** are the Owner's words. Lines marked **Call** are this design's choices; the Owner can overrule any of them. Lines marked **Pending** wait for the Owner's answer and are not built until it comes.

This amends the main design (`2026-11-13-ruken-reels-linktree-design.md`): its section 5.8 (the colour rule for buttons, section 1 below) and its sections 5.4 and 5.7 (how a maker submits a game, sections 3 to 5 below). Everything else in it stands.

## 1. Buttons: the amendment to 5.8

Owner, 2026-11-14: "the one main button on every screen across the whole site goes blue; other buttons stay green": "A".

- **The main button.** Every screen has at most one, and it is Blue: `pay` `#006eb8` with white words (5.35:1, measured). It is the next step. This is every screen of Ruken's own: the home page, sign up, sign in, the password screens, the paywall card, `/me`, deleting an account, the maker's area, the agreement, the missing page.
- **Any other button** is green: `felt-raised` `#004f46` with white words (9.52:1, measured). Back, "Choose a different video", "Send my newest version for review".
- **Links stay links**: ink, underlined, for leaving the task ("Finish later", "Not now", "Back to your games").
- In 5.8's table, `pay` now reads "the one main button on every screen, with white words; never a field"; `paper` reads "cards" only (it was also the main button on felt); `felt-raised` keeps "secondary buttons, tracks". The ink button on paper goes.
- 5.8's Grandma line becomes: "one paper card per screen holds the one thing to do, and its one Blue button is the next step; no button is red."
- The paywall's "Continue to payment" stays Blue. It is no longer the only Blue button on the site; its words and the money lines beside it say that money is spent.
- Measured, and worth knowing: Blue on the felt itself (the home page's "Sign in") is 2.67:1 against the page. The button is read by its white words, which pass; the home page goes when the feed replaces it.
- **Pending (question 1).** On "Delete your account?" the main button today is "Delete my account". The rule as written makes the dangerous choice the Blue one. Call, recommended: there the Blue button is "Keep my account" and "Delete my account" is green.

## 2. Where she stalls today

Walked as a tired stranger would, on every screenshot of run 43616066455 (branch `slice-2/submit`, 42 screens on phone and the same on computer), from signing in to a live game.

1. **No door.** Nothing on the home page, sign-in or Your account points to the maker's area. She has to know the address `/make`.
2. **Connect GitHub is a gate before the form**, with three sentences to read and nothing typed yet. After it fails the only words are "Try again".
3. **The new-game card is seven things at once**: a dropdown, two boxes, two choices and two fold-outs under the heading "New game". Nothing says where to start or how much is left.
4. **"Game files" sits over the browser's own dropdown** listing repository names. The label and the list do not match, and it is the one control not drawn by Ruken.
5. **"Phone and computer" is already ticked.** A keyboard-only game can go out as a phone game without anyone deciding.
6. **"Save and add videos"** does a third thing it does not name: it copies the game, which can take a minute.
7. **Nothing is kept until that press.** Close the tab at the fifth box and every answer is gone.
8. **The next page looks like a different form.** It opens with "Not sent yet" and its first link is "Copy my game from GitHub again", which reads like a step she must take.
9. **The dark button jumps**: upright video, then wide video, then Send. "Send for review" is a quiet link at the bottom until then, pressable, and answers with a refusal.
10. **"Choose a different video" appears twice**, a thumb apart, with the same words.
11. **The agreement is three controls for one decision**: a tick box, a link inside the tick box's words that leaves the page, and a fold-out.
12. **Send can be refused three times running**, once each for the tick and the two videos.
13. **Waiting** still lists the files and both videos with their change links, as if something were left to do.
14. **Live**: what she wants, to see her game on Ruken, is a small link among notes.

## 3. The journey

Short screens stay short. The long form becomes one run of questions.

| Stop | Screen | The question or heading | Main button (Blue) | Other buttons (green) and links |
|---|---|---|---|---|
| Door | Your account `/me` | adds one line: "Make games? Add yours to Ruken." (a link to Your games) | as today | |
| | Sign in | Sign in | Sign in | as today |
| | Your games, none | Your games | Add a game | |
| 1 of 6 | Name | What's your game called? | Next | Back · Finish later |
| 2 of 6 | One line | What's Floor Fifty about, in one line? | Next | Back · Finish later |
| 3 of 6 | Game files, not connected | Where are your game's files? | Connect GitHub | Back · Finish later |
| 3 of 6 | Game files, connected | Where are your game's files? | Next, then "Copying your game…" | Back · Don't see your game? Choose it on GitHub · Change the branch or folder · Finish later |
| 4 of 6 | Plays on | Where does Floor Fifty play? | Next | Back · Finish later |
| 5 of 6 | Upright video | Add your upright video | Choose video; once added, Next | Back · Choose a different video · Finish later |
| 6 of 6 | Wide video | Add your wide video | Choose video; once added, Next | Back · Choose a different video · Finish later |
| Almost done | The agreement, first game only | The maker agreement | I agree | Back |
| Last step | Check and send | Check it, then send | Send for review | Change, on each answer · Finish later |
| | Waiting | Floor Fifty · Waiting for review | Back to your games | Change something |
| | Sent back | Floor Fifty · Sent back · What to fix | Send it again | Change, on each answer · Back to your games |
| | Live | Floor Fifty · Live | See it on Ruken | Send my newest version for review · Back to your games |
| | Your games | Your games | Add a game | each game is one link |

"Floor Fifty" stands for the name she typed: from question 2 on, the question uses it, so she sees her answer was kept.

## 4. How a question screen works

- **One question per screen**, as the card's title, in Young Serif. One box or one set of choices under it, then the hint, then the buttons.
- **Progress**: a line, "Question 2 of 6", in the body size, over a track of six short bars, the filled ones green. After question 6 the line reads "Almost done" (the agreement) and "Last step" (Check and send). The count is six for every game; the agreement is not counted, because only a first game has it.
- **Buttons**: Back (green) on the left, the Blue main button beside it. On a phone the Blue button fills the rest of the row. Back on question 1 goes to Your games.
- **Enter goes on.** On a computer a small note beside the button says "or press Enter". The one box where Enter makes a new line (other websites) does not show the note.
- **Answers are kept.** Every Next saves. From the first Next the game is in Your games as "Not finished. Go on from question 3.", and tapping it opens that question with her answers in place, on any device she signs in on. "Finish later" under the buttons says the same thing as a link.
- **Each question has its own address**, so the browser's Back works and a reload stays on the question. Each works as a plain page and form before its script wakes.
- **Refusals** sit under the box they are about, with the box marked, in today's words: "Pick a name with at least three letters or numbers.", "A game needs one line about it.", "Choose the repository your game is in.", "Choose where your game plays." (new).
- **A press that takes time** says so on the button and cannot be pressed twice, as today: "Copying your game…", "Adding your video…", "Sending your game…".
- **The look** is unchanged: felt, one paper card, the two typefaces, 20px and 12px corners, nothing moves but a pressed button.

## 5. What changes from today, screen by screen, and why

- **Your account.** One new line, the door to Your games (stall 1). Call.
- **Name, one line.** Split out of the card, asked first because they are the easiest (stall 3). Hints are today's words.
- **Game files.** Connecting GitHub moves inside question 3, after two answers are already saved, so the trip to GitHub loses nothing (stalls 2 and 7). The repositories are rows to tap, drawn by Ruken, not a dropdown (stall 4). The game is copied on this question's Next, so "We couldn't find an index.html at the top of that folder. Ruken starts a game from index.html." shows on the screen that asked (stalls 6 and 8). "Copy my game from GitHub again" leaves the first run; it stays as the Change on the files row of Check and send. The connect screen says "Ruken copies your game from GitHub. You choose which repositories Ruken can see. It can't see anything else."; "Your game needs an index.html that runs in a browser." is the hint under the list.
- **Plays on.** Nothing is chosen for her (stall 5).
- **The two videos.** One per screen, the same screen twice. The picker is the Blue button until a video is in; then Next is Blue and "Choose a different video" is green (stalls 9 and 10). The hints are today's, plus "Players see it in the feed before they play."
- **The agreement.** One screen with the whole text in its numbered layout and one button, "I agree". Pressing it is the agreeing; the tick box, the link out and the fold-out go (stall 11). The page at `/legal/maker-agreement` stays for anyone to read. **Pending (question 2)**: the line under the title reads "Version 1"; it reads "Version 1 · Last updated 14 November 2026" only if the Owner says yes.
- **Check and send.** New. Every answer in one list, each with Change, which opens that one question (its button reads "Save") and comes straight back. She reaches it only with every answer in, so Send is not refused (stall 12). The rare question, "Does Floor Fifty use other websites?", lives here as a row that reads "None", so nobody else is asked it.
- **Waiting.** Where it stands, today's line ("We're looking at it. Come back here to see when it's live."), one button. The files and videos move behind one link, "Change something", which opens Check and send (stall 13).
- **Sent back.** "What to fix" and staff's words first, as today; under them the same list as Check and send; the button stays "Send it again".
- **Live.** The Blue button is "See it on Ruken" (stall 14). "Send my newest version for review" becomes a green button with today's note. Taking a game off Ruken (main design 5.4) is not on this branch and is not designed here.
- **Your games.** Unchanged but for the Blue button and the new state words, "Not finished. Go on from question 3."
- **Every other screen of Ruken's own.** Only the main button's colour changes (section 1).

## 6. The main design's 5.7, the new maker's three steps

5.7 gives a new maker three steps with a "Step 1 of 3" line: the short address, the page, the first game. Slice 4 builds the first two. Call: a screen never shows two counters. When slice 4 builds them, the address and the page are the first questions of the same run, and the one line counts them all ("Question 1 of 8"). **Pending (question 3)**, because it changes 5.7.

## 7. Questions only the Owner can answer

1. **The delete screen's Blue button.** A (recommended): Blue is "Keep my account", green is "Delete my account". B: the rule as written, Blue is "Delete my account".
2. **The agreement's date line.** A (recommended): "Version 1 · Last updated 14 November 2026". B: "Version 1" only.
3. **The address and page steps.** A (recommended): they join the one run of questions, with one counter. B: they stay "Step 1 of 3", and the game's questions count inside step 3.

## 8. Left to the plan

- Where a half-answered game is kept so that it shows in Your games from the first Next, before its files are copied.
- The address of each question.
- The journeys in `tests/browser/make.test.ts` and the look tests that name today's words and the ink button; each changes red first, in CI.

## 9. What was looked at, and what was not

- Looked at: all 84 screenshots in the playwright-report of run 43616066455 (42 screens, phone and computer), one sheet at a time; the maker routes and `look.css` on `slice-2/submit`; the maker screens review on `audit/maker-screens`.
- Measured: the two button contrasts and Blue on felt, from the colour values in 5.8.
- The board was clicked through once in a browser, start to "Waiting for review", on computer and phone widths, with no script errors and nothing sideways on a phone.
- Not run: no tests, no app. No app code changed.
