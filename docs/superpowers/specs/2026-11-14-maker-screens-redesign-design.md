# The maker's screens, redesigned: one question at a time

Date: 2026-11-14. Status: stopped by the Owner on 2026-11-14, to resume after the makers' sales spec; resumed on 2026-11-15 (Owner: "A", to "Resume the maker screens redesign now, adding all of that?"), with the new screens in section 10. Nothing here is built.

## Where it stopped

The Owner's words, 2026-11-14:

- "28. B, but I think we're good for now, don't proceed because we're missing some stuff (like the subcriptions, DLC, Revenue Splitting ect;)". Question 28's B was "Keep refining the mockup board in the cloud until it's 'fine', then build."
- "19. Ask as many questions as we need to". Question 19 was the count of a first game's questions (section 7, question 3). Coordinator's reading, not yet confirmed by the Owner: the run may be as long as it needs, so A, 10 questions, one per screen.

Where it stopped, and what's left. The board and this file are at their sixth round: every maker screen laid out five ways (phone, phone sideways, tablet upright, tablet sideways, computer), with the Owner's notes up to "This just looks bad man" and "live still shows the green background" applied. The Owner has not said "fine" on the board, and has not seen the last round's two changes nobody asked for (Live lost its paper list; Check and send lost the feed picture with Play over it). The redesign does not go on, and nothing is planned or built from it, until a makers' sales spec (subscriptions, DLC, battle passes, revenue splitting between makers) is written, because those add questions and screens to this run. When it resumes: get the Owner's "fine" on the board; fold the sales spec's questions into the one run and its counter; decide the things section 8 leaves to the plan (how staff mark each item sent back and why, where a thumbnail comes from, full-size playback, the cost of Live's video background on a slow phone); then plan. Not checked: whether the board's videos play on the board's own link (they play when the page is opened directly), and how the steps and Live's background look moving. Pull request #96 stays a draft.

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

The Owner's notes on the second board, 2026-11-14, word for word. Section 5a answers each.

1. "The preview for add your upright video looks small, will we be able to click it and see it larger? Actually just redesign 5 and 6 to have more oomph"
2. "For the agreement, computer 'Points 4 to 7 read as they do today. They are cut short on this board only.' is concerning; show me what it will actually look like"
3. "Finish later on phone sideways should be bottom right, too easy to accidentally press above the label"
4. "Check and send should show a preview of what it'll actually look like live"
5. "In general, we have wayyyy too much empty space on phone sideways view; as a rule of thumb, lean into making phone sideways as much like tablet sideways as possible"
6. "For sent back, show previews of media content, and use green for accepted and red for what failed"
7. "Show a thumbnail for Your games"

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
- **"Back to your games" on Waiting is Blue.** Owner, 2026-11-14: "Back to your games should be blue yes". It is that screen's way forward. As a link under another button (Sent back, Live) it stays a link.
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

The table counts the game's questions as "of 6"; section 10.5 adds the age rating as the 7th (and the 18+ marks as the 8th for an 18+ game), so a second game is "of 7" and a first game "of 11". Section 10.5 wins where they differ.

"Floor Fifty" stands for the name she typed: from question 2 on, the question uses it, so she sees her answer was kept.

## 4. How a screen is laid out

The rule, one line: **the felt is the whole window and asks the question; paper is only what she touches.** Paper is the box she types in, a choice she picks, a game in her list, a sheet she reads. This is 5.8's own idea ("what a person picks up or acts on is a white paper card on it") taken at its word, and it is how Typeform uses its page. It replaces "one paper card per screen holds the one thing to do" on the maker's screens, sign-in and the account screens. The paywall card stays a card, over the clip. Owner, 2026-11-14, to this and to steps that move (section 4.6): "18. A, change the design rule". 5.8 is amended: its idea line stands; "one paper card per screen holds the one thing to do" becomes "the felt asks one thing and paper is what you touch"; and its Motion line gains the step in section 4.6.

No new colours, typefaces or sizes: every size below is already in 5.8's scale.

### 4.1 A question screen

- **One question per screen**, written on the felt in Young Serif, chalk, at the section-heading size: 64px on a computer, 36px on a phone. Left aligned, as 5.8 says.
- **The counter** sits over the question in words, "Question 2 of 10", body size, sage. Along the very top edge of the window runs a track, one piece per question, 6px tall, the answered ones chalk on Dusky Green. After the last question the words read "Almost done" (the agreement) and "Last step" (Check and send), and the track goes.
- **The answer is paper.** A text box is one white slab, no outline, 12px corners, 24px type, 72 tall on a computer and 64 on a phone. Choices are paper cards with their words in Young Serif; once one is picked the others step down to sage, so the picked one is the white one. Two choices sit side by side on a computer and stack on a phone. A page's colours are small pictures of the page.
- **The video is the hero of its question** (section 5a, note 1).
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

Drawn at 852 × 393. Owner, 2026-11-14: "we have wayyyy too much empty space on phone sideways view; as a rule of thumb, lean into making phone sideways as much like tablet sideways as possible".

**The rule: a sideways phone is the sideways tablet, made smaller.** Same layout, same order, same places for things. Only these change, because the screen is 393 tall:

- The question is 36px, the box 56 tall, buttons 52 tall. The column is 600 wide, centred both ways.
- Choices sit two across, so a list of them does not push the buttons off the screen. Sign-in's two boxes sit side by side.
- The two halves stay side by side: the heading and its button on the left, the sheet of paper on the right, scrolling inside itself.
- Buttons sit under the answer, as on a tablet. No bottom bar.
- **"Finish later" is at the bottom right**, not the top right. Owner, 2026-11-14: "Finish later on phone sideways should be bottom right, too easy to accidentally press above the label". "Throw this game away" stays at the bottom left.
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
- **Live.** The Blue button is "See it on Ruken" (stall 14). "Send my newest version for review" becomes a green button with today's note. Taking a game off Ruken is section 13, M1 and M2.
- **Changing a name or a line** (the review's N1; Owner, 2026-11-14: "B", before launch). Before a game is live, Change on Check and send does it. On a live game, the Live screen lists the name, the line and where it plays, each with Change; Change opens that one question, its button reads "Save", and it comes straight back. Under the name box there: "Its address on Ruken stays the same, so links you've shared keep working." A game staff took down can be fixed and sent again (section 13, M3).
- **Throwing a draft away** (the review's N2; Owner, 2026-11-14: "B", before launch). A game that was never sent, or was sent back, has a small link, "Throw this game away", at the foot of every question and of Check and send, the size of "Delete my account" on Your account. It opens one short screen: "Throw Floor Fifty away?", "Its files and videos are deleted from Ruken. Nothing changes on GitHub.", "You can't undo this." Green is "Keep it"; red is "Throw it away" (section 1). Afterwards Your games says "Floor Fifty was thrown away." once. Call: a game that is waiting, live or taken down has no such link; a live game leaves by the maker's own take-down (main design 5.4). This screen and "Delete your account?" are the same screen with different words.
- **Your games.** Each game is a paper card (section 4.2), with the new state words, "Not finished. Go on from question 3."
- **Every other screen of Ruken's own.** Only the main button's colour changes (section 1).

## 5a. The Owner's notes on the second board, and what each changed

1. **The two videos have the screen** ("just redesign 5 and 6 to have more oomph"). The video is the biggest thing on its question. Before a video is in, its frame is already there at full size in the right shape, Dusky Green, saying "Taller than wide" or "Wider than tall"; tapping the frame chooses a video, the same as the Blue button. Once a video is in, it shows in the frame with a Play mark. Sizes: an upright video is 540 tall beside the question on a computer and a sideways tablet, 500 tall under the question on an upright tablet, 340 tall on a phone, 250 tall beside the question on a sideways phone. A wide video is 640 wide under the question on a computer and tablets, the full width on a phone, 380 wide beside the question on a sideways phone.
   **Tapping it opens it full size** ("will we be able to click it and see it larger?"): the video fills the screen on black and plays. "Close" is a green button at the top right; Escape closes it too.
2. **The agreement is shown whole** ("show me what it will actually look like"). The board shows all seven points, word for word from the agreement's file on `slice-2/submit` (`maker-agreement-v1.txt`). Nothing is cut. Each point is a number in Young Serif, a bold title, and its words under it. On a computer it is the sheet on the right; where the window is too short for all seven, the sheet scrolls inside itself and "I agree" stays in view on the left.
3. **"Finish later" on a sideways phone is at the bottom right** (section 4.5).
4. **Check and send shows the game as members will see it** ("a preview of what it'll actually look like live"). Above the Send button: her clip, with her address, the name, the line and Play laid over it, as the feed (main design 5.1) shows a game. Under it: "How members will see it in the feed." An upright screen shows the upright clip and a wide screen the wide one, as the feed does. The two video rows of the list carry a small picture each. Call: the preview is a picture of the feed, not the feed; its Play does nothing.
5. **A sideways phone is the sideways tablet, made smaller** (section 4.5). This is now the rule for every screen.
6. **Sent back marks every item** ("show previews of media content, and use green for accepted and red for what failed"; then, to be clear: "not just for media do red and green because we'll reject a game name if it's profane"). Every row of the list, the name, the one line, the game files, where it plays, each video and the other websites, carries one of two marks, in words and in colour: "Accepted" in Dusky Green (9.52:1 on paper, measured), or "Sent back." in red (`pip`, 5.21:1 on paper, measured) followed by the reason in plain words on the same line. The two video rows show the video, outlined in the same colour. Each row keeps its Change link, which opens that one question and comes straight back, so the fix is beside the reason.
   - The board's two examples: the upright video, "Sent back. It's sideways. Turn it the right way up."; and the name, "Sent back. We can't show this name on Ruken. It's rude. Pick another." The line under "What to fix" says the same in a sentence.
   - This is the second place red appears; 5.8's `pip` line gains "and the words Sent back on an item of a game that was sent back".
   - **This needs the staff side**: when staff send a game back they pick the items that failed and give each a reason. Today they write one note. Left to the plan (section 8).
   - A maker's page (address, photo, line about her, colours) is not part of a game's review; it is live when saved and moderated through Report (main design 5.3). So it has no rows here. If the Owner wants page details reviewed and marked the same way, that changes 5.3 and needs their words.
7. **Your games have thumbnails** ("Show a thumbnail for Your games"). Each game's card carries a still from its wide video on the left, 96 × 54 on a phone and 128 × 72 on a computer. A game with no video yet shows a plain sage block.

## 5b. Check and send and Sent back, audited and redone

Owner, 2026-11-14: "Audit check and send and sent back, they still read as poor UX/UI to me, but we're much much closer; also they look like screenshots and not videos you can preview".

### What read poorly

Looked at in all five sizes, as a tired stranger, and beside how Typeform ends a form and how upload and review screens in YouTube Studio, TikTok and App Store Connect are laid out (from memory of those products; none was opened for this).

Check and send:

- **Nothing led.** The heading, a small preview and a seven-row list had about the same weight. Those products lead with the thing itself, playing, and put the facts beside it.
- **The preview was a still picture**, 480 wide on a computer, smaller than the heading above it.
- **The list was loose.** Seven rows of two lines each, label over answer, with Change at the far right edge of a wide sheet, a long way from the answer it changes.
- **On a phone** the preview and seven tall rows made a long scroll before anything could be compared.
- On an upright tablet the list ran under the fold with its last rows cut off.

Sent back:

- **The one thing to fix was a red line in a list of seven**, fifth from the top, below the fold on a computer and on a sideways phone. She had to hunt for it.
- **Six green "Accepted" lines were as loud as the one red one.** Green everywhere reads as noise, and the red drowns.
- **The fix was a link called Change**, the same as on the six rows that needed nothing.
- **"Send it again" was Blue before anything was fixed**, so the obvious next press was the wrong one.
- The sentence under "What to fix" and the red line said the same thing twice, in two places.

### Check and send, now

Owner, 2026-11-14, on the first redo, whose answers were a two-column table in a white box: "This just looks bad man". The table is gone. The screen is the game, laid out.

- **On one side**: "Last step", the heading, the one Blue button ("Send for review", with "press Enter ↵" on a computer).
- **On the other, the game**:
  - **Its two videos as large playing tiles, side by side, in their real shapes**: the upright one and the wide one, the same height (264 on a computer, 300 on an upright tablet, 180 on a sideways phone). Each says in a small label whose it is: "On phones", "On computers". Tapping a tile opens it full size.
  - **Its name and its line, set as a title and a tagline**, the way the feed sets them: the name in Young Serif at 32px, the line under it at 24px in sage.
  - **The small facts as quiet chips** (Dusky Green, white words): where the files are ("your-name/floor-fifty"), where it plays ("Plays on phones and computers"), and other websites ("Runs on its own", or "Uses api.example.com").
- **One small "Edit" on each thing**: in the corner of each video, after the name, after the line, inside each chip. It is a small button, not an underlined link on every line. It opens that one question (its button reads "Save") and comes straight back.
- **Not shown**: file sizes, the file count, and anything that says "None".
- On a phone: the upright video on the left at 150 × 267, and beside it the wide video with the name and line under it; chips below; Send in the bottom bar.
- This replaces the feed picture with Play laid over it (section 5a, note 4): the two playing videos with the title and tagline under them are what the feed will show. Call.

### Sent back, now

- **It leads with only what needs fixing.** Under the name and "Sent back": "One thing to fix. Then send it again."
- **Each thing to fix is a red card** (`pip`, white words, 5.21:1 measured): what it is in Young Serif ("Upright video", or "Name: Floor Fifty"), the reason in plain words, the video itself playing if it is a video, and "Fix this". The whole card is the button. It opens that one question and comes straight back.
- **The Blue button names the fix**: "Fix the upright video", "Fix the name". It does what the first red card does. "Send it again" is not offered while something is red.
- **What passed is folded away in green**: one Dusky Green card (white words, 9.52:1 measured), "6 accepted", with "Show". Opened, it is the same tidy list, each row with Change.
- **Once everything is fixed** the red cards go, the line reads "Fixed. Send it again when you're ready.", the green card opens as "All 7 ready to send", and the Blue button becomes "Send it again".
- This replaces the marks on every row described in section 5a, note 6: red and green are now two kinds of card, not a word on each row. The Owner's rule is unchanged: every item, not only videos, is either accepted or sent back with a reason.
- Layouts. Computer, sideways tablet, sideways phone: heading, line and Blue button on the left, the cards on the right. Upright tablet and phone: stacked, with the Blue button in the phone's bottom bar.

### The videos on the board are real

Every video on the board is now a `<video>` that plays: on the two video questions, in the feed preview, on the red card, in the lists and on Your games. They loop without sound, as the feed does (main design 5.1). Tapping the video on its question opens it full size with the browser's own play, pause and scrub controls. With reduced motion a video does not start by itself.

The clip is a sample made for the board: a white block hopping up a tower, 3 seconds, drawn on a canvas at 24 frames a second and encoded with ffmpeg, upright (270 × 480) and wide (480 × 270), as MP4 (18,085 and 16,725 bytes) with a WebM copy (14,561 and 17,198 bytes) for browsers without MP4. Sizes measured from the files. They are inside the board's page; nothing is fetched.

## 5c. Live is the statement piece

Owner, 2026-11-14: "Let's also make it where Live is a statement piece, have the background uniquely for this page be the vertical or horizontal video, but blurred and bokeh and dimmed so it feels special".

- **Only on the Live screen**, the game's own video fills the whole screen behind the words, playing, looping, without sound. An upright screen uses the upright video and a wide screen the wide one, as the feed does (main design 5.1). Every other screen keeps the plain felt.
- **Blurred, dimmed, with bokeh.** The video is blurred (18px on the board), darkened to 55% brightness, and covered with black (`felt-deep`) at 50%, not with the felt colour, so the screen takes the video's own colours and does not read as the green of every other screen (Owner, 2026-11-14, on the first try: "live still shows the green background"). Five soft, blurred circles of sage at 12% drift slowly between the video and the dark layer.
- **The words stay readable whatever the video shows.** Worked out from those numbers for the brightest the background can be (a pure white video, under a circle): white words 7.70:1, sage notes 4.56:1. Without a circle: 8.13:1 and 4.82:1.
- **In front of it, the game itself, sharp**: beside the headline and the two buttons sit the video, playing and unblurred (the upright one on upright screens, the wide one on wide), the name and the line with a small "Edit" each, and where it plays as a chip. The same pieces as Check and send; the paper list is gone from this screen.
- **With reduced motion** the background is one still frame of the video, blurred and dimmed the same way, and the circles do not move.
- This amends 5.8 for this one screen: it is the only maker screen whose background is not the plain felt, and the only place a blur is used. 5.8's "no glass" stands: nothing is see-through over content; the video is the background, not a pane.
- The words and buttons are as section 5 says: the name, "Live" as the headline, "Players can find it on Ruken.", Blue "See it on Ruken", green "Send my newest version for review".
- Left to the plan: what a blurred, playing video costs on a slow phone, and whether such a phone gets the still frame instead.

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
2. Answered. Paper only for what she touches, and steps that move: Owner, 2026-11-14, "18. A, change the design rule" (section 4).
3. Answered by "19. Ask as many questions as we need to": one per screen, now 11 with the age rating (section 10.5).

Answered: the agreement's date line, "A" (section 5). The delete button, "delete account should be red obviously" (section 1). The address and page steps, "13. A" (section 6).

## 8. Left to the plan

- The full list of reasons for each part a staff member can tick (section 11.2).
- Where a game's thumbnail comes from (a still from the wide video) and when it is made.
- How a video plays full size on each kind of device.

- Where a half-answered game is kept so that it shows in Your games from the first Next, before its files are copied.
- The address of each question.
- The held-back test that the agreement's file carries a date, now that the date is decided.
- The journeys in `tests/browser/make.test.ts` and the look tests that name today's words and the ink button; each changes red first, in CI.

## 9. What was looked at, and what was not

- Fifth round: Check and send as tiles, title and chips, and Live with the sharper video background, each looked at in all five sizes with reduced motion on. The sample clip was redrawn in colour (a blue ground) so the background can be told from the felt.
- Live's background: looked at in all five sizes with reduced motion on (a still); not looked at moving. The contrast figures are worked out from the dimming, not sampled from the screen.
- Fourth round, Check and send and Sent back: both screens looked at in all five sizes before and after, in Sent back's three states (the video sideways, the name rude, after the fix). The videos played in the test browser (it used the WebM copy; the MP4 copy was checked with ffprobe only, not played). No script errors. Typeform, YouTube Studio, TikTok and App Store Connect were compared from memory, not opened.
- Third round, after the Owner's seven notes: every screen walked again in all five sizes, with a video added and opened full size; no script errors, nothing sideways on a 400-wide viewer. The agreement's seven points were copied from `src/features/make/library/maker-agreement-v1.txt` on `slice-2/submit`. The last two small fixes (the preview's shape on an upright tablet, a game card's words on an upright tablet) were not looked at again after they were made.
- Tablet and sideways phone: every screen of the board looked at in all five sizes, one walk-through, no script errors.
- Second round. Looked at: every stop of the first board (15 screens, each on the phone and in the 1280 × 800 window), then every screen of the new board the same way, with the first-game run of 10, the refusal on the name, GitHub connected, a video added and a choice picked. No script errors, nothing sideways on a 400-wide phone. Step movement was looked at with reduced motion on only; the moving version was not recorded.
- Measured this round: the sizes in section 2a, from the first board's own stylesheet; the button contrasts in section 1, from 5.8's colour values.
- Looked at, first round: all 84 screenshots in the playwright-report of run 43616066455 (42 screens, phone and computer), one sheet at a time; the maker routes and `look.css` on `slice-2/submit`; the maker screens review on `audit/maker-screens`.
- Measured, first round: the two button contrasts and Blue on felt, from the colour values in 5.8.
- The first board was clicked through in a browser, start to "Check it, then send", then a change on a live game and a draft thrown away, with no script errors and nothing sideways on a phone. It shows the phone and the whole computer window side by side.
- Not run: no tests, no app. No app code changed.

## 10. Resumed: the screens the sales and apps specs add

Owner, 2026-11-15: "A", to "Resume the maker screens redesign now, adding all of that? A) Yes, update #96 with the new screens, then you review it." The specs this section draws its screens from, each approved by the Owner: `2026-11-14-makers-sales-design.md` (5.5 to 5.10), `2026-11-14-apps-and-player-features-design.md` (age ratings, reviews, blocking, Ruken hooks) and `2026-11-14-beta-builds-design.md` (the maker's side). What each screen does is theirs; this section says how it looks and reads. The sales plan's branches I, J and M wait for the Owner's "fine" on this.

The board for section 10 to 12, round 7, every new screen in all five sizes: https://claude.ai/artifact/Wjg2oKxKVSWAXj8sKtDgXL (private to the Owner). All 20 screens looked at in all five sizes (a 21st, Store version, and the 35 screens of section 13 added after; those were looked at on the phone and the sideways phone only, with no script errors) in a test browser (Chromium), with no script errors. Fixed after that look: the season's days lacked the question track; on a sideways phone "Finish later" sat over the calendar; on a phone and an upright tablet the staff queue came after the other rooms, and a second button (Take off sale, Add a score, Send my newest version) came before the sheet instead of after it; money figures had a gap before full stops. Not looked at: WebKit, and the moving step between questions.

### 10.1 The screens

| # | Screen | From | What is on it |
|---|---|---|---|
| 1 | Age rating, a question when sending a game | apps spec, "Age ratings" | "Who is Floor Fifty for?": five choices, 3+, 7+, 12+, 16+, 18+, each with a plain line under it ("Fine for anyone.", "A little scary, or cartoon fighting.", "Some fighting or scary bits.", "More violence or strong words.", "Only for adults."). Owner, 2026-11-15: "Let's use the 3, 7, 12... split", the split Google Play shows outside the US. These label the game; accounts are still 13 and over. The apps spec (#107) says All Ages, 13+, 16+, 18+ and needs the same change at its plan step. Staff can change it; Sent back and Live show the rating staff set. |
| 2 | The game's extras | sales 5.5 | Each extra with its picture, price and where it stands; "Add an extra". |
| 3 | Add an extra | sales 5.5 | Kind, name, one line, picture, price from the fixed list, and a season pass's first and last day; then Check and send. |
| 4 | One extra | sales 5.5 | Where it stands, the id to copy into the game, Change, Take off sale. |
| 5 | Who shares the money | sales 5.6 | People by handle, a share beside each, "Shares must add up to 100%."; waiting for a yes. |
| 6 | Saying yes or no | sales 5.6 | Seen by the invited person: the game, the share, yes (blue) or no (green). |
| 7 | Money and statements | sales 5.7 | What a person is owed, from which games, each month's statement; also for a person in a split with no game. |
| 8 | Beta | beta builds | The beta branch, its state, "Send the beta for review", the testers. |
| 9 | Achievements and scores | apps spec, "Ruken hooks" | The game's achievements (name, line, icon, hidden until earned) and stats (name, higher or lower wins). |
| 10 | Players | apps spec, "Analytics" | Each player under an anonymous name with their events and device; country and age band only as totals of 10 or more. |
| 11 | Reviews | apps spec, "Reviews" | "Mostly liked (84% of 212)" and the reviews; the maker can read and report, not delete or answer. |

Blocking (apps spec, "Friends") has no screen of its own here: a blocked person added to a split or as a tester reads the same refusal as anyone who cannot be added ("We can't add that person."), so they are never told.

### 10.2 Calls

- **Adding an extra is one question per screen**, as a game's questions are, ending on its own Check and send. The sales plan's Task 24 says "one form"; the Owner's rule is "extended forms should be typeform-coded" (section 1's notes), and an extra has five or six answers. Its questions: what is it (two choices, "Something to keep" and "A season pass"), its name, its one line, its picture, its price, and for a season pass its first and last day.
- **The price is a choice of cards**, the eleven prices of sales 5.5, never a box to type in.
- **A season's days are picked on a calendar** drawn by Ruken, in Chicago days.
- **A share is picked, not typed**: each person's share is a choice of whole percents.
- **Take off sale** is red, then one short screen like "Throw Floor Fifty away?": green "Keep it on sale", red "Take it off sale".

### 10.3 A live game's home: a list of rooms

Owner, 2026-11-15: "A list of rooms", to "29. How should a live game's screen lead to its parts?"

- The Live screen (section 5c) is the game's home. Under its headline and buttons sits the list of rooms: Extras, Who shares the money, Beta testers, Achievements and scores, Players, Reviews. Each room is one paper row with its name and where it stands in a few words ("2 on sale", "You, 100%", "3 people", "5", "212 this week", "Mostly liked 84%"). Tapping a row opens that room on its own screen.
- A room opens as its own screen on every device, with "Back to Floor Fifty" at the top (section 14). On a computer and a sideways tablet the room's own parts sit side by side.
- Call: a room with nothing in it yet still shows, with what it is for ("No extras yet").

### 10.4 Achievements and scores are added on Ruken

Owner, 2026-11-15: "On Ruken, one at a time", to "30. Where does a maker list a game's achievements and scores?", whose words were: "In the Achievements room, Add an achievement asks its name, line, icon and whether it's hidden, one question per screen, like Steam. Each one is checked before players see it."

- **Add an achievement**: four questions, one per screen: its name, its one line, its icon (a picture, checked automatically as photos are, apps spec "Player pages"), and "Keep it hidden until someone earns it?" (two choices). Then Check and send. The id the game reports is made from the name and shown to copy, as an extra's is.
- **Add a score**: its name, and "Which wins?" with two choices, "Higher wins" and "Lower wins".
- **Checked before players see it**: a new or changed achievement or score waits for staff, as an extra does, in the same plain words ("Waiting for review", "Ready", "Sent back: <reason>").
- The room lists them, each with its icon, name and where it stands, and "How rare": "12% of players have this", once players have it.

### 10.5 Calls on the rest

- **A first game is 11 questions**, one per screen: the page's four, then the game's seven (the six of section 3, then "Who is Floor Fifty for?"). The Owner's "19. Ask as many questions as we need to" settles section 7's question 3 as A; the age rating adds one. A maker's second game is "Question 1 of 7".
- **The Players room** leads with three totals for the last 7 days (players, minutes played, wishlists), then beta plays as their own line (beta builds, "Money and numbers"), then the list of players under their anonymous names, newest first; tapping one shows their events in order and their device. Country and age band are a small table of totals under the list, each row only where 10 or more players share it.
- **The Reviews room** shows the summary, then each review with "Played 3 hours", thumbs and words, newest first, and Report on each. There is no Delete or Reply.
- **Money is not a room of one game**: statements are one per person (sales 5.7). It is a link on Your games, "Your money", and for a person in a split with no game, the only thing in the maker's area.
- **The rooms show from the game's first send**, so achievements and the split can be set while it waits. Extras can be added then too, and go on sale only once the game is live (sales plan, Task 24).

## 11. The staff screens

Owner, 2026-11-15, asked "When should we add the admin view for the maker?" and offered the maker's own dashboard (B) or Ruken staff's screens (A): "Well, B, but A is important". The maker's dashboard is section 10. This section is the staff side that every send from it needs, since a game, a beta, an extra and an achievement are each checked by a person before players see them. What staff may do is the main design's 5.5 and the specs of section 10; this says how it looks. Staff screens follow the same look and colours as the maker's (sections 1 and 4). **Everything staff do works fully on an iPad**, upright and sideways: Owner, 2026-11-15, "Don't make me have to go to my computer for something like this, I should be able to do it on my ipad". No staff step needs a computer, including playing a game to check it, a refund's second person and its code, and taking something down. Sideways, the two halves sit side by side; upright, the game plays at the top and the list of parts is under it, with the Blue button fixed in view. Call: the phone works too, stacked, for a quick look or a report.

### 11.1 The screens

| # | Screen | What is on it |
|---|---|---|
| 1 | The queue | Everything waiting, oldest first, one list: each row says what it is in one word (Game, Update, Beta, Extra, Achievement, Score), the game's name, its maker's handle and how long it has waited. |
| 2 | Checking a game, an update or a beta | Two halves: on the left the game playing in its frame, with "Play with every extra" and "Play with none" (sales plan, "Who owns what while testing"); on the right the list of its parts (name, line, files, where it plays, age rating, each video, other websites), each with a tick for "This is wrong". Under the list: Blue "Accept" while nothing is ticked; once something is ticked, the Blue button reads "Send back". |
| 3 | Checking an extra | The same two halves: the game playing with that extra unlocked on the left; its picture, name, line, price and days on the right, each with its tick. |
| 4 | Checking an achievement or a score | Its icon, name, line and hidden or not, each with its tick. |
| 5 | The age rating | On screen 2, the rating the maker picked, as four choices; staff can pick another before Accept. The maker sees the rating staff set. |
| 6 | Reports | Reports, oldest first: what was reported (a clip, a page, a review, a leaderboard entry, a friend request), the reason picked, how many people reported it. Staff can take down a game, a page or a review, or suspend an account, each with a reason that is recorded and sent. |
| 7 | Pictures held back | Photos, banners, icons and extra pictures the automatic check flagged, each beside "Show it" (green) and "Keep it hidden" (red, with a reason). |
| 8 | Money | The month, with the Extras block (sales plan, Task 32), refunds and disputes. A staff refund needs a second person and a fresh code (main design 5.5): the first person asks, and it waits on this screen until a second one says yes. Apple holds (sales 5.8) are a list: the sale, the day it was bought, "Held until Apple answers, or <day>". |
| 9 | What staff did | Every staff action, who and when, newest first, read-only. |

### 11.2 Calls

- **One queue for everything**, so nothing is missed in a second list.
- **Accept and Send back are one Blue button that changes**: with nothing ticked it accepts; with a tick it sends back. Staff cannot accept something with a part marked wrong.
- **Take down, suspend and "Keep it hidden" are red**, each with a short screen first, like "Throw Floor Fifty away?". Show it, Keep it and Back are green.
- **Sending back, part by part.** Owner, 2026-11-15: "Tick it, pick a reason", to "31. How do staff say what's wrong when they send something back?", whose words were: "Staff tick each part that failed and pick a plain reason from a short list, like \"It's sideways\". They can add a line of their own. The maker sees a red card for each part." Each ticked part opens its own short list of reasons, written for that part (a video: "It's sideways.", "It's not from this game.", "It's too dark to see."; a name or line: "It's rude.", "It's not this game's."; files: "It doesn't start."; an extra: "It doesn't unlock."), plus "Something else", which needs the line of their own. The plan writes the full lists, each reason passing the drunk-grandma test. The maker's red card (section 5b) shows the reason and the staff line under it.

## 12. 18+ games: sex, nudity and gore

**After launch.** Owner, 2026-11-15: "We can move 18+ for when we validate and prove this isn't an app MEANT for that for negotiation leverage", and "I'm fine with moving some things to post launch". Everything in section 12 stays written and decided, and none of it is in the launch build: the 18+ rating, the Sex or nudity, Gore and Drugs question, the marks and their reasons on staff's check, the per-store table, and the Store version (its branch, its room, its queue kind and its check). At launch the age question has three choices, All Ages, 13+ and 16+, and a game that is only for adults is sent back ("It's only for adults. Ruken doesn't take those yet."). No gambling with real money (12.0) holds at launch, at every rating.

**Amended: everything the app stores allow is allowed at launch.** Owner, 2026-11-15: "Gore and drugs is 18+", "Yes, at launch, rated 18+", then "Everything the app stores allow is allowed at launch". This replaces "After launch" above for anything a launch store allows. At launch:

- The age question has five choices, 3+, 7+, 12+, 16+ and 18+ (section 10, row 1), and the 18+ follow-up offers all four of its choices.
- Sex, nudity, gore and drugs are allowed up to the stricter launch store's limit, Google Play's, and Ruken rates such a game 18+ (never 17+). Owner, 2026-11-15: "The stricter store (Google)", to "Apple and Google allow different amounts. Which limit should the website and own download use at launch?". So every surface, the website, own downloads, the App Store and Google Play, shows the same at launch.
- A game is sent back for content past Google Play's limit ("Ruken doesn't take games like this yet."), until after launch.
- What waits until after launch is only what goes past the stores' limits: the browser and own-download-only content up to the Cyberpunk 2077 bar, with its Settings switch and content warning, and the censored Store version.
- Which store allows what is read from each store's own rules before the apps' plan (12.0a).

Owner, 2026-11-15, to "32. What can an 18+ game have that staff still accept?": "Sex and nudity too, but only for 18+ accounts in browser and desktop downloads, they shouldn't appear unless the user opts in settings, and they have a content warning beforehand, absolutely no pornography; same with gore".

This amends the main design's 5.5 ("Adult games are not accepted") and the apps spec's age ratings. What it means on the screens of this file:

- **The maker says so.** After "Who is Floor Fifty for?", a game rated 18+ gets one more question: "Does Floor Fifty have any of these?" with four choices, any or none: "Sex or nudity", "Gore", "Drugs", "None of these" (12.0). Hint, one short line that changes with what is picked: with Sex or nudity, "Players see it only if they turn it on. Some store apps hide it."; with Gore or Drugs only, "Players see it only if they turn it on."; then always, "Pornography and gambling are never allowed." Picking "None of these" clears the others. Call: a question only for 18+ games, so a first game is still 11 questions unless it is 18+.
- **Staff check it.** On checking a game (section 11.1, screen 2) the age rating row also shows these three marks (Sex or nudity, Gore, Drugs), and staff can add or remove any of them before Accept. "It's pornography." is a reason on the list (section 11.2), and a game sent back for it cannot be sent again as it is.
- **The maker sees it.** Check and send, Sent back and Live show the marks as a chip beside the rating ("18+ · Sex or nudity").
- **Who sees such a game** (not a maker screen, for the apps' plan): only an account 18 or over, only on the website and Ruken's own downloads, only after turning it on in Settings, and only after a content warning before its clip or page. Everywhere else, and for everyone else, the game does not exist: the feed, search, maker pages, links, extras, leaderboards.

### 12.0 The bar, and gambling

Owner, 2026-11-15: "Here's my thoughts: cyberpunk 2077 is a max bar for sex, nudity, violence, and drugs, no gambling".

- **The most an 18+ game may have is Cyberpunk 2077's level** of sex, nudity, violence and drugs. Staff measure against that: more than it is refused, and pornography is always refused. "It goes past what we allow." is a reason on staff's list for the age rating row.
- **Drugs** join the marks: the 18+ question's choices are "Sex or nudity", "Gore", "Drugs", "None of these". Call: gore and drugs do not hide a game from the store apps, because the stores' own 17+ and 18+ ratings allow them (12.0a); only sex and nudity can.
- **No gambling, at any rating.** Staff refuse a game that does it, with the reason "Gambling isn't allowed on Ruken.". An extra is a fixed thing: staff refuse one whose contents are random. Owner, 2026-11-15: "Anything with real money", to "33. Which of these count as the gambling Ruken refuses?", whose words were: "Betting real money, and random rewards bought with real money (loot boxes), are refused. Casino games played only for fun with fake chips are fine at 18+."

Owner, 2026-11-15, on Flathub and the Snap Store: "Stores (18+ content hidden)". So every store app hides games marked sex, nudity or gore (replaced by 12.0a, where only sex and nudity can hide a game): the App Store, Google Play, the Mac App Store, the Microsoft Store, Flathub and the Snap Store. Only the website and Ruken's own downloads show them, to adults who turned them on. Worth knowing, said once: Cyberpunk 2077 itself is sold on the Microsoft Store, so that store might allow such games; Apple's and Google's rules do not allow sex or nudity in apps. The Owner's rule stands.

### 12.0a Each store shows its most; censored versions

Owner, 2026-11-15: "Do the maximum the apps will allow, and give devs the option to create censored uploads for our censored platforms". This replaces "Stores (18+ content hidden)" above.

- **Each store app shows the most that store's rules allow.** Violence, gore and drugs rated 18+ on Ruken, up to the store's own limit; sex and nudity only where a store's rules allow them. Which store allows what is read from each store's own rules before the apps' plan and kept in one table there; until a store is confirmed, sex and nudity are hidden in its app. The website and Ruken's own downloads show everything up to the bar (12.0), to adults who turned it on.
- **A maker can give a censored version** for the store apps. Ruken loads it in a store app whose rules would hide the full game, and the full one everywhere else. A game marked for content a store hides, with no censored version, is hidden in that store's app, as before.
- **A second branch.** Owner, 2026-11-15: "A second branch", to "34. How does a maker give us the censored version of their game?", whose words were: "The maker names a branch (like their beta branch) for the store version. It's pulled and checked with the full one. Store apps only ever load its files." Call: once a store version is accepted, each new release pull asks for the store version too ("Send both for review"), so the two never drift apart for long; until the new store version is accepted, store apps keep the last accepted one.
- **Extras** are the same extras in both versions: one id, one purchase, owned in both (sales 5.4). Each version has its own `ruken-extras/<id>/` folders; staff check an extra unlocks in both.
- **Staff check both versions** (section 11): on checking a game, a switch "Full version / Store version" above the game; the parts list gains the store version's files, and the content marks are checked on each.
- **The maker's screens**: the age question's 18+ follow-up (12) gains a last line when a mark is picked: "Some store apps hide this. You can give us a censored version for them." with a link to the Store version room. A live game's rooms gain "Store version" (its branch, its state in the usual words, "Send it for review"), shown only for a game marked sex or nudity (gore and drugs do not hide a game from the store apps, 12.0).

### 12.1 What this touches beyond these screens

Flagged for the coordinator; none of these is decided here.

- **The apps spec** (merged): its age ratings gain the per-store table and the censored version (12.0a); "hides games rated above a player's age everywhere" stays. Each store's rules on mature content are read before its plan.
- **The sales spec and plan** (merged): an extra is owned in both versions, and the gate serves the store version's files to a store app's play pass. The owned file and messages do not change.
- **Slice 2's pull**: a game can have a release, a beta and a store version, each pulled and checked the same way.
- **The image checks.** The apps spec flags nudity automatically and hides it until staff decide. Pictures and clips of a game marked "Sex or nudity" or "Gore" need the check to label instead of block, and player and maker page photos still refuse nudity.
- **Stripe.** Stripe's rules on what a business may sell limit sexual content. Whether a game with sex or nudity can be sold through Ruken, or whether its presence puts Ruken's Stripe account at risk, is read from Stripe's own rules before this is built.
- **The law.** Some US states require a check of age, beyond a typed birth date, for sites with sexual material. That goes to the lawyer with pull request #104.
- **The apps spec** gains the Settings switch, the content warning and the hiding rule above.

## 13. What the coverage audit found, and the answers

The audit (`docs/superpowers/audits/2026-11-15-maker-screens-coverage-audit.md`, 2026-11-15) found 20 maker pieces and 17 staff pieces missing, and 8 contradictions. Contradictions 1, 2, 3, 5 and 6 are fixed in the sections above; 4 is the board's summary, redone; 7 and 8 are below. Every piece here is drawn on the round 7 board. Words are Calls unless marked Owner.

### 13.1 The maker

- **M1 Take my game off Ruken.** A red button at the foot of a live game's rooms, "Take Floor Fifty off Ruken". Its screen: "Take Floor Fifty off Ruken?", "Players can't find it or play it.", "Anyone who bought an extra in the last 14 days gets their money back, from what Floor Fifty earns.", "If they bought it in the Apple app, we send them Apple's refund page." Green "Keep it on Ruken", red "Take it off".
- **M2 Put it back.** The game's screen reads "Taken off Ruken" with Blue "Put it back on Ruken", which sends the newest version for review. Refunds already made stay made.
- **M3 Taken down by staff.** "Taken down", staff's reason as a red card, Blue "Fix it and send it again", which opens Check and send. This follows slice 4's Task 11.
- **M4 to M6 Your page.** "Your page" is a link on Your games, and opens a list of rooms like a game's: Address, Photo and banner, About you, Colours, Links, Social icons, What's on your page (the sections, each with Show or Hide and Move up), and "Your page's numbers" (page views and link taps, last 7 days). Each room is one question, as in the first run, with Save. Adding a link is two questions: its words, then its address; "A game somewhere else" is a choice on the first.
- **M7 Your page was taken down.** On Your games, a red card: "Your page is hidden. <reason>" with Blue "I've fixed it. Look again."
- **M8 Suspended.** Your games shows only: "Your account is paused.", staff's reason, "Your games are hidden and nothing new can be sent. Your money keeps going to you." and a link "Ask us about this". Nothing else can be pressed.
- **M9 Connect your bank.** A screen of its own: "Connect your bank to be paid", "Stripe asks for your bank and who you are. It takes about five minutes.", Blue "Connect with Stripe". After: "Your bank is connected. Ending 6789." with "Change bank". Until then, Your money says "Your money is waiting for you. Connect your bank to be paid." in a Blue card. The same screen follows "Yes, share it".
- **M10 A statement, and asking about a line.** Tapping a month on Your money opens it: each game's lines with their words (sales plan Task 32) and "Ask about this line" under each. Asking is one question: "What's your question about this line?", with a box, the line "We'll answer by 22 December." (the answer-by date from the sales plan, not a made-up promise) and Blue "Send". The answer shows under the line, and a text says it came.
- **M11 The agreement changed.** Before a maker's next send, one screen: "Our maker agreement changed", "What's new: selling extras, and sharing money with others.", the whole text as a sheet, Blue "I agree". Until then they can look but not send.
- **M12 Adding an extra, all of it.** Name ("What's it called?"), line ("Say what they get, in one line."), picture ("Add a picture of it", Blue "Choose picture"), then its own Check and send, the extra laid out as the buy card shows it, with Edit on each part and Blue "Send for review". Change: the same screens, and "A change is waiting for review. Players keep buying it as it is now." Remove a draft never on sale: red "Remove", one short screen, green "Keep it", red "Remove it".
- **M13 A split waiting.** The list shows "Waiting for @drummer to say yes. Until then the shares stay as they were." and red "Cancel this change". Shares that don't add up read "These add up to 90%. Shares must add up to 100%." in red, and "Ask them" stays but is refused with that line. Someone who left: "(left Ruken)" and "Change the shares so their part goes to someone." Under the list: "Each person connects their own bank to be paid." On Your account, the invited person sees a line: "@snekprty asked you to share what Floor Fifty earns." with "Have a look".
- **M14 How a game uses Ruken** (`/help/hooks`): one plain page with the lines to copy, in parts: add the script; extras (owned, buy, changes, protected folders); achievements; scores; events. Each part a sheet with Copy.
- **M15 Events.** The Achievements and scores room gains "Events": each event's name ("level_3_done") and how many sent it in 7 days, and "Add an event", one question: "What's the event called?" with the hint "Your game sends this name. Others are ignored." Events need no staff check: they are never shown to players.
- **M16 Adding an achievement and a score, all of it.** Name, line, icon ("Add a square picture", refused in words when the check flags it: "We can't use this picture. Pick another."), hidden. A score: "What's the score called?", then "Which wins?" (Higher wins, Lower wins).
- **M17 One player.** Tapping a player opens their made-up name, device, and their events in order, newest first, with when.
- **M18 Empty and early.** A room with nothing yet says what it is for and offers its Blue button ("No extras yet. An extra is something players can buy in your game."). Reviews under 10: "Not enough reviews yet. Reviews show once 10 players have left one." Before launch, Players shows wishlists only: "Ruken opens soon. Until then you see wishlists."
- **M19 Store version sent back**, and pulling both. The Store version room shows a red card with its reason and Blue "Fix it and send it again". Once a store version exists, Live's green button reads "Send my newest versions for review" with the line "We'll pull your full and store versions together."
- **M20 An extra a store can't sell.** Staff are told on the extra's check ("Not sold in Microsoft Store: no price high enough."); the maker is not, as the apps' slice map says.

### 13.2 Staff

All of it works on an iPad, either way up (section 11).

- **S1 Checking an extra**: the game playing with "Play with it" and "Play without it"; for a change, the live version beside the new one; ticks and reasons, including "It's random." and "It doesn't unlock."; a store that can't sell it named in a line (M20).
- **S2 Checking an achievement or a score**: its icon, name, line, hidden, each with a tick.
- **S3 Reports**: each report and Blue "Look at it". Taking down or suspending is a short screen: what, a reason picked from a list, red "Take it down" or "Pause the account", green "Back".
- **S4 Pictures held back**: each picture large, why it was held, green "Show it", red "Keep it hidden".
- **S5 The money month**: the pool, Extras (Sold, Paid by buyers, Tax, Fees, To games, To Ruken, Refunded, Disputed), Apple holds, refunds waiting.
- **S6 Find a purchase**: one box, "The number on their receipt", then the purchase and three reasons to pick ("Charged by mistake", "A parent undid it", "The law says so"), Blue "Ask for a refund", which waits for a second person.
- **S7 What staff did**: a list, newest first: who, what, when.
- **S8 Your staff code**: first sign-in shows a code picture to scan with an authenticator app and one box for the code it shows. Every money action asks for a fresh code.
- **S9 Who is staff**: each person with their role (Checks games, Money, Everything); Blue "Add someone", red "Remove" on each; "There must always be two people who can do everything." and Remove is refused for the last two.
- **S10 Switches**: each new screen with On or Off, and who changed it last.
- **S11 Live games**: search by name; each game with red "Take it down" and "Free to play" On or Off.
- **S12 Take an extra off sale**: on the extra's page for staff, red, with a reason the maker sees.
- **S13 The payout run**: the month's payouts, their total, "Checked by" with two people's names; Blue "Pay them" only after the second person said yes, with a fresh code.
- **S14 Makers' money questions**: each question with the line it is about, a box and Blue "Send answer".
- **S15 Marks and the bar**: on checking a game, the three marks staff can add or remove; reasons "It's pornography.", "It goes past what we allow." and "Gambling isn't allowed on Ruken."
- **S16 Store version**: a kind of its own in the queue, "Store version"; on its check the parts list is the store version's files and its marks.
- **S17 A report on a score or a friend request**: staff can remove the score ("This score was taken off the leaderboard.") or suspend the account. A friend request is ended by blocking, which the player does; staff can suspend.

### 13.3 Two decided here

- **Beta testers by email** (audit 3.7). Call: the beta spec's "email or handle" stays, and every refusal reads the same, "We can't add that person. Only members can test games.", for an unknown email, a non-member and a blocked person alike, so it never tells a maker whether an account exists.
- **Keyboard-only games on an iPad** (audit 3.8). Owner, 2026-11-15: "iPad with a keyboard", to "35. How do staff check a keyboard-only game from an iPad?", whose words were: "Staff clip a keyboard onto the iPad for those games. Ruken passes the keys to the game, so it works with no computer." On checking a computer-only game, one line above the game: "This game needs a keyboard. Connect one to your iPad."

## 14. The plain-words and get-stuck reviews, folded in

Two reviews read the board on 2026-11-15: a plain-words review (`/mnt/project-files/maker-screens/2026-11-15-maker-screens-plain-words-review.md`) and a get-stuck review (`2026-11-15-maker-screens-stuck-review.md`, same folder). Every fix below is on the board, version 6, which now has 60 screens.

### 14.1 Nobody gets stuck

- **Staff home has a door to every staff screen.** "Waiting for you" lists the queue, then Reports, Pictures held back, Live games, Money (months, refunds, payouts, questions), Find a purchase, What staff did, Switches, Who is staff and Your staff code.
- **Every staff screen has a way back** at the top right, "Back to staff home" or to the screen it came from ("Back to Money", "Back to Reports").
- **A report can be cleared.** A new screen, One report: the thing reported, how many people reported it and why, then green "Nothing wrong here" and red "Take it down".
- **A refund can be refused.** A refund's second yes has green "Don't refund", red "Yes, refund it" (money goes out, so it is red), and a "Not now" link.
- **A payout run can be stopped.** The payout run reads "Pay November's money", asks for a fresh code, and has red "Stop this run" beside Blue "Yes, pay them".
- **The staff code** can be typed as a key instead of scanned, and says what to do with a wrong code or a lost phone.
- **Who is staff** shows no Remove on the last two people who can do everything. Their role reads "Can do everything".
- **Switches** and **Live games** use buttons that say what they do ("Turn on", "Turn off"; "Free to play: On / Off").
- **Your games** is drawn as the maker's home, with doors to each game, Your page and Your money.
- **A paused account** can still reach Your money, and its Blue button is "Ask us about this".
- **The bank not finished, refused, or outside the US** each gets a screen saying the money is safe and waiting, and the one thing to do next.
- **One achievement** is a new screen: its name, how rare it is, and its id with Copy, so a maker can find the id again. Change it and Remove are there.
- **Every text link is at least 44 points tall**, as are ticks, reasons and choice pills, so a thumb hits them.
- **A room opens as its own screen** on every device, with Back (10.3).

### 14.2 Plain words

- "Pull for testing", "Pull for review" and "Fix it and pull again" are now "Send the beta for review", "Send it for review" and "Fix it and send it again".
- A live game's rooms end with red "Take Floor Fifty off Ruken" (M1), and its main button is "Send a new version".
- The 18+ hint is one short line (section 12). Anything the app stores allow comes at launch, rated 18+ on Ruken, up to Google Play's limit, the stricter launch store, on every surface (section 12).
- Asking about a line shows the answer-by date, not "two working days" (M10).
- "Your share: 40% of what Floor Fifty earns". Your money reads "From members playing it", "Floor Fifty total" and "Past months".
- Names inside a sentence are in quotes: Keep "The top" hidden…; Add an icon for "Halfway"; For "Best floor", which wins?
- The beta refusal is "We can't add that person. Only members can test games." everywhere (13.3).
- Smaller ones: "about 10% more" in the phone and store apps; days end at "midnight, US Central time"; the link on One extra is "How a game uses Ruken"; "Their @name" for the split's box; "@pixelpete (left Ruken)"; "Accepted" on the Store version; "We close it on 10 December. Paid on 15 December."; "We ignore any name you haven't added here."; "A child bought it without asking"; "like Google Authenticator"; a page link asks its kind first, then its words; "Finish later" is the one way to leave a question.

## 15. The visual review and the drunk-grandma walk, folded in

Two more reviews read version 10 on 2026-11-15: a visual review (`/mnt/project-files/maker-screens/2026-11-15-maker-screens-visual-review.md`) and a drunk-grandma walk (`2026-11-15-maker-screens-drunk-grandma-walk.md`, same folder). Every fix is on the board, version 11, which now has 62 screens.

### 15.1 The Owner's two rulings

- **Red means "can't be undone".** Owner, 2026-11-15, on a decision card. Red is only for acts that can't be taken back: paying out ("Yes, pay them"), refunding ("Yes, refund it"), taking a game off Ruken with its refunds ("Take it off"), and deleting (Remove on an achievement). Blue is the main forward action; a second forward action is a quiet blue outline (Add a score, Send a new version, Copy, Add, Earlier and Later, Turn on and Turn off, Make it free, Take off sale, staff's Take it down). Green stays for "nothing changes": Back, Keep, Cancel this change, Stop this run, Keep it hidden, Don't refund. "Not now" is a link on both money screens. A ticked "This is wrong" and its reason are blue, with a tick mark. Messages that something needs fixing ("Sent back", "Taken down", "Your page is hidden", "We couldn't start your game") are not red either: a white card with a blue edge and the label "Needs fixing" (visual review, pass 2). "Sent back" in a list is blue text.
- **GitHub only, with help.** Owner, 2026-11-15: "GitHub only, with help". Question 3, "Where are your game's files?", keeps Connect GitHub as the only way in, with the link "New to GitHub? Here's how to put your game there", which opens a plain step-by-step page. The missing index.html error reads "We couldn't start your game. Ruken starts your game from a file called index.html. We couldn't find one in that folder." with "Here's how to set up your game's folder" and "Pick another folder". Both are drawn on the board.

### 15.2 How it looks

- **Numbers** are lining everywhere: the heading font's digits come from the text font, so "1" never reads as "I" and the ratings sit level. Money is drawn one way, in the text font, black, at the label's size; no gaps in totals.
- **A picked choice** is a white card with a blue edge and a round tick; every unpicked card is white too. Pick-several (the 18+ question) has square ticks.
- **The five ratings** sit in one row on tablets and computers, and as a short list on a phone.
- **Buttons are pinned to the bottom** on an iPad held upright and on a phone held sideways, as on a phone, so the button never comes before the work.
- **No card scrolls inside itself**; the page scrolls.
- **Staff home**: the waiting list sits under "Waiting for you"; the other doors are their own card, "Everything else".
- **Tap targets**: ticks, Change links, calendar days and every link are at least 44 points.
- **Smaller**: stand-in pictures are a neutral tile with a picture mark, never a button's colour, and every row in a list has one; the play switch's three parts fill its bar ("Every extra", "No extras", "Full size"); a sideways iPad steps the heading down; question and room screens start at the same left edge; "Finish later" stays top right; Switches show On or Off as a chip; How a game uses Ruken shows each line of code above its Copy; the live game's blurred background has no smudge; Players' tiles read "players", "hours", "wishlists".

### 15.3 The words

- **Extras and achievements need code**, said up front: the first extra question's hint is "Your game has to unlock it. Here's how", the Achievements room's is "Your game unlocks these. Here's how", and Check and send shows the id the game calls, with Copy, before Send.
- **Videos** (questions 5 and 6, not on this board): each gets the hint "Record your screen while you play for 10 to 30 seconds."
- **A season pass**: "Bought once. On sale only between two days you pick. Buyers keep it after." (sales spec, Owner "2. A"). Its days: "Both days count, in US Central time."
- **The price** says "You get about $3.20 of each sale, before sharing." The figure comes from the split function for the picked price, never typed; the plan says how "about" is rounded.
- **Shares**: with two people, the common splits are cards (50 / 50 to 90 / 10), and "Another split" opens the list.
- **Waiting for a yes**: "If they don't answer in 14 days, we cancel this change." (14 is an example; the plan picks it). "Change the shares so their part goes to someone" shows only once nothing is waiting.
- **Saying yes**: the share is one large number, "40%", with "is your share of what it earns." under it.
- **Taking a game off**: "You and @drummer pay it, 60% and 40%, from what Floor Fifty earns." Open for the plan: what happens if the game hasn't earned enough yet.
- **Your bank**: "Stripe is the company that sends your money. It asks for your bank and who you are, and may ask for your Social Security number, for tax." Checked against Stripe's own sign-up before the plan.
- **Branch** has the hint "The GitHub branch with your test version." (censored version on Store version). Beta's button is "Send a new beta".
- **Taken down for the game's files**: "Fix it in your game on GitHub first. Then send it again."
- **Smaller**: "Change" everywhere, not "Edit"; no Enter hint beside "Choose picture"; the refund reason is "Charged by mistake", one of the three; taking something down offers "It's pornography"; "Back to your games" and "Back to Floor Fifty" wherever a screen goes back; Your games lists Your page and Your money as rows.

### 15.4 The second visual pass

On a phone held sideways, the staff check screens' headings are 32px like every other screen, and Staff home stacks its two cards so each row stays on one line. Held for the Owner: whether question screens on a computer sit in the middle or at the left edge.
