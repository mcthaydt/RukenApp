# Staff review screens: plain-words check

Visual review step 1 (plain words) for slice 2, S Task 30, PR #138, branch `claude/project-thread-twy73v` at `e600760`.
This report only finds problems. Nothing else was changed. The fixes go to a separate session.

**The question:** could a drunk grandma understand every word? Someone tired and distracted should understand each line and
know the next step on the first try.

## What was read

Only the new work, as the Owner asked ("we should only do the passes on the new stuff too").

- The list of games to check: `src/routes/admin/games/+page.svelte`, its `+page.server.ts`, `src/routes/admin/+layout.svelte`,
  `src/features/admin/waited.ts`.
- The page for checking one game: `src/routes/admin/games/[game]/+page.svelte` and `+page.server.ts`,
  `src/features/admin/parts.ts`, `src/features/admin/played.ts`, the new words in `src/features/games/review.ts`
  (`GAME_CHANGED_WORDS`, `FILES_BEING_FIXED_WORDS`), and the refusals that `accept` and `sendBack` in
  `src/features/games/service.ts` show on this page.
- What the maker reads after Send back: `src/features/games/library/send-back-reasons.json` (its `maker` words) and
  `makerWords` in `src/features/games/send-back.ts`. These words reached main with branch M, but this is the first screen
  that sends them, so they are checked here. The maker's Sent back screen itself was approved and is not reviewed again.

Read from the source; no screenshots were taken (that is the design pass). No tests were run (CI only).

## Button colours

Pass. The page has one blue button, "Accept" that turns into "Send back" when something is ticked, as the spec says (11.2).
Neither one is red, which is right: a game that goes live can still be taken down, and a game sent back can be sent again.
"Full size" is a quiet underlined button, and the back links are links. No green button is needed: the page has no Keep,
Cancel or Back button, only the "Back to games to check" link.

## Findings

2 high, 10 medium, 8 low. Each has a suggestion; the fixing session may find better words.

### High

**H1. Two places to fix the age, with different names.** The list of parts has a part called "Who it's for" (showing, say,
"12+") with a "This is wrong" box and the reason "The age is wrong." At the bottom of the same sheet there is a second
section, "Age rating", where staff pick 3+ to 18+ themselves before Accept. A tired person sees two age controls and can't
tell which one to use: tick it to send the game back, or just pick another age and accept. They also have two different
names for the same thing. Suggest one name ("Who it's for" everywhere), and a line on the picker that says what it does,
for example "Pick who it's for. You can change what the maker picked." If the box on the age part is still wanted, its
reason should say why the maker must answer again rather than staff just picking.

**H2. The maker's message for "The age is wrong." only works one way.** The maker reads "We think {name} is for older
players. Choose again." Staff may tick it because the game is fine for younger players, and then the maker is told
something false. Suggest either two reasons ("It's for older players." / "It's for younger players.") with matching maker
words, or maker words that don't guess: "We don't think {name} is for the age you picked. Choose again."

### Medium

**M1. The page doesn't say what to do.** The checking page opens with the game's name, then a button that says "Accept",
above the game and above the parts. Nothing tells staff to play it and look at each part first, or that ticking a part
turns the button into Send back. A tired person may press Accept straight away. Suggest one line under the name, for
example "Play it and look at each part. Tick anything that's wrong, then press the blue button."

**M2. "Played so far: 2 minutes counted."** "Counted" means nothing to someone who doesn't know about pay rules, and
"nothing counted yet" sounds like an error. The line also doesn't say who played. It adds up every play of the game
(`playSummary(game.id)`), so for an update to a live game it includes players' time on the version that is already live,
not staff's time on the new files. The words claim more than the number shows. Suggest "You've played it for 2 minutes."
with a number that is only this check's play time; that needs a code change, so the fixing session should say so if it
can't be done in this round.

**M3. "Its maker is fixing its files. It comes back when they're fixed."** Two "its" and one "it" for three things. "Comes
back" doesn't say where to. It also doesn't say that Accept won't work now, while the button still says Accept. Suggest
"The maker is fixing this game's files, so you can't accept it yet. It will be back on your list when they're done. You
can still send it back."

**M4. "This game needs a keyboard. Connect one to your iPad."** Staff may be on a computer or a phone, where this is wrong.
Suggest "This game needs a keyboard. If you're on an iPad or phone, connect one."

**M5. "Add a line of your own, if you want" is wrong after "Something else".** When "Something else" is picked, the line
is required, and pressing Send back without one gives "Say what's wrong in your own words." The label told them it was
optional. Suggest the label say "Add a line of your own. You need one for Something else." or change with the pick.

**M6. The 18+ choices have no question.** When 18+ is picked, four boxes appear ("Sex or nudity", "Gore", "Drugs", "None
of these") with no line above them. A tired person doesn't know what they are being asked. Suggest a line like "What's in
it?" or the maker's own question wording.

**M7. Live games: some parts have no box, and nothing says why.** For an update to a live game, the videos, the age and
the websites show with no "This is wrong" box. Staff will look for it and wonder. Suggest one line on those parts or at the
top: "This game is already live. You can only send it back for its name, its line, where it plays or its files."

**M8. "It's not this game's."** (staff reason for a name and for a line). It's an awkward phrase a person wouldn't say,
and for a line it means something else ("it isn't about this game"). Suggest "It belongs to another game." for a name and
"It's not about this game." for a line, matching what the maker reads.

**M9. "It goes past what we allow."** (staff reason for files). It doesn't say which limit. The maker reads that the game
"has too much in it", so it means too big. Suggest "It's too big."

**M10. Wrong words for staff in the age errors.** If no age is picked, staff read "Choose who your game is for." It isn't
their game. If "None of these" is picked with another box, they read "Choose None of these on its own, or choose the marks
that are in it." "Marks" is a word from the code. Suggest "Pick who this game is for." and "Pick None of these on its own,
or pick what's in it." The other one, "Choose at least one, or None of these.", is clear only once M6 adds a question.

### Low

**L1. "waited 3 hours"** starts in lower case and reads as a fragment after the dots, on the list and on the checking
page. Suggest "Waiting 3 hours" (or "Sent 3 hours ago").

**L2. "Update"** alone, on the list and on the checking page, could mean many things. The spec asks for one word per row,
so keep it on the list; on the checking page, where there is room, suggest "Update to a live game".

**L3. "Nothing is waiting."** is plain, but leaves the screen with no next step. Suggest "No games to check right now.
New ones show up here."

**L4. "Gambling isn't allowed on Ruken."** is the only staff reason that isn't about what staff saw; every other one reads
"It's …" or "It …". Suggest "It has gambling."

**L5. The maker's "It's sideways. Turn it the right way up." for the wide video.** A wide video is meant to be sideways, so
this reads as nonsense on that card. Suggest different maker words for each video: upright, "It's on its side. Record it
with your phone upright."; wide, "It's on its side. Record it with your phone held sideways."

**L6. "Ruken doesn't take pornography."** and **"Gambling isn't allowed on Ruken."** (maker words) give no next step.
They can't fix it by changing a part, but they can still change it and send again. Suggest adding "Take it out, then send
it again." to both.

**L7. The maker's "Your game has too much in it for Ruken."** doesn't say how much is too much. Suggest naming the limit,
for example "Your game is bigger than Ruken allows (N MB)." with the number from the files check, not typed by hand.

**L8. "Not answered"** shows for a part with no value, including a missing video. For a video, "No video yet" is plainer.

## Not findings

- "Games to check", "Back to games to check", "This is wrong", "Something else", "Full size", "Accept", "Send back" and
  "This game changed while you were looking. Look again." all pass as they are.
- "Tick what's wrong first." and "A live game can only be sent back for …" can't be reached from the page (the button sends
  back only when something is ticked, and live games have no box on those parts). They are plain anyway.
- The staff sees the maker's email instead of a handle. That is by design until slice 3.
