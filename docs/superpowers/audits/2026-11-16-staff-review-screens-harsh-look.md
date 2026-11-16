# Staff review screens: the harsh last look (visual review, step 4)

2026-11-16, slice 2, S Task 30, PR #138, branch `claude/project-thread-twy73v` at `ef3b1e4`. This look only finds
problems. Nothing but this report was changed. The fixes go to one more fix session (Sonnet, high), and every finding is
fixed, the low ones too. None of them needs the Owner's choice.

**The short of it.** The walk's and the design check's fixes hold: staff can reach the list from home, Your account and
the bar; an old link lands on the list with a word; a decision says what it did; the blue button stays in view on every
view; nothing scrolls sideways, nothing is cut off and nothing to press is under 44x44. What is left is mostly about the
18+ question and how a refusal looks: 5 medium, 6 low.

## What was looked at, and how

Only the new, not yet approved screens: the list of games to check (`/admin/games`), the page for checking one game
(`/admin/games/[game]`), the "Games to check" doors on home, Your account and the staff bar, and the error page inside
`/admin`. The maker's screens were approved before and were not looked at.

The app ran in this container from the branch's own build (`wrangler dev` with the game gate, CI's stand-ins for GitHub,
mail and Stripe, and a local Postgres), driven in Chromium by a script that used the journeys' own helpers: one game sent
through the maker's real screens (`submitGame`), so its frame plays Tiny game; others written into the database
(`makerWithGameWhere`, `putGameWhereStaffLeaveIt`, `changeGame`); a staff member from `signInAsStaff`. The script was
not committed. Each screen was shot as it opens in the window and as a whole page, and measured for sideways scrolling,
anything cut off, anything to press under 44x44 and where the blue button is, on ten views:

- iPhone SE, 320x568 and 568x320;
- Pixel 7, 412x839 and 863x360;
- iPhone 15 Pro Max, 430x739 and 814x380;
- iPad (gen 7), 810x1080 and 1080x810;
- computers, 1280x720 and 1440x900.

The screens, 20 in all: the empty list; the list with a game, an update, a game whose files are being fixed and one that
needs a keyboard; the list after Accept, after Send back and after opening an old link; home and Your account for staff
and for a member who isn't; the check page as it opens and scrolled to its end; after Accept with nothing played ("Accept
it anyway?"); with One line ticked; Send back with no reason; "Something else" with no line; 18+ with no marks (and the
"Accept it anyway?" before it); files being fixed; an update to a live game; a game that needs a keyboard; a game that
isn't there, as staff and as a member who isn't staff.

The 410 pictures and the measurements are in the project folder, `review-screens/harsh-look-2026-11-16/`, one folder
per screen, named by view (`se.jpg` is the whole page, `se-window.jpg` what the window shows, `se-end.jpg` the end of the
page).

Not run: WebKit (Safari's engine; this container has only Chromium), a real iPad or phone, the play-time line moving
while staff play (the stand-in game sends no beats; walk W5's fix was read, not seen), and a long queue. No tests were
run (CI only). Graphify was asked where `decisionWords` is defined; its index is built from `main` (`b234290`), which
doesn't have these screens, so it found nothing, and the branch's files were read directly.

## Medium

**HL1. "Choose at least one, or None of these." shows above the ages, not at the question it is about.** 18+ picked and
no marks, then Accept. The refusal shows inside "Who it's for", above "The maker picked 12+. Pick who it's for." and the
five ages, and the page opens there. The question it answers, "Does Tiny game have any of these?", is below the ages: on
the iPhone SE it is off the window (the window ends at "Or send it back, and the maker will choose again."), and on every
view it is under the line about ages. So a tired person reads "Choose at least one" as about the ages, which are pick-one,
and "None of these" names a choice they can't see. Seen on all ten views (`check-18-no-marks/*-window.jpg`).
Fix: show the words right above the four marks, under their question, open the page there, and name it in the words:
"Pick what Tiny game has, or None of these."

**HL2. With 18+ picked, the age's "This is wrong" box reads as a fifth mark.** In "Who it's for" the order is: the ages,
"Or send it back, and the maker will choose again.", the marks question, its four choices, then "This is wrong". The
line that explains the box is now a question away from it, and the box sits straight under "None of these" in the same
shape, so it looks like one more answer to "Does Tiny game have any of these?". All views
(`check-18-no-marks/pc1440-window.jpg` shows it best).
Fix: keep "Or send it back, and the maker will choose again." and its box together, after the marks.

**HL3. A refusal inside a part looks like the part's own words, and the part's name is just off the window.** After Send
back with no reason, "Pick a reason for One line." is set in the sheet's ink, a little bolder, with no edge or mark, and
sits between the part's name and its value, where a value is expected. The page opens at the part with its name
("One line") just above the window, so the first thing in view is the refusal and then "Climb. Fall. Climb again.",
which reads as one block. Same for "Say what's wrong with One line, in your own words." and HL1's line. All views
(`check-no-reason/*-window.jpg`, `check-no-line/*-window.jpg`).
Fix: give the refusal inside a part the look's own "needs fixing" treatment (the edge `.sheet.fix` uses), and open the
page so the part's name is in view.

**HL4. 18+ with no marks on a game nobody played is refused twice in a row.** The first Accept asks "You haven't played
Tiny game. Accept it anyway?". Staff press "Accept it anyway", and only then are told "Choose at least one, or None of
these.". So they say yes to a question, and are refused for something that was wrong before they were asked. All views
(`check-18-anyway`, then `check-18-no-marks`).
Fix: check the marks (and any ticked part's reason) before asking "Accept it anyway?", so the question comes only when
the press would go through.

**HL5. On the iPhone SE the staff bar breaks onto two lines.** At 320 wide, "Ruken" and "Games to check" share the first
line and "Your account" drops alone onto a second, at the left, under the wordmark. It looks broken and costs about 50px
of a 568px window, on the list and on the check page (`list/se-window.jpg`, `check/se-window.jpg`). The maker's bar has
two items and fits; this one has three.
Fix: let the three fit on one line at 320 (a smaller gap or text size in the bar on the smallest phones), or keep the
second line as a right-aligned row that reads as part of the bar.

## Low

**HL6. The line above a game's name still breaks at the email's hyphen, and lines start with a dot.** On the iPhone SE
list and check page, "journey+16f0e60e-" and "8cf@ruken.test" are two lines, and the next line is "· Waiting 1 minute".
On a 1440x900 computer the check page's update reads "Update to a live game · journey+…@ruken.test" then
"· Waiting 3 minutes" (`check-update/pc1440.jpg`); on the Pixel 7 list each card ends a line with "·". The design check's
L1 fix keeps "Waiting 3 hours" whole, but not the dot with it, and a real email with a hyphen still breaks there.
Fix: keep each dot with the words after it, and on a narrow window give the email its own line, so it only breaks when it
can't fit even there.

**HL7. On a computer and an iPad held sideways, "Back to games to check" is below the window when the page opens.** The
left half is made to fit the window, but the bar above it is not counted, so at 1440x900 the half ends below the window:
"You haven't played it yet." is at 886px and the way back under it is cut off; on the iPad sideways the played line is at
about 792px of 810. It comes into view once the sheet is scrolled (`check/pc1440-window.jpg`, `check/ipad-side-window.jpg`).
Fix: count the bar in the left half's height, so the whole half fits when the page opens.

**HL8. "Full size" touches the bottom of the game's frame.** On every view it sits flush under the frame, with no space,
so it reads as a caption on the game rather than a button. Fix: the same step under the frame as the one above it.

**HL9. On a computer the list's bar doesn't line up with the list, and the wordmark jumps between the two staff pages.**
At 1440x900 the list's bar runs from 40px to 1400px while the list is 340px to 1100px; on the check page the bar lines up
with the page, from 120px. Going from the list to a game moves "Ruken" and "Your account" 80px
(`list/pc1440.jpg`, `check/pc1440-window.jpg`). Fix: the check page's bar rule on the list too.

**HL10. The error page inside `/admin` has no wordmark.** The site's layout leaves out its "Ruken" header on `/admin`
pages, because the staff bar has one, but the error page is drawn outside the staff bar, so "We can't find that page."
there has nothing above it, as staff and as a member who isn't staff (`error-staff`, `error-not-staff`). Every error page
outside the staff and maker areas has "Ruken" on top. On the iPhone SE the blue button also breaks as "Back to games to" /
"check". Fix: show the wordmark on the error page inside `/admin`.

**HL11. On Your account, "Games to check" sits right on "Delete my account".** The staff link is body size with only a
small step above "Delete my account", so the two read as one group, and the way to delete the account is now the next
thing under a door staff use every day. On the iPhone SE it is also below the first window (`me-staff/se.jpg`,
`me-staff/ipad.jpg`). Fix: put "Games to check" with "Your games" or "Add yours to Ruken." and leave a clear step
before "Delete my account".

## Not findings

- Nothing scrolls sideways, nothing is cut off and nothing to press is under 44x44 on any of the 20 screens on any view
  (measured).
- The blue button is in view on every view as the page opens and at its end: in the bar on phones and an upright iPad,
  beside the sheet on an iPad sideways (224 to 284px at the end) and computers (308 to 368px).
- The doors are there: "Games to check" on home, Your account and the staff bar, only for staff. A member who isn't staff
  sees none of them, and `/admin/games` is "We can't find that page." with "Back to Ruken".
- After Accept the list says "Tiny game is live."; after Send back "Tiny game was sent back. Its maker can see why."; an
  old link lands on the list with "Tiny game isn't waiting for a check any more.". A reload shows the plain list.
- A refusal names its part, says so inside the part, and opens the page at it (apart from HL1's case and HL3's look).
- A game whose files are being fixed offers only a blue "Send back" and says why, with "You can still send it back."
- An update to a live game says on each part it can't be sent back for that it's already live.
- "Pick one." stands above each part's reasons.
- The error page inside `/admin` offers "Back to games to check" to staff.
- Every page here is 48px taller than the window when its content is short (home, Your account and the error page on
  every view, also for a member who isn't staff). That comes from the site's layout, not from these screens, and was
  not looked into.

## Summary

| | Findings | For |
|---|---|---|
| Medium | HL1 marks refusal above the ages; HL2 age box reads as a mark; HL3 refusal in a part looks like its words; HL4 refused twice; HL5 bar on two lines at 320 | fixes session |
| Low | HL6 dot and hyphen breaks; HL7 way back below the window; HL8 Full size touches the frame; HL9 list bar not aligned; HL10 no wordmark on the staff error page; HL11 staff door on top of Delete my account | fixes session |
