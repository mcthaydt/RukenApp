# Staff review screens: the end-to-end walk (visual review, step 2)

2026-11-16, slice 2, S Task 30, PR #138, branch `claude/project-thread-twy73v` at `cc0c868`. This walk only finds
problems. Nothing but this report was changed. The fixes go to a separate session (Sonnet, high), and every finding is
fixed, the low ones too, except W6, which needs the Owner's choice.

**The question:** can a tired, distracted staff member get from opening Ruken to a game accepted or sent back on the
first try, always seeing the next step and a plain way back?

**The short of it.** Once staff are on a game's page, Accept and Send back work, and a refusal keeps what was ticked and
typed. But staff can't get to the list at all without typing its address (W1), and when a game was already decided they
land on "We can't find that page." with a button that leads nowhere useful (W2). 9 findings: 2 high, 5 medium, 2 low.

## What was walked, and how

Only the new, not yet approved screens: the list of games to check (`/admin/games`) and the page for checking one game
(`/admin/games/[game]`), with the doors to them and the pages they lead to. The maker's Sent back and Live screens were
approved before and were not looked at again, nor were the words and looks the two step-1 checks covered
(`2026-11-15-staff-review-screens-plain-words.md`, `2026-11-16-staff-review-screens-design.md`).

The app ran in this container from the branch's own build (`wrangler dev` with the game gate, CI's stand-ins for GitHub,
mail and Stripe, and a local Postgres). A script drove it in Chromium with the journeys' own helpers: real games sent
through the maker's screens (`submitGame`), others written into the database (`makerWithGameWhere`), staff made with
`grantStaffRole`. Each journey below was walked on:

- a small phone: iPhone SE, 320x568;
- an iPad (gen 7), upright 810x1080 and sideways 1080x810;
- a computer, 1440x900.

The journeys:

1. **Getting there**: a staff member signs in, then looks for the list from home, Your account and the staff bar.
2. **Accept**: the list, a game, play it, Accept, back on the list.
3. **Send back**: tick a part, press Send back with no reason, then "Something else" with no line, then a reason.
4. **The odd cases**: 18+ with no marks; a game whose newest files were refused; an update to a live game.
5. **Two staff at once**: another staff member accepts the game first, then this one presses Accept.
6. **Not staff**: a member who isn't staff opens the list.

Not run: WebKit (Safari's engine), a real iPad or phone, a game that needs a keyboard, and a long queue. No tests were
run (CI only). Graphify was tried for who links to the staff list and who calls `playedWords`; its index is built from
`main` (`1407191`), which doesn't have these screens, so it found nothing, and the branch was searched as text instead.

## High

**W1. Staff can't get to the list without typing its address.** Journey 1, every view. Signed in, home shows only "Your
games" and "Your account". Your account (`/me`) has Ruken, Join Ruken, Sign out, "Add yours to Ruken." and Delete my
account, and nothing for staff. On the staff pages themselves, "Ruken" goes to home and "Your account" to `/me`, and
neither comes back. Nothing in `src` links to `/admin` (text search of the branch). So staff must remember and type
`/admin/games` every time, on an iPad too.
Fix: for staff, a "Games to check" link on home and on Your account, and in the staff bar.

**W2. A game someone else already decided ends on "We can't find that page.", and its button leads away.** Journey 5,
seen on all four views. A second staff member presses Accept on a game a colleague accepted a moment ago. The page goes
to `?/decide` and shows the site's error page: "We can't find that page." with one button, "Back to Ruken", which goes
to home, and home has no way back (W1). The same happens on opening any game from an old list or from the browser's
Back after deciding, because the page answers 404 for a game with nothing waiting.
Fix: when nothing waits any more, go back to the list with a line such as "Someone already checked Tiny game."; and the
error page, inside `/admin`, offers "Back to games to check" (as inside `/make` it offers "Back to your games").

## Medium

**W3. Nothing says Accept or Send back worked.** Journeys 2 and 3, every view. After pressing, staff are on the list and
the game is gone. A tired person can't tell whether it went live, was sent back or was lost, and the only way to check
is to ask the maker.
Fix: a line at the top of the list: "Tiny game is live." or "Tiny game was sent back. Its maker can see why."

**W4. A refusal doesn't say which part, and shows far from it.** Journey 3, and the 18+ question in journey 4. The page
comes back at the top with "Pick a reason for each part you ticked.", "Say what's wrong in your own words." or "Choose
at least one, or None of these." under the name. On the iPhone SE the page is 3681px tall and the ticked part ("One
line") starts 1209px down, so staff must scroll and look for the part they ticked. On the iPad upright the game fills
the first screen, so the parts are all below it. Nothing on the part itself is marked.
Fix: name the part ("Pick a reason for One line."), and put the same line inside that part, or open the page at it.

**W5. "You haven't played it yet." stays the same while staff play.** Journey 2. The line comes from when the page
opened, so after minutes of playing in the frame it still says they haven't played. A careful staff member thinks the
play didn't count.
Fix: update the line as they play, or reread it when they come back to the page.

**W6. Accept works without playing the game. Needs the Owner's choice.** Journey 2, every view. With "You haven't played
it yet." on screen, Accept puts the game live at once. The spec says staff play it (11.1). The options:

- a. Keep it as it is, once W5 makes the line true. (Recommended: it adds no step, and staff can see at a glance.)
- b. When nothing was played, Accept first asks "You haven't played Tiny game. Accept it anyway?"
- c. Accept waits until they've played for a minute.

**W7. A game whose files are being fixed still has a blue Accept that can only refuse.** Journey 4. The page says "The
maker is fixing this game's files, so you can't accept it yet. …" above a blue Accept that, when pressed, gives the
same words as a refusal. With 18+ picked and no marks, the first press refuses for the marks and only the second for the
files, so staff fix one thing and are still refused.
Fix: on such a game, don't offer Accept: the button reads "Send back" and says to tick what's wrong first, or the page
says "Come back later" with "Back to games to check" as its main way on.

## Low

**W8. A part's reasons are pick-one, but look like the tick-many box above them.** Journey 3. Each reason has the same
empty square as "This is wrong", so a tired person expects to tick several. Ticking a second reason quietly unticks the
first.
Fix: "Pick one." above the reasons, or a mark that differs from a tick box.

**W9. On a phone, the way back is in the middle of the page.** Journey 2 on the iPhone SE (and an upright iPad).
"Back to games to check" sits under the game, 940px down a 3681px page. At the end of the parts, where staff finish
reading, there is no way back except scrolling up 2700px or the browser's Back.
Fix: "Back to games to check" also at the end of the sheet on stacked views.

## Not findings

- The button says Accept until something is ticked and Send back after, and stays in view on every view walked, also at
  the end of the page (the design check's H1 fix holds: at 1440x900 and on the iPad sideways it stays 274 to 396px from
  the top).
- A refusal keeps every tick, reason and line, so nothing is done twice. "Something else" needs a line, and says so.
- An update to a live game says on each part it can't be sent back for: "This game is already live, so you can't send
  it back for this part."
- A member who isn't staff meets "We can't find that page.", so the staff pages stay hidden. That's on purpose.
- Pressing Accept twice quickly (tried three times on the iPad view, Chromium) puts the game live once and lands on the
  list.
- The empty list says "No games to check right now. New ones show up here."
- The list shows the maker's email, not a handle: makers have no handle until slice 3, as the list's code says.

## Summary

| | Findings | For |
|---|---|---|
| High | W1 no way to the list; W2 an already-decided game is a dead end | fixes session |
| Medium | W3 no word that it worked; W4 refusal far from its part; W5 play time doesn't move; W6 Accept without playing; W7 Accept on files being fixed | fixes session; W6 needs the Owner's choice first |
| Low | W8 pick-one reasons look like ticks; W9 way back mid-page on phones | fixes session |
