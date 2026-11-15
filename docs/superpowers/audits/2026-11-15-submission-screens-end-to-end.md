# Submission screens: the end-to-end walk (visual review, step 3)

2026-11-15, branch `slice-2/submit` (pull request #63), read at `75b4af0` and checked again at `59a69eb` (the design-pass fixes), which changes none of the findings. This walk only finds. Nothing but this report was changed.

It walks every journey the maker's submission screens are part of, from first opening Ruken to a game sent for review and then live, with every way it can go wrong: a refused answer, GitHub trouble, sent back, Send it again, a new version while one waits, the agreement and the record-your-screen how-to. It looks for a step with no way on or back, a missing piece, or a next step that would confuse. Looks belong to the design pass (`2026-11-15-submission-screens-design-pass.md`), and nothing here repeats it or the task walk (`2026-11-15-maker-screens-rebuild-task-walk.md`, W1 to W17) or the screen review (F1 to F21).

**The short of it.** A first game can be sent, and most failure paths lead somewhere. Four things stop a maker cold: changing a waiting or sent-back game to 18+ breaks the page (E1); GitHub saying "empty" or "busy" breaks the files question (E2); a maker who signs in, or meets any error, lands on a home page with nothing to press (E3); and one live-game path leaves "Send it again" refused with no way to fix it (E4). 17 findings: 4 must, 8 should, 5 small.

## What was looked at, and what was not

- **Read:** every route under `src/routes/make/`, the two how-tos, `/legal/maker-agreement`, sign-in, sign-up, password reset, `/me`, home and the error page; the games service (`service.ts`, `pull.ts`, `github.ts`, `questions.ts`, `review.ts`, `clips.ts`), the agreement feature and the database checks in `prisma/migrations/20261115110000_one_answer_at_a_time`. Each journey below was followed press by press through the code.
- **Not run.** No test, lint or typecheck, and the app was not started (the design pass ran it and took the pictures). So every finding is read from the code, and says where it would show. Where a finding depends on what GitHub answers, it says so.
- **Not walkable on this branch.** Staff's yes and no (branch S) and a game's page for players, `/g/<game>` (branch F), are not built. Sent back and Live are reached only by tests writing the state in. Those parts of the journeys are judged from the maker's side only.
- The design-pass fixes (`59a69eb`) were read for what they change in these journeys: the Live screen's note, the how-to's device links and the video links. None of them touches a finding.

## The journeys walked

1. **First open to Your games**: home, sign up or sign in (and forgot password), Your account, Your games.
2. **A first game to Waiting**: name, line, files (connect, choose on GitHub, pick, copy refused, Pick another, branch or folder), where it plays, two videos (with the how-to, refused file, too big), who it's for, the 18+ question, the agreement, Check and send with its Changes, the websites question, Send for review.
3. **While it waits**: Change something, change a part, send newer files, Finish later.
4. **Sent back**: each kind of fix card, fixing, Send it again, a refusal on send.
5. **Live**: See it on Ruken, change the name or line, Send a new version, a new version while one waits, an update sent back and fixed, Send it again.
6. **Throw a draft away**, and **a second game** (no agreement, no GitHub step).

## Must fix

**E1. Changing a waiting or sent-back game to 18+ breaks the page.**
Journey 3 or 4. Step: Waiting, then "Change something", then the "12+" chip, then "18+" and Save. Or Sent back for its rating, then "Fix who it's for", then "18+".
`saveAnswer` writes the rating as `age_18` and leaves the marks empty (a younger game has none). The database's `Game_answered_check` refuses an 18+ game in `waiting` or `sent_back` with no marks, so the write fails with a database error, which the route does not catch: the maker gets "Something went wrong on our side." On a draft the same change works, because a draft is not checked and the next look leads to question 8. No test covers a waiting or sent-back game changing its rating.
Fix: when a game that is past its first run is made 18+, lead to question 8 before anything is saved (or save the rating and the marks together, from one screen that asks both). Add a journey for each of the two states.

**E2. GitHub saying "empty" or "busy" breaks the files question.**
Journey 2. Step: question 3, pick a game, Next ("Copying your game…").
`commitOf` turns only GitHub's 404 and 422 into words; every other answer is thrown as a plain error, which is a 500. Two of them are likely for a first-timer: a repository she made but has not uploaded to yet (the GitHub how-to's step 2 before step 3; GitHub answers an empty repository with 409, from GitHub's own behaviour, not tried here), and GitHub being slow or limiting how often Ruken asks (5xx, 403 or 429). The same holds for the copy started by Save on the websites question and by "Send a new version". After the 500 the only button goes to the home page (E3).
Fix: an empty repository is a refusal in words ("Your game on GitHub is empty. Upload your game's files, then try again.", with the how-to link); any other GitHub failure says "GitHub isn't answering right now. Try again in a minute." on the same screen, with the choice kept.

**E3. After signing in, or after any error, the maker lands on a page with nothing to press.**
Journey 1, and the end of every failure. Steps:
- Home, "Sign in", or "Create an account" from there: both carry `next=/`, so she lands on home, which signed in shows only "Games, one swipe at a time. Coming soon." There is no link to Your account or Your games. The spec's door is the line on `/me` (spec 3), but nothing leads to `/me`.
- Forgot password: the reset ends at `/sign-in?reset=1` with no `next`, so the same.
- The "Ruken" wordmark, the first thing on every maker screen, goes to that same home.
- The error page's only button, "Back to Ruken", goes there too, so E1, E2 and E5 end here.
Every journey test opens `/make` or `/me` by its address, so none sees it.
Fix: until the feed (slice 3), home signed in shows "Your account" and "Your games" (or sends a signed-in person to `/me`); the error page inside the maker's area offers "Back to your games".

**E4. A live game's update can be stuck: "Send it again" is refused and nothing fixes it.**
Journey 5. Steps: a live game has an update waiting. She presses "Send a new version" again and the copy is refused (say index.html moved). The update that waits is still the older one, and `pullProblem` is now set. Staff send that update back for its line. She fixes the line. Live now offers only "Send it again" (`liveSend` is "again"), which `sendForReview` refuses: "Your game's files need fixing first." A live game's files question is a 404, and "Send a new version" is not offered while the send is "again". Fixing GitHub does not help, because nothing copies again.
Fix: when the game's last copy was refused, Live offers "Send a new version" (it copies again) instead of "Send it again", and says why: "Your last copy from GitHub didn't work. Fix it there, then send a new version."

## Should fix

**E5. "See it on Ruken" leads to "We can't find that page."**
Journey 5. Step: Live, the blue "See it on Ruken". It links to `/g/<game>`, which arrives with branch F. Today Live is only reached by tests, but S lands before F, and from S's merge a real live game's main button is a dead end, followed by E3.
Fix: land F's page before a maker can reach Live, or hide the button until it exists; and give S's or F's journey one press of it.

**E6. GitHub taking longer than ten minutes drops her on Your games, not her question.**
Journey 2. Step: question 3, "Connect GitHub" when she has no GitHub account yet. The how-to sends her to make one, which means a sign-up, an email code and an app install. The state Ruken seals lasts ten minutes (`github-connect.ts`); after that the callback cannot read which game she was on and sends her to `/make?github=failed`: "GitHub didn't connect. Try again." above her list and "Add a game". She has to know to tap her game, which opens question 3 again.
Fix: read the game from an expired state too (it is still Ruken's own seal, and `ownGame` still checks it is hers) and send her back to her question with the "didn't connect" line; or give the seal longer (an hour); and on Your games say "Open your game to try again."

**E7. Waiting, "Change something" opens "Last step, Check it, then send" with "Send for review".**
Journey 3. The game was sent already, and a Change saves at once and goes back to Waiting, so the button has nothing new to send. A maker who changed something presses it anyway "to be sure", and it resets `pendingSince`, which puts her game at the back of staff's queue (`waitingGames` orders by it). "Finish later" also shows in the bar, though nothing is unfinished.
Fix: for a waiting game, the screen is "Change something" with "Your changes are saved. Staff see them." and a blue "Done" back to Waiting; no send, no "Finish later". The same reset happens when she presses "Send a new version" while one waits on a live game; if keeping her place matters, the replaced update keeps the old `pendingSince` (a question for the Owner only if it is not obvious).

**E8. A waiting game's copy that was refused is not shown on Waiting, and staff still see the old files.**
Journey 3. Steps: Waiting, Change, "Where are your game's files?", pick or Next, and the copy is refused. She sees the "We couldn't start your game" card. Pressing Back shows Waiting with "We're looking at it." and nothing about the files. Staff go on reviewing the older copy and can accept it, so the game goes live on files she has since changed.
Fix: Waiting shows the "Needs fixing" card and its button while the newest copy is refused; and staff's review either waits for a passing copy or says "the maker's newest copy was refused".

**E9. A game that runs on computers only still asks for an upright video, "For phones".**
Journey 2. Steps: question 4, "Computers only", then question 5: "For phones: taller than wide." Her game does not play on phones, and the record-your-screen how-to records a whole computer screen, which is wide. Nothing says why she needs it or how to make one. Ruken does not check a video's shape, so she may send a wide one in its place, and the feed shows it squashed or cropped (not seen).
Fix: for a computers-only game, the hint says "Phone players see this in the feed, even if your game is for computers." and the how-to's Mac and Windows parts say how to record a part of the screen that's taller than wide (the Mac's "Record Selected Portion").

**E10. A video over 30 MB is refused with "Make it shorter or smaller" and no help.**
Journey 2. Step: question 5 or 6, choose a 30-second screen recording. A phone or a Mac recording its whole screen at full size can pass 30 MB in 30 seconds (not measured here). The refusal ends "Make it shorter or smaller, then choose it again." and the how-to says only "Keep it to 10 to 30 seconds". She does not know how to make a video smaller.
Fix: the how-to gets a short "Too big?" part: cut it in Photos (iPhone, Android: Edit, then drag the ends) or QuickTime (Mac: Edit, Trim); the refusal links to it. The refusal for a file that isn't a video still says "Save it as MP4 or WebM", though MOV is now taken: "MP4, WebM or MOV".

**E11. After fixing what was sent back, Your games hides the next step.**
Journeys 4 and 5. Steps: fix every card, then "Back to your games".
- A live game: `listWords` says "Live" once nothing is left to fix, so the update she fixed but has not sent again looks finished.
- A game sent back: the list still says "Sent back. See what to fix." with nothing left to fix.
Fix: both say "Fixed. Send it again." until she does.

**E12. Changing "Other websites" copies the newest files from GitHub without saying so.**
Journeys 2 and 3. Step: Check and send, the websites chip, Save. `saveAnswer` runs `pullLatest` for the websites, so a game waiting for review now waits with whatever is on GitHub today, which she did not choose to send. If that copy is refused, the files refusal shows under the websites box, where "Pick another" is not; a GitHub failure there is E2's 500.
Fix: record the websites on the copy staff already have without copying again; or say on the websites question "Saving copies your game from GitHub again."

## Small

**E13. While a never-live game waits, the way to send newer files is hidden.** The Owner decided a newer version replaces the waiting one. On Live that is "Send a new version". On Waiting it is "Change something", then the files chip, then Next on the same repository, and no screen says so. Fix: Waiting gets "Send a new version" with the same note as Live, or the files question when changed says "Next copies your game from GitHub again."

**E14. The agreement promises things these screens can't do yet.** Point 1, "You can take your game off Ruken yourself at any time": no screen does (the spec's M1, later). Point 7, "we'll … ask you to agree again": `hasAgreed` counts any version, so a maker who agreed to version 1 is never shown version 2 (test-site makers only today). Fix: `hasAgreed` checks the current version; and the Owner is told point 1 has no button until M1 is built (or the take-off button is pulled forward).

**E15. Once agreed, the agreement can't be found again.** `/legal/maker-agreement` is linked from nowhere. Fix: a link on Your games or Your account, "The maker agreement".

**E16. Your account's door reads "Add yours to Ruken." for a maker who has games.** It is her only way back to Your games from `/me`. Fix: "Your games" when she has any.

**E17. "We couldn't find that branch on GitHub." when she typed no branch.** A 404 on `HEAD` (a repository renamed or gone since she connected) gets the branch words, under the list. Fix: with no branch typed, "We can't find that game on GitHub any more. Choose it on GitHub again."

## Not seen, worth one real-device try

- On a phone with the GitHub app installed, "Connect GitHub" may open in the app and come back in a browser without Ruken's sign-in, so she would meet "Sign in" in the middle (the `next` keeps her place if she does). Real-device tests are the Owner's.
- Whether a video recorded on an iPhone plays in Chromium and Firefox once sent (the design pass saw stills only).

## Summary

| | Findings | For |
|---|---|---|
| Must fix | E1 18+ on a waiting or sent-back game; E2 GitHub empty or busy; E3 no way on from home or the error page; E4 live "Send it again" stuck | fixes session |
| Should fix | E5 "See it on Ruken" 404; E6 GitHub over ten minutes; E7 Waiting's "Send for review"; E8 refused copy hidden while waiting; E9 upright video for a computers-only game; E10 too-big video; E11 Your games after fixing; E12 websites re-copy | fixes session (E5 is about when F lands, for the coordinator) |
| Small | E13 to E17 | fixes session; E14's point 1 for the Owner |
