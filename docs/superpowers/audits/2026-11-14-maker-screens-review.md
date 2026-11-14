# Maker screens review, 2026-11-14

Owner, 2026-11-14: "do an opus high review of the new developer screens, it's a bit low effort; I don't like the native choose file button, and some of the button text makes things confusing". And: "The maker agreement is fine, but I think we need a date and better formatting so it's easier to read".

This reviews the maker's screens on slice 2's branch M (`slice-2/submit`, draft pull request #63) at `683a6cf`: `/make`, `/make/new`, `/make/<game>` and `/legal/maker-agreement`. It is the fix list for the next execution session. Findings are reported, not fixed: no app code changed on this branch.

The board, with the before screenshots of every state and each screen's findings beside them: https://claude.ai/artifact/KYV587i3g4oSFGEtTV1AHY (private to the Owner until shared). The screenshots are not committed: they are on the board.

## What was run

- **Where.** A local copy of `683a6cf`: `pnpm build` and `wrangler dev` against a local Postgres 16, with the repository's GitHub and Stripe stand-ins (`tests/browser/support/fake-*-server.ts`), started with the settings in `playwright.config.ts`. The game gate was not started: no screen here needs it.
- **Devices.** Playwright's iPhone 15 Pro profile (393 wide, its own scale of 3) and a computer at 1440×900, scale 1, in Chromium. Full-page screenshots.
- **States.** 24 per device, 48 in all: Your games empty and with three games; the new game screen before GitHub, after GitHub failed, empty, with each of three refusals, with choices made, and while copying; a game's page with no clips, with a file chosen, with a refused clip, refused for no tick and for no clip, with one clip, with both, with Replace open, while copying from GitHub, waiting, sent back, live, and with a refused copy; the agreement.
- **Sent back and live.** There is no staff screen on this branch, so those two states were made by setting the game's row as `sendBack` and `accept` would set it (state, reason, pending and live pull).
- **Copying.** The answer to the press was held back in the browser while the shot was taken, so the "can take a minute" state is the real page.
- **Measured.** The agreement's height and line length (Playwright, in the page). Two behaviours were checked by hand in a browser: what the GitHub link does to typed words (F5), and a double press of the new-game button (F4).
- **Looked at.** Every image, one by one.
- **Not run.** No tests (CLAUDE.md: tests run on GitHub's runners). No app code changed.

## How to read this

Each finding has a number, a rank, the screen and device, where in the code, what is wrong, and the exact new words or layout. **Must fix**: a stranger gets stuck, loses work, is misled, or the Owner asked for it by name. **Should fix**: it works but reads as unfinished or makes a person think. **Note**: worth knowing; some need the Owner's words before anyone builds them.

The test bar for every screen is AGENTS.md's: a tired stranger who makes games, on a phone, understands every word and button and finds the one next step on the first try. And the Owner's second bar for this review: does it look like a polished product.

Every word change here changes the journeys in `tests/browser/make.test.ts` that look for the old words ("Save and add your clips", "Upload", "Replace", "Step 3 of 3", "Get the newest version from GitHub", "I agree to the maker agreement", "Version 1"). Red first, in CI, as CLAUDE.md asks.

## Counts

| Rank | Count |
|---|---|
| Must fix | 11 |
| Should fix | 11 |
| Note | 9 |
| **All** | **31** |

## Top 10, in the order to fix

1. F1. Replace the browser's "Choose File / No file chosen" with Ruken's own picker that shows the file's name and size.
2. F2. Add a video the moment it is chosen; drop the separate "Upload" press.
3. F4. One press of "Save and add your clips" makes one game: a second press made a second game.
4. F3. Rename every confusing button (full table in F3).
5. F5. Put "Game files" first on the new game form, so the trip to GitHub doesn't wipe the name and line.
6. F6. Show each refusal under its own box, mark the box, and show all of them at once.
7. F8. Rebuild a game's page as a short checklist: where it stands, the one next step, then files, two videos, agree, send.
8. F10. The agreement: "Last updated" from the file itself, real numbered points, room to breathe.
9. F7. Drop "Step 3 of 3" until steps 1 and 2 exist.
10. F9. "Sent back" says what to fix in plain text, and the button says "Send it again".

---

## Must fix

### F1. The browser's own file button (Owner's ask)

- **Screen.** A game's page: no clips, file chosen, refused, Replace open. Phone and computer.
- **Code.** `src/routes/make/[game]/+page.svelte:87` and `:100` (`<input type="file">`); `src/lib/look.css` (`.card input[type="file"]` and its `::file-selector-button` rule).
- **What's wrong.** Each clip is a bordered box with the browser's "Choose File" and "No file chosen" in it. The words are the browser's, in title case, and change with the browser and its language. On the phone a chosen file's name is cut in the middle ("my-gam…ight.mp4") and there is no size. After a refusal the box goes back to "No file chosen", so the maker can't see which file was refused. It is the one control on Ruken's screens that is not drawn by Ruken.
- **Proposal.** One picker, one pattern in `look.css`, used by both videos (and by Replace):

  ```
  Upright video
  For phones: taller than wide. MP4 or WebM, up to 30 MB.
  [ Choose upright video ]
  ```

  After a file is chosen (the name and size come from the file the browser hands over, never typed):

  ```
  Upright video
  my-game-upright.mp4 · 4.2 MB
  Adding your video. Keep this page open.
  ```

  - **Markup.** A `<label class="file">` holding the real `<input type="file" name="clip" accept="video/mp4,video/webm">` and a `<span>` with the words. The input is hidden from sight only (one pixel, clipped, `opacity: 0`), never `display: none`, so it stays in the tab order, a screen reader reads it by the label's words, and Enter or Space opens the picker. The span wears the look's button: ink fill on paper, paper words, 12px corners, 48px tall, full width on a phone, as wide as its words from 48rem. Only the first missing video's picker is filled; the others are quiet (F8). `.file:focus-within > span` gets the card's focus ring.
  - **The name and size** sit on their own line under the label in the body face. A long name breaks inside the card (`overflow-wrap: anywhere`, as `.card` already does), never cut with "…". Size in the words `sizeWords` already uses on this page (`+page.server.ts:24`), so "1 KB" and "4.2 MB" read the same everywhere; move it to a small shared helper the page can import.
  - **Plain refusals before anything is sent**, under that video's line, from the chosen file:
    - Wrong type: "That's a .mov file. Ruken takes MP4 or WebM videos. Export it as MP4 and choose it again." (The ending comes from the file's name; with none, "That file isn't an MP4 or WebM video. Export it as MP4 and choose it again.")
    - Too big: "That video is 42 MB. Videos can be up to 30 MB. Make it shorter or smaller, then choose it again."
    - The server still checks everything (`clipProblem` in `src/features/games/clips.ts:66`); these only save a 30 MB trip that would be refused.
  - **Look test.** Add `file` to `CLASSES` in `tests/lib/look.test.ts`, and a case that pins the hidden input (not `display: none`) and the span's button rule, in place of the `::file-selector-button` case, which goes.

### F2. Choosing a file doesn't add it

- **Screen.** A game's page, a file chosen. Phone and computer.
- **Code.** `src/routes/make/[game]/+page.svelte:77-109` (each clip is a form whose `Upload` button sends it).
- **What's wrong.** Choosing a video does nothing until a second, quiet "Upload" press under the hint. A maker who chooses both videos and presses the big "Send for review" gets "Add an upright clip." with the video they chose sitting right there.
- **Proposal.** With script, choosing the file sends the form (`form.requestSubmit()` in the input's `change` handler, after F1's checks pass). While it goes, the picker's button reads "Adding your video…" and cannot be pressed (`disabled`, `aria-busy="true"`), and the line under it says "Adding your video. Keep this page open." Without script, an "Add this video" button stays under the picker, as "Upload" does now; render it only until the page has woken (`{#if !woke}`, set in `onMount`), so it is never shown twice. A 30 MB video can take a while on a phone: see N6 for showing how much has gone.

### F3. Buttons whose words don't say what they do (Owner's ask)

- **Screens.** All four. Phone and computer.
- **What's wrong.** Two buttons on one page are both "Upload" and say nothing of which video. "Get the newest version from GitHub" on a live game also sends the update for review in the same press (`+page.server.ts:70-74`), and the button doesn't say so. "Replace" opens a second file box and another "Upload". "Save and add your clips" sits under "Step 3 of 3". "Choose other repositories on GitHub" reads as "pick a different one", not "let Ruken see more". "Send for review" on a game that was sent back doesn't say "again".
- **Proposal.** No two buttons sound alike; each says what pressing it does.

  | Where | Now | New |
  |---|---|---|
  | New game, main button (`new/+page.svelte:130`) | Save and add your clips | Save and add videos |
  | New game, under the repository list (`:81`) | Choose other repositories on GitHub | Don't see your game? Choose it on GitHub |
  | Game page, each video (`[game]/+page.svelte:94`, `:107`) | Upload | gone (F2); the picker reads "Choose upright video" / "Choose wide video" |
  | Game page, an added video (`:83`) | Replace (a fold-out) | Choose a different video (the picker itself, quiet; no fold-out) |
  | Game page, files, draft or sent back (`:63`) | Get the newest version from GitHub | Copy my game from GitHub again |
  | Game page, files, waiting | Get the newest version from GitHub | Copy my game from GitHub again, with the note "We'll review the newest copy." |
  | Game page, files, live | Get the newest version from GitHub | Send my newest version for review, with the note "Players keep the version they have until we say yes." |
  | Game page, send, sent back (`:131`) | Send for review | Send it again |
  | Game page, the tick (`:121`) | I agree to the maker agreement | I've read and agree to the maker agreement |

### F4. A second press makes a second game

- **Screen.** New game, while copying. Phone and computer.
- **Code.** `src/routes/make/new/+page.svelte:44-50` and `:130`; the same pattern on a game's page at `[game]/+page.svelte:55-63`.
- **What's wrong.** The button stays pressable while the game is copied. Checked here: with the answer held 1.5 seconds, two presses sent two requests and made two games, `double-tap` and `double-tap-2`. A real copy takes up to a minute, the note under the button is small grey type, and a person who sees nothing change presses again.
- **Proposal.** From the press until the answer: the button reads "Copying your game…", has `disabled` and `aria-busy="true"`, and the note under it stays: "This can take a minute. Keep this page open." The same on a game's page for the copy button and for Send. Without script the browser already sends one form at a time per page load, so nothing more is needed there. Motion stays as design 5.8 says (nothing moves but a pressed button): the change is in words, not a spinner.

### F5. The trip to GitHub wipes what was typed

- **Screen.** New game. Phone and computer.
- **Code.** `src/routes/make/new/+page.svelte:52-81` (Name and One line come before the repository list, and the link to GitHub at `:81` is a full page load).
- **What's wrong.** Checked here: type a name and a line, press "Choose other repositories on GitHub", come back: both boxes are empty. The person most likely to need that link (their game isn't in the list) is the one who has just typed.
- **Proposal.** Put "Game files" first in the form, with the GitHub link right under its hint, then Name, One line about your game, Plays on, the two fold-outs, and the button. Nothing has been typed yet when a maker leaves for GitHub.

### F6. Refusals far from their boxes, and one at a time

- **Screen.** New game with each refusal; a game's page when Send is refused. Phone and computer.
- **Code.** `src/routes/make/new/+page.svelte:127-129` (every refusal above the button); `+page.server.ts:71` (one `error` string); `src/features/games/service.ts:195-202` (the checks run in order and the first one wins); `[game]/+page.svelte:128-130`.
- **What's wrong.** "Choose the repository your game is in." shows above the button, nine lines below the list it is about. With name "!!" and no line, the form says "A game needs one line about it." and only after that is fixed says the name is too short. The box itself isn't marked, and nothing ties a hint or a refusal to its box for a screen reader (no `aria-describedby`, no `aria-invalid` on either page; checked). On a game's page, Send is refused three times in a row for three different things: the tick, then the upright clip, then the wide clip.
- **Proposal.**
  - The action returns `problems: { repo?, name?, oneLine?, servers? }`, every one it finds, not the first. The service keeps its rules; the form route asks for each field's words (split `createGame`'s checks into a `gameFieldProblems(input)` that returns them all, and have `createGame` throw the first, so the service's own guard stays).
  - Each refusal sits right under its own box's hint, in the `problem` style, with `id` and the box's `aria-describedby` pointing at both the hint and the refusal, and `aria-invalid="true"` on the box. A refused box gets the 3px edge the chosen `.choice` row already has (`look.css`, `.choice:has(input:checked)`), so it is seen without colour.
  - After a refused send, the first refused box takes focus, so a phone scrolls to it.
  - On a game's page, Send's refusal lists everything still missing in one sentence, worked out on the page from what it already has (`data.agreed`, `game.clips`, the files line): "Before you send it: add the upright video, add the wide video, and tick the box." Each part shows only when it is true.
  - The websites refusal uses the box's own word: "Write each website like api.example.com, one per line. Five at most." (now "Write each server as a name like …", from `connectHostsFrom`), and the box's hint says "Five at most." too.

### F7. "Step 3 of 3" on the first screen a maker sees

- **Screen.** New game, every state. Phone and computer.
- **Code.** `src/routes/make/new/+page.svelte:31`.
- **What's wrong.** Steps 1 and 2 (your short address, your page; design 5.7) come in slice 4. Today a maker presses "Add a game" and is told they are on step 3 of 3, having seen no step 1 or 2. Under it the button says "Save and add your clips", which reads like a step 4 (the second board said so too).
- **Proposal.** Remove the line now. Slice 4, when it builds steps 1 and 2, shows "Step 3 of 3" only to a maker who arrived through them. Add a line to `docs/superpowers/progress.md` under slice 4's open items so it is not lost.

### F8. A game's page has no clear next step

- **Screen.** A game's page, every state. Phone and computer.
- **Code.** `src/routes/make/[game]/+page.svelte:33-135`; `src/lib/look.css` (`.statement`, `.card h2`).
- **What's wrong.** The state ("Not sent yet") and the section heading ("Game files") are the same face at the same 24px, so the state reads as a heading. The two videos have no heading of their own and read as part of "Game files". With no videos, the only filled button is "Send for review", which can only be refused. "Added" sits in small grey type with a big gap before "Replace". The plan's own sketch for this page (slice 2 plan, Task 28) is a three-line checklist; what was built is a stack.
- **Proposal.** The plan's checklist, made real:

  ```
  Floor Fifty
  Not sent yet                                   ← statement (24px)
  Add your two videos, then send it for review.  ← body, the one next step

  Game files                                     ← label (body, 600)
  ruken-test/tiny-game · 3 files, 1 KB
  [ Copy my game from GitHub again ]             ← quiet

  Upright video                                  ← label
  Added · 4.2 MB                                 ← or the picker of F1
  [ Choose a different video ]                   ← quiet

  Wide video
  For computers: wider than tall. MP4 or WebM, up to 30 MB.
  [ Choose wide video ]                          ← ink, the one filled button while it is missing

  [x] I've read and agree to the maker agreement
  [ Send for review ]                            ← ink once both videos are in
  ```

  - The three rows (files, upright, wide) are each a label, one line of where it stands, and its one button, 2rem apart, with no headings. That removes the two same-sized serif lines.
  - The next-step line under the state, by state:
    - draft, files refused: "Fix your game's files on GitHub, then copy it again."
    - draft, a video missing: "Add your two videos, then send it for review." (or "Add your wide video, then send it for review." when one is in)
    - draft, ready: "Everything's here. Send it for review."
    - waiting: "We're looking at it. Come back here to see when it's live." (keeps today's promise: no mail is sent yet)
    - sent back: F9.
    - live: "Players can find it on Ruken." and the "See it on Ruken" link.
  - Only one filled button at a time: the first thing still missing. Until both videos are in, the picker of the first missing video is the filled one and Send is quiet; then Send is filled. (Design: "the last button is the only filled one" holds once the page is ready.)
  - "Added · 4.2 MB": the size is the clip row's `bytes` (`prisma/schema/games.prisma`, `GameClip.bytes`), which `gameForMaker` would return in place of `true`. A measured fact, never typed.

### F9. "Sent back" sets staff's words as a headline

- **Screen.** A game's page, sent back; Your games. Phone and computer.
- **Code.** `src/routes/make/[game]/+page.svelte:35` (`statement` holds "Sent back: <reason>"); `src/features/games/review.ts:25-26`.
- **What's wrong.** Staff's reason ("The upright clip is sideways. Turn it the right way up and send it again.") is set in the 24px serif, four lines tall on the phone, and runs into "Sent back:". It doesn't read as "here's what to fix", and the button under it still says "Send for review".
- **Proposal.**

  ```
  Sent back                                       ← statement
  What to fix                                     ← body, 600
  The upright clip is sideways. Turn it the right way up and send it again.   ← body
  Fix it, then send it again.                     ← note
  ...
  [ Send it again ]
  ```

  `stateWords` stays as it is for Your games and for anything else that wants one line; the game's page shows the state and the reason apart (it has `game.state` and needs the reason as its own field from `gameForMaker`).

### F10. The agreement: a date and easier reading (Owner's ask)

- **Screen.** The maker agreement. Phone and computer.
- **Code.** `src/routes/legal/maker-agreement/+page.svelte:15-27`; `+page.server.ts:34-59`; `src/features/make/agreement.ts:10`; `src/features/make/library/maker-agreement-v1.txt:1`.
- **What's wrong.** "Version 1" with no date. Each point is a paragraph whose bold first sentence carries its own number ("1. Your game stays yours.") and runs straight into the body on the next line, with 1rem between points, the same gap as between lines of a point. On a phone the page is 1,770px tall (measured), about 2.7 screens, and the way back is only at the very end.
- **Proposal, the date.** The date comes from the agreement file, never from the page:
  - **Recommended:** the file's first line carries its date with its version: `Ruken maker agreement, version 1, 14 November 2026`. The page already strips that line (`TITLE_LINE`, `+page.server.ts:34`); widen the pattern to capture the date and give it to the page as "Last updated 14 November 2026". A unit test fails if the title line has no date, so a version 2 can't ship without one. This changes the file's first line, which the page never shows; the agreement's words are untouched. The file was kept "byte for byte as given" (progress.md), so the coordinator asks the Owner first. 14 November 2026 is the day the Owner approved version 1 (progress.md).
  - **Not recommended:** the date of the file's last commit, read at build time. CI checks out one commit (`actions/checkout` with no `fetch-depth`, `.github/workflows/ci.yml:27`), so the date would be the build's, not the file's, unless the workflow changes, which needs the Owner's words.
- **Proposal, the layout.** The Owner's words stay exactly as they are; only how they sit changes.

  ```
  Maker agreement                                 ← card title
  Version 1 · Last updated 14 November 2026       ← note
  You agree to this once, when you send your first game.   ← body (the page's words, not the agreement's)

  1  Your game stays yours.                       ← number hangs in the margin, display face; title body 600
     You let Ruken host your game and its clips…  ← body, indented to the title

  2  It's yours to share.
     …
  ```

  - The points are an `<ol>`; each `<li>` has its title (the file's words after the number, in 600) and its body under it, 0.25rem apart. The number is the list's own marker, set in the display face and hung in the left margin, so every title and body starts on one line. The file's "1." is the number; the server splits it off the way it already splits the title (`NUMBERED_POINT`, `+page.server.ts:43`).
  - 1.75rem between points, so each point reads as one block.
  - Lines stay at most about 60 characters on a computer (57 now, measured: keep `--width-read`); on a phone they are 34, which is fine.
  - A "Back to your game" link under the title as well as at the end, so the way back is never 2.7 screens away on a phone.
  - The journey that looks for `getByText("Version 1", { exact: true })` (`tests/browser/make.test.ts:194`) changes with the new line.

### F11. Your games: names you can barely tap, and no next step

- **Screen.** Your games, with games. Phone and computer.
- **Code.** `src/routes/make/+page.svelte:20-26`.
- **What's wrong.** Each game is a small underlined name on one line and its state on the next, with nothing to tell the rows apart and nothing that says what to do. Staff's whole reason for a sent-back game runs in the list. The design gives each game "where it stands in words"; a person still has to work out the next step.
- **Proposal.** Each game is one row that is a link as a whole (the name in the statement face, then its state and next step in body), 1.5rem apart:

  ```
  Pocket Orchard
  Sent back. See what to fix.

  Moth Lantern
  Not sent yet. Add your videos.

  Floor Fifty
  Live
  ```

  The second line is `stateWords` for live and waiting, and for the others the state plus its next step ("Sent back. See what to fix.", "Not sent yet. Add your videos." or "Not sent yet. Fix your game's files." when the copy was refused). The full reason is on the game's page (F9).

---

## Should fix

### F12. The empty list says nothing about what's needed

- **Screen.** Your games, empty. Phone and computer. **Code.** `src/routes/make/+page.svelte:17-18`.
- **Proposal.** "You haven't added a game yet." then "You'll need your game on GitHub, ready to run in a browser, and two short videos of it." then "Add a game". A maker learns before the first press what to have ready.

### F13. "Connect GitHub" doesn't say what Ruken will see, and can loop

- **Screen.** New game before GitHub, and after it failed. Phone and computer. **Code.** `src/routes/make/new/+page.svelte:32-39`.
- **What's wrong.** A maker is asked to connect a code account with no word on what Ruken gets. And a maker who connects but chooses no repository on GitHub lands on this same screen again, because the page shows it whenever the list is empty (`:32`): the plan's "Ruken can't see any of your repositories yet." screen was not built (progress.md, branch M, finding 2).
- **Proposal.** Under the two lines: "You choose which repositories Ruken can see. It can't see anything else." (design 5.4: the app is installed on just the repositories the maker chooses). And build the plan's screen for connected-but-empty: "Ruken can't see any of your repositories yet." and one button, "Choose repositories on GitHub".

### F14. "Clip" where the design says "video", and no word on which is which

- **Screen.** A game's page. **Code.** `src/routes/make/[game]/+page.svelte:23-26`, `:90`, `:103`.
- **What's wrong.** Design 5.4's sketch says "Upright video" and "Wide video". "Clip" is one more word to learn, and nothing says where each is shown or which way round it goes.
- **Proposal.** "Upright video", hint "For phones: taller than wide. MP4 or WebM, up to 30 MB." and "Wide video", hint "For computers: wider than tall. MP4 or WebM, up to 30 MB." One line above both: "Players see these in the feed before they play." (agreement point 1: Ruken shows the clips in the feed). Refusals follow: "Add an upright video." / "Add a wide video." in `service.ts:266-269`, and "Videos are MP4 or WebM." in `clips.ts:66`.

### F15. "One line" reads as an instruction, not a label

- **Screen.** New game. **Code.** `src/routes/make/new/+page.svelte:61-64`.
- **Proposal.** Label "One line about your game", hint "Players see it under the name. Like: Climb. Fall. Climb again." And for Name, hint "The name players see. Like: Floor Fifty." The examples are the design's own (5.4).

### F16. The agreement link leaves the page and loses the tick and a chosen file

- **Screen.** A game's page. **Code.** `src/routes/make/[game]/+page.svelte:122`.
- **Proposal.** Under the tick, a fold-out "Read the maker agreement" that opens the same points in place (the page loads them from the make feature, as the agreement page does). The full page stays for anyone who has the link.

### F17. A refused copy hides which repository it was

- **Screen.** A game's page, files refused. **Code.** `src/routes/make/[game]/+page.svelte:44-46`.
- **What's wrong.** The refusal replaces the "owner/name" line, so a maker sees what is wrong but not where. "Send for review" stays filled under it.
- **Proposal.** Keep "ruken-test/broken-game" on its line, the refusal under it in `problem`, then "Fix it on GitHub, then press Copy my game from GitHub again." The copy button is the filled one (F8's rule).

### F18. Waiting and live pages don't say what their buttons change

- **Screen.** A game's page, waiting and live. **Code.** `src/routes/make/[game]/+page.svelte:51-68`, `:110-112`.
- **Proposal.** Waiting: under the copy button, "We'll review the newest copy." Live: the video lines read "Added" and one note under both, "Videos can't be changed on a live game yet." (`service.ts:140` already refuses it). The copy button's words are F3's.

### F19. Copying gives almost no sign that anything is happening

- **Screen.** New game and a game's page while copying. **Code.** `src/routes/make/new/+page.svelte:131-133`; `[game]/+page.svelte:64-66`.
- **What's wrong.** The only sign is 14px grey type under an unchanged button; on a phone it is under the fold for a long form.
- **Proposal.** F4's button words do most of it. The note becomes body size, not `note`, while it shows: "Copying your game from GitHub. This can take a minute. Keep this page open."

### F20. Uneven spacing on a game's page and the form

- **Screens.** A game's page; new game. Phone and computer. **Code.** `src/lib/look.css` (`a:not(.button, .wordmark), .quiet` and `summary` negative margins; `.note` at 0.375rem).
- **What's wrong.** "Added" sits 0.375rem under its label and then a large gap before "Replace"; "Upload" is pressed against the note above it; "Choose other repositories on GitHub" still sits tight under the list's hint (the second board said so). The 48px tap targets borrow their height from negative margins, and next to a `note` the borrowing shows.
- **Proposal.** F8's rows fix most of it: label, one line, button, with 0.5rem between them inside a row and 2rem between rows. A quiet button that follows a note gets `margin-top: 0.5rem` in the row, not a negative one.

### F21. Hints that say how, not why

- **Screen.** New game. **Code.** `src/routes/make/new/+page.svelte:79`, `:110`.
- **Proposal.** "Game files" hint: "The GitHub repository with your game's index.html." (says what Ruken needs from it). "Plays on" hint stays: it is good.

### F22. The fold-outs' "+" reads as "add"

- **Screen.** New game, a game's page. **Code.** `src/lib/look.css` (`summary::after`).
- **What's wrong.** "Replace +" and "My game uses other websites +" read as "add a website", when the mark means "this opens".
- **Proposal.** With F2 and F3, "Replace" is no longer a fold-out. For the two left on the form, the mark becomes "›" when closed and "⌄" when open (`summary::after`), the usual sign for "opens here". The words stay as they are.

---

## Notes

### N1. A game's name and line can't be changed after it is made

`/make/<game>` has no way to fix a typo in the name or the line. Building it is new work and needs the Owner's words (CLAUDE.md, Scope).

### N2. A draft can't be thrown away

"Moth Lantern", whose files were refused, stays in Your games for good. Task 31 lets a maker take a live game off Ruken; a draft has no such button. Needs the Owner's words.

### N3. Show the video itself

The polished touch on a game's page is the added video playing, small and muted, in place of "Added · 4.2 MB". It needs a way for the maker's page to read the clip from the bucket. Later, with the Owner's words.

### N4. Drop a file on a computer

On a computer, dropping a video on its row could add it. Nice, not needed.

### N5. "index.html" and "branch" are developer words

They stay: the people who use these screens put HTML games on GitHub, and those are the words they use. Nothing else on the screens should need GitHub's words.

### N6. How much of a video has gone

A 30 MB video on a phone takes a while. `use:enhance` sends with `fetch`, which can't report upload progress. An `XMLHttpRequest` can ("Sending your video: 12 of 30 MB", in words, so nothing moves). Worth it once real makers send real videos.

### N7. The plan's "Calls" chose two screens over the design's one form

The design's sketch (5.4) is one form ending in "Send for review"; the plan made it two screens for good reasons (memory, and a refused copy shown before anything is sent). The proposals here keep two screens and make the second one read as the rest of the same task.

### N8. Taken off and taken down were not seen

Those states come with Task 31 and staff's screens, not on this branch.

### N9. The repository list wears the browser's own arrow

The `select` on the new game form shows the browser's chevron, a little unlike the boxes around it. A drawn chevron in `look.css` would match; it is small and can wait for a look pass.

---

## What this review did not cover

- The game gate and playing: not part of these screens.
- Sign-up and sign-in: the Owner said the account screens are not polished further (design 5.8).
- Screen reader passes with a real reader: the `aria-` gaps (F6) were found by reading the markup and checking the page, not by listening.
