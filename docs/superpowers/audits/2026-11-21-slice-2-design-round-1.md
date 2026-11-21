- Current task: slice 2 design review, round 1 (words-and-design check). Findings written; waiting for the builder's fixes.
- Last commit: 9d6663e (the commit reviewed; this file is the only change on the branch)
- Next step: the builder fixes reds 1 to 6 on this pull request; this reviewer shoots those screens again and checks each fix.
- Open decisions: none.

# Slice 2 design review, round 1

- Commit examined: `main` at `9d6663e`, built fresh in a cloud container (Node 24, Postgres 16, the four stand-ins and the game gate, started as `verify` says). Written 2026-11-21 03:40 UTC by a fresh session that did not build slice 2.
- Step: `visual-check` step 1, the words-and-design check, read beside the slice-end walk (`2026-11-21-slice-2-e2e-walk.md`, 126 of 126 steps pass).
- How: the repo's own browser journeys were run with a local, uncommitted patch that saved a picture of every screen they show, plus 27 extra states the journeys do not show. 294 pictures: phone (412 by 839), tablet (810 by 1080) and computer (1280 by 720), each as the first view and, where the page is taller, the whole page. Every picture was looked at one by one. The pictures and the patch are not kept.
- Measured by a program on every screen at all three sizes: the height of everything that can be pressed, every text size, and the contrast of every text against its background. The Live screen's backdrop was measured from the picture's pixels.
- Result: **6 red**, 9 notes. No screen is a dead end and no word of jargon was found outside the notes.

## What was measured (all pass)

- Press targets: every button and link is at least 44 px tall at all three sizes, with one exception, the "Join" link inside the sentence on the game page's Play card (35 by 23 px). It is a link inside a sentence, and the Play button above it takes a visitor to the same place. Note 1.
- Text sizes: 14, 16, 18, 24, 32 and 36 px on phone. Nothing under 14 px.
- Contrast: no text under 4.5 to 1. The dimmest, "Take it off Ruken" on the Live backdrop, measures 4.74 to 1 from the pixels of the computer picture.

## Red findings

### 1. Live has no way to see the game's page

- UNIT: Live screen (`src/routes/make/parts/LiveScreen.svelte`), all sizes.
- VERDICT: red.
- REQUIREMENT: `docs/superpowers/specs/2026-11-14-maker-screens-redesign-design.md` sections 5 and 5c: Live has "See it on Ruken".
- REASON: the link was held back until a game had a page of its own. That page (`/g/<name>`) now exists, and the link was never added.
- EVIDENCE: the comment in `LiveScreen.svelte` says there is no "See it on Ruken" until a game has a page for players. `tests/browser/make-walk.test.ts` (E5) asserts the link's count is 0. On screen: "You're in." has the button "See your game", which lands on Live; Live says "Players can find it on Ruken." and "Players see it on <name>'s page." with no link to that page. The home page has no list of games, so a maker cannot reach their own live game.
- EXPECTED: Live shows a "See it on Ruken" link that opens the game's page, on phone, tablet and computer.
- FIX: add the link to `LiveScreen.svelte`; update the comment and the E5 assertion. The blue button stays "Send a new version". Files: `LiveScreen.svelte`, `tests/browser/make-walk.test.ts`, and `tests/browser/make-after.test.ts` only if it reads the same screen.

### 2. A long word in a game's name is cut in the middle on a phone

- UNIT: Your games, a game's card, phone (412 wide).
- VERDICT: red.
- REQUIREMENT: layout and polish; `tests/browser/support/look.ts` already treats a broken word as a defect on other screens.
- REASON: the name's column beside the picture is narrower than one long word at that text size.
- EVIDENCE: a game named "The Extraordinary Long Adventures of Bartholomew" shows "Extraordinar" on one line and "y" on the next, both Live and Taken off. Tablet and computer wrap whole words.
- EXPECTED: a 13-letter word stays whole on a 412-wide phone.
- FIX: give the name room on the phone (a smaller picture or name size, or the name under the picture), in the card's style only. Add the long name to a journey so `brokenWords` checks it. Files: `src/routes/make/+page.svelte` or the card's rules in `src/lib/look.css`, and one journey.

### 3. "Choose your games on GitHub" wraps to two lines and sits left on a phone

- UNIT: question 3, GitHub connected with no game chosen, phone.
- VERDICT: red.
- REQUIREMENT: layout and polish; one main button, the same shape on every question.
- REASON: the label is too long for the button's width beside "Back".
- EVIDENCE: the blue button's words break after "games" and are left-aligned; every other bar button on the questions is one centred line.
- EXPECTED: one line, centred, like the other bar buttons, at 412 wide.
- FIX: a shorter label ("Choose on GitHub") or centred text with the button taking the row's free width. Files: `src/routes/make/parts/FilesQuestion.svelte`, and the journey that reads the label.

### 4. "Put it back" refused: the message says to choose the game on GitHub and gives no way to do it

- UNIT: Taken off screen after a refused "Put it back on Ruken", all sizes.
- VERDICT: red.
- REQUIREMENT: `visual-check` step 2: every error says what to do next, and the next step is always in sight.
- REASON: the message is the shared `NOT_VISIBLE` line; this screen has no link beside it.
- EVIDENCE: "Ruken can't see that game on GitHub. Choose it on GitHub, then try again." with only "Put it back on Ruken" and "Back to your games" on the screen. The files question shows the same trouble with a link, "Don't see your game? Choose it on GitHub".
- EXPECTED: the same "Choose it on GitHub" link under the message on Taken off.
- FIX: show that link on Taken off when this message shows. Files: `src/routes/make/parts/TakenOffScreen.svelte` (and its server file only if the link's address needs loading), one journey.

### 5. "press Enter" shows beside a button that cannot be pressed

- UNIT: question 3 while "Copying your game…", computer.
- VERDICT: red.
- REQUIREMENT: plain words, nothing that needs explaining.
- REASON: the hint is drawn whenever the screen is wide, whatever the button's state.
- EVIDENCE: the button reads "Copying your game…" and is off; "press Enter ↵" still sits beside it.
- EXPECTED: no hint while the button is off.
- FIX: hide the hint when the main button is disabled. File: `src/routes/make/parts/QuestionScreen.svelte` (line 102).

### 6. The video questions space their hint differently from state to state

- UNIT: upright and wide video questions, computer.
- VERDICT: red.
- REQUIREMENT: layout and polish.
- REASON: the gap under the heading is set by the state's own block, not by one rule.
- EVIDENCE: with nothing added and with the video in, the hint sits tight under the heading with no gap; while adding and after a refusal there is a gap. The same heading and hint jump between states.
- EXPECTED: one gap between heading and hint in all four states.
- FIX: one spacing rule for the hint. File: `src/routes/make/parts/VideoQuestion.svelte`.

## Notes (not defects, kept apart)

1. The "Join" link on the game page's Play card is 23 px tall. It is inside a sentence and the Play button does the same job for a visitor.
2. On a 720-high computer window the video questions are 764 px tall, so "Throw this game away" is cut at the bottom edge. On the phone it is half under the bottom bar on the age question and on Check and send. It is reached by scrolling.
3. On tablet the wide video's frame sits left and stops short of the right edge, while the upright frame is centred.
4. The game page as its maker sees it has no way back to Your games.
5. The "We can't find that page." cards (game and maker) have no Ruken name above them, unlike every other page.
6. With play time and players showing, "Watch it two ways" drops to a row of its own on computer, with empty space beside it.
7. "Change the branch or folder" on question 3 is GitHub's words. It is behind a link most makers never open.
8. The Starting screen says the game's name twice, as the heading and in "Starting <name>…".
9. The line under "Your games" changes between "A person checks every game." and "N% of games get in." as the numbers allow.

## Not covered

- The menu tab reading "RKN" is the Owner's decision and was not reopened.
- The home page ("Coming soon") is slice 3 and parked. Join and account pages belong to slice 1 and were seen only in passing.
- Safari's engine was not shot: the three sizes ran in Chromium. The repo's journeys cover WebKit in CI.
- Real videos were used where a journey supplies them; some journeys use a 1 KB stand-in clip, which shows as a flat box.
- The 18+ marks, a refused file, a wrong video and the taken-off states were shot; the decision-day wait was not.
