# The maker's screens, redesigned: one question at a time

Date: 2026-11-14. Status: a proposal, second round, waiting for the Owner's "fine" on the board. Nothing here is built.

Where it is built. Owner, 2026-11-14: "Hold #63 until the redesign is built". The redesign is built on branch `slice-2/submit` and lands as part of pull request #63. "Today" in this file means the screens on that branch, not on main.

The board, clickable, on phone and computer: https://claude.ai/artifact/TKBmpXPQwnjZQTtbUwi5BL (private to the Owner until shared).

The Owner's words, 2026-11-14, after seeing the before/after board of the maker's screens:

- "Why are we not using the blue color for the button, we aren't being consistent."
- To "the one main button on every screen across the whole site goes blue; other buttons stay green": "A, and run the screens through fable; it just feels like it's poor UX; like these are not passing drunk grandma for UX at all; extended forms should be typeform-coded".
- On the agreement's date line: "A". On a maker changing a game's name and line, and on throwing a draft away (the review's N1 and N2): "B", before launch.
- On boards: "the desktop shots are vertical for some reason". Boards for the Owner show every computer screen as a whole landscape window (1280×800, full width, nothing cropped), beside the phone.

The Owner's words, 2026-11-14, on the first board of this redesign:

- "audit the screens, ask does this look yc level - use fable, it looks a bit off, once again take inspiration from typeform; it's just a card in the upper center on desktop; this is not taste forward". Section 2a is that audit; section 4 is the layout that answers it.
- "delete account should be red obviously". Section 1.
- "safe is green, not safe is red, rest is blue". Section 1.
- "we need to add tablet view to our artifacts; tablet is first class supported, and mobile landscape". Sections 4.4 and 4.5; the board shows every screen five ways.
- "13. A": the address and page steps join the one run of questions. Section 6.

Lines marked **Owner** are the Owner's words. Lines marked **Call** are this design's choices; the Owner can overrule any of them. Lines marked **Pending** wait for the Owner's answer and are not built until it comes.

This amends the main design (`2026-11-13-ruken-reels-linktree-design.md`): its section 5.8 (the colour rule for buttons, section 1 below; where paper is used, the sizes and what moves, section 4 below) and its sections 5.4 and 5.7 (how a maker submits a game, sections 3 to 5 below). Everything else in it stands.

## 1. Buttons: the amendment to 5.8

Owner, 2026-11-14: "the one main button on every screen across the whole site goes blue; other buttons stay green": "A".

- **The main button.** Every screen has at most one, and it is Blue: `pay` `#006eb8` with white words (5.35:1, measured). It is the next step. This is every screen of Ruken's own: the home page, sign up, sign in, the password screens, the paywall card, `/me`, deleting an account, the maker's area, the agreement, the missing page.
- **Any other button** is green: `felt-raised` `#004f46` with white words (9.52:1, measured). Back, "Send my newest version for review".
- **Links stay links**: ink, underlined, for leaving the task ("Finish later", "Not now", "Back to your games").
- In 5.8's table, `pay` now reads "the one main button on every screen, with white words; never a field"; `paper` reads "cards" only (it was also the main button on felt); `felt-raised` keeps "secondary buttons, tracks". The ink button on paper goes.
- **The rule in one line.** Owner, 2026-11-14: "safe is green, not safe is red, rest is blue". The button that goes forward (Next, Send for review, Save, Continue to payment) is Blue. A safe choice (Back, Keep it, Keep my account, Cancel) is green. The one that deletes (Delete my account, Throw it away) is red. A screen with nothing to go forward to has no Blue button.
- **The button that deletes is red.** Owner, 2026-11-14: "delete account should be red obviously". On "Delete your account?" and "Throw Floor Fifty away?" the button that deletes is `pip` `#cb2f43` with white words (5.21:1, measured). This amends 5.8, which said red is "never on a button": red is now on the one button that deletes, on those two screens, and nowhere else. In 5.8's table `pip` reads "the one small mark on the paywall card, and the button that deletes".
- 5.8's Grandma line becomes: "the felt asks one thing, paper is what you touch, and the one Blue button is the next step; green is the safe way back, and the only red button is the one that deletes."
- The paywall's "Continue to payment" stays Blue. It is no longer the only Blue button on the site; its words and the money lines beside it say that money is spent.
- Measured, and worth knowing: Blue on the felt itself (the home page's "Sign in") is 2.67:1 against the page. The button is read by its white words, which pass; the home page goes when the feed replaces it.
- Measured, the buttons against what they sit on: Blue 2.67:1 on felt and 3.48:1 on the phone's bottom bar (`felt-deep`); red 2.75:1 and 3.57:1; green 1.50:1 and 1.96:1. Every button is read by its white words, which pass on all three.
- **The two deleting screens** ("Delete your account?", "Throw Floor Fifty away?") have a green button that keeps and a red one that deletes, and no Blue button. Enter does nothing on them.

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

## 2a. The audit of the first board: does this look like a top startup's product?

No. Every screen of the first board was looked at, on the phone and in the 1280 × 800 window. The words and the order of the questions were right. The look was a web form in a box.

On the computer, every screen:

- **The card in the upper centre.** The card is 640 wide in a 1280 window, 40 from the top. On "What's your game called?" it ends 304 down; the 496 below it, 62% of the window, is empty felt. On "Waiting for review" it is the smallest thing on the screen.
- **The scale is a phone's.** The question is 32px, the same size class as on the phone, in a window three times as wide. Hints are 14px. Buttons are 52 tall with 18px words. Nothing on the screen is bigger than a heading on a blog.
- **The box is a hairline.** A 1px outline, 52 tall, the same weight as the choices and the same weight as nothing. Typeform's answer is the biggest, plainest thing on the page.
- **The felt does no work.** It is a border around a white box. The window could be any size and the screen would not change.
- **Progress is hidden.** A 6px track inside the card with small grey words. It reads as decoration.
- **"or press Enter"** is 14px grey after the button, with no key drawn.
- **Nothing moves.** A question is replaced by the next with no sense of going forward.

Screen by screen, on the computer:

| Screen | What looks off |
|---|---|
| Sign in | Two hairline boxes and a small button in the top third. Labels at body size, title at 32px. |
| Your games, none | Three lines and a button, top centre; three quarters of the window empty. |
| Name, one line | The whole problem in one screen: small title, hairline box, tiny hint, small buttons, two links, all in the top 300. |
| Game files, not connected | Two paragraphs of equal weight; the one that matters ("Ruken copies your game from GitHub.") does not stand out. |
| Game files, connected | Rows are thin outlines with a grey dot; a picked row is told apart only by a thicker line. |
| Plays on | Two thin rows stacked in a wide card; nothing says "pick one of these two". |
| The two videos | A title, a 14px line and two buttons. "Upright" and "wide" have to be read; nothing shows the shape. |
| The agreement | Legal text at body size squeezed into a 640 card; the button is under the fold of the card. |
| Check and send | Seven rows in the narrow card run off the bottom of the window. Send is out of sight until she scrolls. |
| Waiting | "Waiting for review", the only news, is 24px in a small card. |
| Sent back | Staff's words at body weight; the list runs off the window; Send it again is out of sight. |
| Live | "Live" at 24px. Two buttons of different widths. Notes and rows in one column. |
| Throw away | The button that deletes is green, the same as Back everywhere else. |
| Your games | Three underlined links in a box. A game does not look like a thing. |

On the phone: closer, because a phone is one column anyway. Still off: the card floats at the top with the buttons in the middle of the screen, away from the thumb; the buttons move up and down from question to question as the hint grows; "Finish later" and "Throw this game away" sit under the buttons at body size, as loud as the question; nothing is fixed to the bottom, so it does not feel like an app.

## 3. The journey

Short screens stay short. The long form becomes one run of questions.

| Stop | Screen | The question or heading | Main button (Blue) | Other buttons (green) and links |
|---|---|---|---|---|
| Door | Your account `/me` | adds one line: "Make games? Add yours to Ruken." (a link to Your games) | as today | |
| | Sign in | Sign in | Sign in | as today |
| | Your games, none | Your games | Add a game | |
| 1 of 10 | Address, first game only | Pick your short address | Next | Back · Finish later |
| 2 of 10 | Photo, first game only | Add a photo for your page | Choose photo; once added, Next | Back · Skip for now · Finish later |
| 3 of 10 | About you, first game only | Say one line about you | Next | Back · Skip for now · Finish later |
| 4 of 10 | Colours, first game only | Pick your page's colours | Next | Back · Skip for now · Finish later |
| 1 of 6 | Name | What's your game called? | Next | Back · Finish later · Throw this game away, on every question about the game |
| 2 of 6 | One line | What's Floor Fifty about, in one line? | Next | Back · Finish later |
| 3 of 6 | Game files, not connected | Where are your game's files? | Connect GitHub | Back · Finish later |
| 3 of 6 | Game files, connected | Where are your game's files? | Next, then "Copying your game…" | Back · Don't see your game? Choose it on GitHub · Change the branch or folder · Finish later |
| 4 of 6 | Plays on | Where does Floor Fifty play? | Next | Back · Finish later |
| 5 of 6 | Upright video | Add your upright video | Choose video; once added, Next | Back · Choose a different video (a link) · Finish later |
| 6 of 6 | Wide video | Add your wide video | Choose video; once added, Next | Back · Choose a different video · Finish later |
| Almost done | The agreement, first game only | The maker agreement | I agree | Back |
| Last step | Check and send | Check it, then send | Send for review | Change, on each answer · Finish later · Throw this game away |
| | Waiting | Floor Fifty · Waiting for review | Back to your games | Change something |
| | Sent back | Floor Fifty · Sent back · What to fix | Send it again | Change, on each answer · Back to your games |
| | Live | Floor Fifty · Live | See it on Ruken | Send my newest version for review · Change, on the name, the line and where it plays · Back to your games |
| | Throw a draft away | Throw Floor Fifty away? | none | Keep it, green · Throw it away, red |
| | Your games | Your games | Add a game | each game is one link |

The table counts the game's questions as "of 6", as a maker's second game does. On a first game they are 5 to 10 of 10 (section 6).

"Floor Fifty" stands for the name she typed: from question 2 on, the question uses it, so she sees her answer was kept.

## 4. How a screen is laid out

The rule, one line: **the felt is the whole window and asks the question; paper is only what she touches.** Paper is the box she types in, a choice she picks, a game in her list, a sheet she reads. This is 5.8's own idea ("what a person picks up or acts on is a white paper card on it") taken at its word, and it is how Typeform uses its page. It replaces "one paper card per screen holds the one thing to do" on the maker's screens, sign-in and the account screens. The paywall card stays a card, over the clip. **Pending (question 2)**, because it changes 5.8.

No new colours, typefaces or sizes: every size below is already in 5.8's scale.

### 4.1 A question screen

- **One question per screen**, written on the felt in Young Serif, chalk, at the section-heading size: 64px on a computer, 36px on a phone. Left aligned, as 5.8 says.
- **The counter** sits over the question in words, "Question 2 of 10", body size, sage. Along the very top edge of the window runs a track, one piece per question, 6px tall, the answered ones chalk on Dusky Green. After the last question the words read "Almost done" (the agreement) and "Last step" (Check and send), and the track goes.
- **The answer is paper.** A text box is one white slab, no outline, 12px corners, 24px type, 72 tall on a computer and 64 on a phone. Choices are paper cards with their words in Young Serif; once one is picked the others step down to sage, so the picked one is the white one. Two choices sit side by side on a computer and stack on a phone. A page's colours are small pictures of the page.
- **A video's shape is drawn**: an upright block for the upright video, a wide block for the wide one, Dusky Green while empty and paper once a video is in.
- **The hint** is one line under the answer, body size, sage. A refusal sits under it in chalk, semibold, in today's words, with the box marked.
- **Top bar**: "Ruken" on the left, "Finish later" on the right, a link.
- **"Throw this game away"** is the small link, 14px sage, at the bottom left of the window on a computer and at the foot of the screen on a phone. It is there to be found, not read.

### 4.2 On a computer

- **The whole window is the stage.** The column is 760 wide (460 for sign-in, 880 for lists), centred across and centred down, so the question sits in the middle of the window whatever its size.
- **Buttons under the answer**: Back (green), then the Blue button, at least 168 wide and 60 tall, then **"press Enter ↵"** with the key drawn, sage. Enter presses the Blue button. The hint is not shown where Enter makes a new line (other websites) or where the Blue button opens a file picker.
- **Screens with something to read or check are two halves**: the heading and the buttons on the left, 480 wide, and one sheet of paper on the right. The agreement, Check and send, Sent back and Live. The button is always in view; the sheet scrolls inside itself if it must.
- **Your games**: the heading and "Add a game" on one line; each game is its own paper card, the whole card a button, its name in Young Serif at 32px and where it stands beside it.

### 4.3 On a phone

- **Thumb-first.** The buttons live in a bar fixed to the bottom of the screen (`felt-deep`, clear of the home indicator): Back on the left, the Blue button filling the rest. It is in the same place on every screen and stays above the keyboard. A screen with one button has it full width.
- The question starts at the top, under the top bar, so the keyboard never covers it.
- Two-half screens stack: heading, then the sheet, with the button in the bar.
- A second button that is not Back (Live's "Send my newest version for review") sits in the screen, not in the bar.

### 4.4 On a tablet

Owner, 2026-11-14: "tablet is first class supported, and mobile landscape". A tablet is its own layout, not a stretched phone or a squeezed computer. Drawn at 820 × 1180 upright and 1180 × 820 sideways.

- **The question is 64px**, as on a computer. The answer, choices and buttons are the computer's sizes, which are already finger-sized (60 and 72 tall).
- **Buttons sit under the answer**, not in a bottom bar: on a tablet the bottom edge is far from both hands and is where the on-screen keyboard comes up. There is no "press Enter ↵"; that shows only where there is a mouse.
- **Sideways** is the computer's layout: the 760 column centred both ways, and the two halves side by side.
- **Upright** is one column, 640 wide, centred both ways. The two halves stack: the heading and its buttons first, so the button is in view without scrolling, then the sheet of paper under them, scrolling inside itself.
- Your games: "Add a game" level with the heading, each game a paper card, as on a computer.

### 4.5 On a phone held sideways

Drawn at 852 × 393. Height is the scarce thing, and the keyboard takes half of it.

- **Two halves, always.** The question on the left at 36px, with the counter over it; the answer, the hint and the buttons on the right, by the right thumb.
- **No bottom bar.** Back and the Blue button sit under the answer, the Blue one filling the rest of the row, 52 tall.
- The top bar and the track stay. "Skip for now" and "Throw this game away" sit under the question on the left.
- Screens with a sheet of paper: the heading and the button on the left, the sheet on the right, and the screen scrolls.
- Your games: the heading and "Add a game" on the left, the games on the right.
- Both sides keep clear of the notch and the home indicator.

### 4.6 What moves

5.8 says "Pressing a button scales it to 0.97; nothing else moves." Added for these screens:

- **A step.** Going on, the old question lifts 12px and fades in 120ms, and the new one rises 28px into place over 460ms, its lines one after another 40ms apart. Going back, the same, downward. Only position and opacity change. The curve is `cubic-bezier(0.32, 0.72, 0, 1)`.
- The newest piece of the top track grows from the left as the step lands.
- A picked choice and a video's block change tone over 250 to 300ms.
- **With reduced motion nothing moves**, as 5.8 says: the next question is simply there.

### 4.7 What does not change

- **Answers are kept.** Every Next saves. From the first Next the game is in Your games as "Not finished. Go on from question 3.", and tapping it opens that question with her answers in place, on any device she signs in on.
- **Each question has its own address**, so the browser's Back works and a reload stays on the question. Each works as a plain page and form before its script wakes; the step's movement is the only part that needs script.
- **Refusals** are today's words: "Pick a name with at least three letters or numbers.", "A game needs one line about it.", "Choose the repository your game is in.", "Choose where your game plays." (new).
- **A press that takes time** says so on the button and cannot be pressed twice: "Copying your game…", "Adding your video…", "Sending your game…".
- **5.8's Never list holds**: no gradients, glass, shadows, emoji, icons or uppercase labels. Surfaces are told apart by a tone step.

## 5. What changes from today, screen by screen, and why

- **Your account.** One new line, the door to Your games (stall 1). Call.
- **Name, one line.** Split out of the card, asked first because they are the easiest (stall 3). Hints are today's words.
- **Game files.** Connecting GitHub moves inside question 3, after two answers are already saved, so the trip to GitHub loses nothing (stalls 2 and 7). The repositories are rows to tap, drawn by Ruken, not a dropdown (stall 4). The game is copied on this question's Next, so "We couldn't find an index.html at the top of that folder. Ruken starts a game from index.html." shows on the screen that asked (stalls 6 and 8). "Copy my game from GitHub again" leaves the first run; it stays as the Change on the files row of Check and send. The connect screen says "Ruken copies your game from GitHub. You choose which repositories Ruken can see. It can't see anything else."; "Your game needs an index.html that runs in a browser." is the hint under the list.
- **Plays on.** Nothing is chosen for her (stall 5).
- **The two videos.** One per screen, the same screen twice. The picker is the Blue button until a video is in; then Next is Blue and "Choose a different video" is a link under the buttons (stalls 9 and 10). The hints are today's, plus "Players see it in the feed before they play."
- **The agreement.** One screen with the whole text in its numbered layout and one button, "I agree". Pressing it is the agreeing; the tick box, the link out and the fold-out go (stall 11). The page at `/legal/maker-agreement` stays for anyone to read. Owner, 2026-11-14, on the date: "A". The agreement file's title line becomes "Ruken maker agreement, version 1, 14 November 2026", and both screens show "Version 1 · Last updated 14 November 2026" under the title, read from the file, never typed into a screen.
- **Check and send.** New. Every answer in one list, each with Change, which opens that one question (its button reads "Save") and comes straight back. She reaches it only with every answer in, so Send is not refused (stall 12). The rare question, "Does Floor Fifty use other websites?", lives here as a row that reads "None", so nobody else is asked it.
- **Waiting.** Where it stands, today's line ("We're looking at it. Come back here to see when it's live."), one button. The files and videos move behind one link, "Change something", which opens Check and send (stall 13).
- **Sent back.** "What to fix" and staff's words first, as today; under them the same list as Check and send; the button stays "Send it again".
- **Live.** The Blue button is "See it on Ruken" (stall 14). "Send my newest version for review" becomes a green button with today's note. Taking a game off Ruken (main design 5.4) is not on this branch and is not designed here.
- **Changing a name or a line** (the review's N1; Owner, 2026-11-14: "B", before launch). Before a game is live, Change on Check and send does it. On a live game, the Live screen lists the name, the line and where it plays, each with Change; Change opens that one question, its button reads "Save", and it comes straight back. Under the name box there: "Its address on Ruken stays the same, so links you've shared keep working." A game that was taken down cannot be changed.
- **Throwing a draft away** (the review's N2; Owner, 2026-11-14: "B", before launch). A game that was never sent, or was sent back, has a small link, "Throw this game away", at the foot of every question and of Check and send, the size of "Delete my account" on Your account. It opens one short screen: "Throw Floor Fifty away?", "Its files and videos are deleted from Ruken. Nothing changes on GitHub.", "You can't undo this." Green is "Keep it"; red is "Throw it away" (section 1). Afterwards Your games says "Floor Fifty was thrown away." once. Call: a game that is waiting, live or taken down has no such link; a live game leaves by the maker's own take-down (main design 5.4). This screen and "Delete your account?" are the same screen with different words.
- **Your games.** Each game is a paper card (section 4.2), with the new state words, "Not finished. Go on from question 3."
- **Every other screen of Ruken's own.** Only the main button's colour changes (section 1).

## 6. The main design's 5.7: one run, one counter

Owner, 2026-11-14: "13. A". 5.7 gave a new maker three steps with a "Step 1 of 3" line: the short address, the page, the first game. They are now the first questions of the same run, with the one counter. The "Step 1 of 3" line goes. Slice 4 builds them.

- **A first game is 10 questions.** Call: one question per screen holds for the page too, so the page is three questions, not one screen with three parts.
  1. "Pick your short address". The box starts with Ruken's address and a slash. Under it, at once: "floorfifty is free." or that it is taken. Refusal: "Pick an address with at least three letters or numbers."
  2. "Add a photo for your page". Blue is "Choose photo", then Next. Hint: "Players see it at the top of your page. You can add it later."
  3. "Say one line about you". Hint: "It sits under your name on your page. Like: I make small, hard games."
  4. "Pick your page's colours". Each choice is a small picture of the page in one of the book's combinations (5.3). Hint: "You can change them any time."
  5 to 10. The game's six questions.
- **Questions 2 to 4 can be skipped** (5.7: "Each can be skipped and changed later"): a link, "Skip for now", under the buttons. The page is live after question 4, as 5.7 says.
- **A maker who already has a page** is asked only the game's six: "Question 1 of 6".
- "Throw this game away" shows from the game's first question on; there is no game to throw away before it.
- The words of questions 1 to 4 are a Call, for slice 4's plan to carry.
- **Pending (question 3)**: 10 screens, or 8 with the page on one.

## 7. Questions only the Owner can answer

1. Answered. The other button on the two deleting screens is green: Owner, 2026-11-14, "safe is green, not safe is red, rest is blue" (section 1).
2. **Paper only for what she touches, and steps that move.** A (recommended): as on the board; this changes 5.8's "one paper card per screen" and "nothing else moves" for these screens. B: keep one paper card per screen, made larger and centred in the window, and nothing moves.
3. **A first game's count.** A (recommended): 10 questions, the photo, the line about her and the colours each on their own screen. B: 8, with the page's three parts on one screen.

Answered: the agreement's date line, "A" (section 5). The delete button, "delete account should be red obviously" (section 1). The address and page steps, "13. A" (section 6).

## 8. Left to the plan

- Where a half-answered game is kept so that it shows in Your games from the first Next, before its files are copied.
- The address of each question.
- The held-back test that the agreement's file carries a date, now that the date is decided.
- The journeys in `tests/browser/make.test.ts` and the look tests that name today's words and the ink button; each changes red first, in CI.

## 9. What was looked at, and what was not

- Tablet and sideways phone: every screen of the board looked at in all five sizes, one walk-through, no script errors.
- Second round. Looked at: every stop of the first board (15 screens, each on the phone and in the 1280 × 800 window), then every screen of the new board the same way, with the first-game run of 10, the refusal on the name, GitHub connected, a video added and a choice picked. No script errors, nothing sideways on a 400-wide phone. Step movement was looked at with reduced motion on only; the moving version was not recorded.
- Measured this round: the sizes in section 2a, from the first board's own stylesheet; the button contrasts in section 1, from 5.8's colour values.
- Looked at, first round: all 84 screenshots in the playwright-report of run 43616066455 (42 screens, phone and computer), one sheet at a time; the maker routes and `look.css` on `slice-2/submit`; the maker screens review on `audit/maker-screens`.
- Measured, first round: the two button contrasts and Blue on felt, from the colour values in 5.8.
- The first board was clicked through in a browser, start to "Check it, then send", then a change on a live game and a draft thrown away, with no script errors and nothing sideways on a phone. It shows the phone and the whole computer window side by side.
- Not run: no tests, no app. No app code changed.
