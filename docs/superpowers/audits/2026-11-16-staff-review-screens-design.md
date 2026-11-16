# Staff review screens: words and design check (design half)

Visual review step 1, design half, for slice 2, S Task 30, PR #138, branch `claude/project-thread-twy73v` at `9888f77`.
This report only finds problems. Nothing else was changed. The fixes go to a separate session (Sonnet, high), and every
finding is fixed, the low ones too.

**The question:** is every screen right for layout, touch size and polish on every device and orientation? Words were
checked again only where the plain-words fixes changed them
(`docs/superpowers/audits/2026-11-15-staff-review-screens-plain-words.md`).

## What was looked at

Only the new screens, as the Owner asked ("we should only do the passes on the new stuff too"):

- the list of games to check, `/admin/games`;
- the page for checking one game, `/admin/games/[game]`, as it opens, with a part ticked and its reasons open, and with
  18+ picked;
- the words a maker reads after Send back (`send-back-reasons.json`, `makerWords`). The maker's Sent back screen itself
  was approved before and was not looked at again.

Screenshots:

- **From CI** (run 43780042536, commit `2945ab7`; `9888f77` only changes `progress.md`): the three look shots from
  `tests/browser/accept.test.ts` ("games to check", "checking a game", "sending a game back") on Pixel 7 upright and
  sideways, iPhone 15 upright and sideways, iPad (gen 7) upright and sideways in Chromium and WebKit, and a 1280x720
  computer.
- **Shot here, because CI has none**: iPhone SE upright and sideways, iPhone 15 Pro Max upright and sideways, and a
  1440x900 computer. The app ran in this container from the branch's own build (`wrangler dev`, the CI fakes, a local
  Postgres), with a game sent through `submitGame` and a staff member from `signInAsStaff`. Each view has the page as it
  opens, the whole page, the page with the upright video ticked and 18+ picked, and the end of that page in view.
- **Measured in the running app** at 1440x900, 1280x720, 1080x810, 932x430 and 568x320: which way the left half is
  placed, where the blue button is after scrolling, the game frame's size, anything to press under 44x44, and sideways
  scrolling.

Not shot: a game that needs a keyboard, an update to a live game, a refusal and the files-being-fixed state. Those were
read from the page's code and the look. No tests were run (CI only).

## Button colours

Pass. There is one blue button, Accept, which becomes Send back once something is ticked. Nothing is red, which is right,
because both can be undone. "Full size" is a quiet underlined button and the ways back are links.

## Findings

4 high, 5 medium, 7 low.

### High

**H1. On a computer and an iPad held sideways, the blue button scrolls away and never comes back.** The look keeps the
left half (name, button, game) in place while the sheet scrolls, by a rule on `.halves > :first-child`. On this page the
form's first child is the hidden `seen` field, so the rule lands on that field and the left half stays put on the page.
Measured: the left half's position is `static`. At the end of the sheet at 1440x900 the button is 1185px above the
window, and the whole left side of the screen is empty felt. Staff who look at the last parts have to scroll all the way
back up to press Accept or Send back. The same slip gives the hidden field the "a step below the one before" rule, which
adds 2rem of empty felt above the page's first line on phones and an upright iPad. Fix: put the hidden field inside the
left half, or aim the rule at the left half by name, so the left half stays in view.

**H2. On the white sheet, the choices can't be seen as choices.** A choice is a white card with a white edge. That works
on the dark felt of the maker's screens, but on the white sheet the card disappears. You see:

- each reason ("It's on its side.", "Something else") as a plain line of text, with no edge and no round mark until it
  is picked;
- the ages 3+ to 16+ as loose numbers in a row, with only the picked one drawn;
- the box for "Add a line of your own" as empty white space, with only the resize corner to show it is there;
- "This is wrong" and the 18+ question's boxes as words pushed 1rem in from everything above them, with a square
  floating in the middle of the sheet.

A tired person sees text, not things to tap, and does not see where to type. Seen on every view (for example 1440x900
ticked, iPhone SE ticked, CI iPad sideways "sending a game back"). Fix: on a sheet, give each choice and the box to type in
an edge that shows when nothing is picked (the look already has `--ink-soft` for edges on paper). Give a reason that is
not picked an empty round mark, as a box that is not ticked has an empty square.

**H3. The upright video is cut to a wide box, so staff can't see what they are judging.** `.clip` is `width: 100%`,
`max-height: 60dvh`, `object-fit: cover`, and the page doesn't use the `video.shape` it is given. At 1440x900 the upright
clip fills a 624x540 box, with its top and bottom cut away. The same happens wherever the sheet is wider than tall
(1280x720, iPad and phones held sideways). "It's on its side." is a reason staff pick for this video, and they are looking
at a cropped picture of it. Fix: draw the upright video upright (9:16, as tall as fits, centred) and the wide one wide
(16:9), with the whole frame showing (`contain`, not `cover`).

**H4. "Ruken" is written twice at the top of every staff page.** The site's own layout adds its wordmark on every page
except home and the maker's area. The staff area has its own bar with the wordmark and "Your account", so both show, one
above the other. Seen on all 14 views. On an iPhone SE held sideways, the two wordmarks and the bar take the top half of
the screen before the game's name. Fix: leave `/admin` out of the site layout's wordmark, as `/make` is.

### Medium

**M1. "This is wrong" and the reasons are squeezed into half the sheet.** From 500px wide, a set of choices is two across.
The one "This is wrong" card then takes only the left half. On an iPad held sideways it breaks to two lines ("This is /
wrong") with its square in the middle of the sheet. The reasons break the same way ("It's on its / side.", "It's not / from
this / game."). Fix: one to a row on the sheet. A single "This is wrong" stretches across, and the reasons stack, as they
do on a phone.

**M2. On phones held sideways, and at 1280x720, the game is small or not in view.** Measured frame sizes: 260x301 on a
932x430 phone held sideways, where the left half is 260px wide, and 528x224 on an iPhone SE held sideways, where the bar
covers 76 of 320px. On a large iPhone held sideways the first screen shows two wordmarks, the name and the bar, and none
of the game. At 1280x720 and on an iPad held sideways, the left half is taller than the window (979px and 1008px), so
once H1 makes it stay in view, the bottom of the game, "Full size", the play time and "Back to games to check" are still
below the window until the very end of the sheet. Fix: size the frame so the whole left half fits the window. On a short
window, make "Full size" (or the frame itself) the obvious way to play.

**M3. The age section repeats itself and is heavier than everything around it.** It shows the maker's pick ("12+"), then
"Pick who it's for. You can change what the maker picked." in the 24px display face (four lines on an iPhone SE), then
the five ages with the same 12+ picked again. "Or send it back, and the maker will choose again." comes after the 18+
question, so with 18+ picked it sits under "Sex or nudity … None of these", far from the ages it is the other choice
to. Fix: set the line above the ages in the small text style, show the maker's pick once (for example "The maker picked
12+." above the ages, or only as the picked age), and put "Or send it back…" straight under the ages.

**M4. "The maker is fixing this game's files…" is the quietest text on the page, while Accept stays blue.** When a game's
newest files were refused, the page says so in the small sage note style, between the name and a blue Accept button that
still works and only gives a refusal after it is pressed. Fix: show it in the same style as a refusal (`.problem`), or
make it the first thing under the name, so it is read before the button.

**M5. "Add a line of your own. You need one if you picked Something else." reads like a heading.** It is set in the 24px
display face, the same as a part's value, and is larger than the reasons it belongs to. It takes four lines on an iPhone
SE. Fix: the small text style, like the other lines that explain a control.

### Low

**L1. The line above the name breaks badly.** At 1280x720, 1440x900 and on an iPad held sideways, "Game · email ·
Waiting 1 minute" leaves "minute" alone on a second line. On phones and on the list's cards, an email breaks at its hyphen
("journey+ec198ff9- / 201@ruken.test"), which looks like two things. Fix: keep "Waiting 1 minute" whole
(`white-space: nowrap`), and put the email on its own line if it doesn't fit.

**L2. The check page doesn't line up with its bar on a wide computer.** At 1440x900 the bar starts 40px in and the page
starts 120px in, so the wordmark and the game's name begin at different edges. Fix: one left edge for both, as the
maker's wide pages have.

**L3. The page's one instruction is its quietest line.** "Play it and look at each part. Tick anything that's wrong, then
press the blue button." is small sage text under a 64px name, and on a computer it is easy to read past. Fix: the body
size, in chalk.

**L4. The parts are told apart only by space.** Each part's title is a 14px grey label, and its value, its video and its
box run straight into the next part's title. On a phone the sheet is a long run of similar blocks, and it is hard to see
where one part ends. Fix: a little more space between parts than within one, or the title a step larger.

**L5. Words (changed by the fixes): the wide video's reason contradicts itself.** For the wide video, staff pick "It's on
its side." and the maker reads "It's on its side. Record it with your phone held sideways." For a wide video, a phone on
its side is the right way to film. Suggest for the wide video: staff "It's upright, not wide."; maker "It's upright.
Record it with your phone held sideways."

**L6. Words (changed by the fixes): "This game is already live, so this can't be sent back."** The two "this"es mean
two different things. Suggest "This game is already live, so you can't send it back for this part."

**L7. Words (changed by the fixes): "Come back when they're done."** Staff can't tell when that is. Suggest "It stays on
your list until they're done."

## Not findings

- Touch size: nothing on the check page is under 44x44. Measured at 1440x900, 1280x720, 1080x810, 932x430 and 568x320,
  and CI's own journey checks every tick and link. The list's cards are well over 44 tall.
- Nothing scrolls sideways on any of the five sizes measured, or on any CI view.
- The bar with the blue button sits across the bottom on phones and an upright iPad, clear of the content, as on the
  maker's screens.
- The empty list ("No games to check right now. New ones show up here.") is plain and is not a dead end.
- In CI's "sending a game back" shots, the game frame says "Not found." and the videos are black or broken. That game is
  made by `makerWithGameWhere`, which gives it no files and stand-in clips, so this comes from the test and not the
  page. The "checking a game" shots, from a game sent for real, load the game and the videos.
- "12+" looks a little different from the other values because of the Ruken Digits face, which draws every number. That
  is the look's own rule.
- The other words changed by the fixes pass: "Waiting 3 hours", "You haven't played it yet.", "You've played it for 2
  minutes.", "It belongs to another game.", "It's not about this game.", "It's too big.", "It has gambling.", "It's for
  older players." and "It's for younger players." with their maker words, "Does {name} have any of these?", "Pick who this
  game is for.", and the maker's "Your game is over Ruken's {limit} limit. Take files out on GitHub, then send it again."
