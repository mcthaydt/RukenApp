# Slice 2 design review, round 3

- Commit examined: `main` at `583661f` (round 2's fixes from #255 included), built fresh in a cloud container (Node 24, Postgres 16, the stand-ins and the game gate, started as `playwright.config.ts` starts them). Written 2026-11-21 09:49 UTC by a fresh session that did not build slice 2 and did not run rounds 1 or 2.
- Step: `visual-check` step 3 for round 3, the last look on every slice 2 screen at the three sizes in Settings, plus a recheck of rounds 1 and 2's fixes and open notes.
- How: all browser journeys ran with a local, uncommitted patch that saved a picture before every tap, fill and page load and at the end of each journey, and a program measured each page as it was shot. A second local journey, also uncommitted, typed two website addresses and opened every maker question, the agreement, Check and send, Your games and the game's own page at 320 by 568 (the old iPhone SE), 667 by 375 (an iPhone SE held sideways) and 1080 by 810 (an iPad held sideways). Phone is the repo's `phone` project (iPhone SE, 375 by 667) run in Chromium, tablet is `tablet` (iPad, 810 by 1080), computer is `computer` (1280 by 720). 902 journeys passed, 148 skipped (written for other sizes), none failed. 13,685 pictures, grouped by a program into 385 phone, 204 tablet and 196 computer screens, laid out four to a sheet on 195 sheets. The reviewer looked at sheets 1 to 29 (phone) itself. Five read-only helpers (Haiku 5.5) each looked at every tile of their share of the other 166, and the reviewer opened the full-size picture of every tile a helper flagged before judging it. The pictures and the patches are deleted.
- Measured by a program on all three sizes (2,898 page measures): no text under 14 px and no sideways scroll on any slice 2 screen; no text under 4.5 to 1 against a plain background; no press target under 44 px on slice 2 screens apart from round 1's known Join link. One target on a slice 3 part measured 43 by 48 (below).
- Result at `583661f`: **0 red**, 9 notes. Round 1's six fixes and round 2's two fixes still hold. Round 2's open note on the 320-wide phone still stands, measured below.

## Red findings

None.

## Round 2's fixes, checked again

1. Website box on a 375 phone: two addresses typed, both show whole, with Remove beside them (journey "each website is its own line…", phone).
2. "I agree" on a wide window: at 1280 by 720 the first view shows the heading, the sheet with points 1 to 4 scrolling inside itself, and Back and "I agree" under it, all without scrolling. At 1080 by 810 the same, with "I agree" fully in view. On the 375 phone, Back and "I agree" are in the bottom bar.

## Round 2's note on the 320-wide iPhone SE, measured

- At 320 by 568 both website boxes are still cut: the first box's text is 188 px wide in a 150 px box, the second 196 in 150 (scroll width against client width). At 667 by 375 and 1080 by 810 both fit. The 320 width is not in the device matrix in Settings (the small phone is the 375-wide iPhone SE), so it stays a note, as round 2 left it. If the fix should reach 320 too, the same `.line` rule in `src/lib/look.css` that round 2 changed is the place.

## Notes (not defects, kept apart)

1. **The words "GitHub", "index.html" and "repository" on maker screens.** Seen on the files question ("Don't see your game? Choose it on GitHub", "Ruken starts your game from a file called index.html. We couldn't find one…"), Live and Sent back ("Send a new version copies the newest version of your game from GitHub…"), Taken off ("Nothing changed on GitHub"), the connect step ("Your game lives on GitHub", "Connect GitHub") and the help page "Put your game on GitHub" ("repository", "Commit changes"). Games come from GitHub by the spec's design, so the name itself is the product's, and the help page explains the rest. Listed because every helper flagged it on its own; round 1's note 7 covered only branch and folder. Whether these words pass the drunk-grandma test is the owner's to judge on the screens page.
2. **Taken off, when GitHub refuses the copy** (journey "a copy GitHub refuses leaves it off…", phone): the step she must take first ("Choose it on GitHub") is a small text link, and the blue button is "Put it back on Ruken", which fails again until she has done that step.
3. **The sideways iPhone SE** (568 by 320 and 667 by 375): on the question screens the hint and "Throw this game away" start under the fixed bottom bar in the first view, and on the wide video question the hint "For computers: wider than tall. MP4, …" is cut by the bar until she scrolls. It scrolls; round 1's note 2 covered the same link on the upright phone.
4. **The count changes from "Question 6 of 6" to "7 of 7"** when the maker picks 18+, because the marks question is added. Not in rounds 1 or 2.
5. **The marks question** says "Only adults will see this game. Sex or nudity is fine here. No game may have pornography or gambling." in one run; the fine-and-not-fine lines side by side may confuse.
6. **The fix card on Sent back and Live** sets the reason in the large bold heading face, so it reads as a second heading.
7. **"Your changes are saved. Staff see them."** uses "Staff", a word Ruken does not use elsewhere for the people who check games ("A person checks every game").
8. **The game page after the full-size clip is closed** (phone): the clip's focus ring returns as it should, but the name band and the picture cover parts of it, so it shows as a broken white frame along the top and sides.
9. **The game address opened with no pass** shows the gate's plain line "This game's link has run out. Go back and press Play again." on a bare white page with no way back. The gate answers in plain text on purpose (`src/features/play/gate.ts`, "inside the game's frame under Ruken's bar"), and a person reaches it on its own only by opening a game's address directly, so it is noted, not red.

Seen in passing on slice 3 parts, for that slice's own review: on the game page's "More from" row a game with a short name ("Snek") is a 43 by 48 px link, under the 44 px floor.

## Flagged by helpers and cleared

- Blank white or one-colour tiles (about a dozen across all sizes, for example the tablet "opening a lot of games" journey): each was a picture taken mid-page-change, before a tap; the next picture of the same journey shows the finished screen with its way back.
- Raw `{"referrer":"", …}` text running off the play screen: this is the stand-in test game printing what it was given, not Ruken's screen.
- The upright video question after a wrong file: "Choose video" is the blue button in the bar, so she can pick again.
- The files question on a computer with "Change the branch or folder" open: the blue Next is below the first view only because the extra boxes are open; the page scrolls and nothing is hidden.
- The sideways-phone question column narrower than the header: deliberate, and checked by `make-look.test.ts` ("on a phone held sideways a question…").
- "Take it off Ruken" on Live and the "Taking a while" buttons: measured at or above 4.5 to 1 and 44 px.

## Not covered

- Safari's engine was not shot: the container has no WebKit, so the phone ran in Chromium at the iPhone SE size. CI runs the phone in WebKit.
- Some journeys use a 1 KB stand-in clip, which shows as a flat sage box.
- Sign-up, sign-in, Your account, Join and the payment pages are slice 1, and the home page ("Coming soon"), the maker's page and "More from" are slice 3; they were seen in passing only.
- 166 of the 195 sheets were first looked at by read-only helpers on a smaller model; the reviewer judged only what they flagged, so a problem every helper missed on those sheets would not be here.
