# Slice 2 design review, round 2

- Commit examined: `main` at `f7c666d` (round 1's fixes from #253 included), built fresh in a cloud container (Node 24, Postgres 16, the four stand-ins and the game gate, started as `playwright.config.ts` starts them). Written 2026-11-21 05:23 UTC by a fresh session that did not build slice 2 and did not run round 1.
- Step: `visual-check` step 3 for round 2, the words-and-design check again on every slice 2 screen at the three sizes in Settings.
- How: the repo's slice 2 browser journeys (`make-*`, `take-off`, `game-page`, `play*`, `player-count`, `connect-github`, `game-gate`, `review-job`, `decision-day-job`, `error-page`, `buttons`) ran with a local, uncommitted patch that saved a picture before every tap, fill and page load, and at the end of each journey. Phone is the repo's `phone` project (iPhone SE, 375 by 667) run in Chromium, tablet is `tablet` (iPad, 810 by 1080), computer is `computer` (1280 by 720); journeys that set their own window (sideways phone and tablet, the old 320-wide iPhone SE) were shot at that window. 9,982 pictures. Pictures that were the same screen were grouped by a program (pixel difference under 0.8 of 255 on a 48-wide copy), leaving 307 phone, 208 tablet and 189 computer screens, and every one of those was looked at one by one. Full-page pictures were opened where the first view cut something off. The pictures and the patch are not kept.
- The journeys themselves: computer 285 passed, 62 skipped (written for other sizes), none failed. Phone and tablet ran 694 journeys with no failure before the run hit its 30-minute limit during the computer part, which was then run again on its own.
- Measured by a program on phone and tablet (Your games, a question, the files, both videos, the age, the websites, Check and send, throw away, Waiting, Sent back, Live and take off): no text under 14 px, no press target under 44 px, no text under 4.5 to 1 against a plain background. The same program could not finish on computer (the stand-in sign-up refused it for too many tries), so on computer press targets rest on the journey's own check, which passed (`make-look.test.ts` "everything to press is at least 44 by 44"), and text size and contrast on computer were judged by eye only. The Live backdrop was not measured again; round 1 measured it at 4.74 to 1 and nothing on it changed.
- Result at `f7c666d`: **2 red**, 3 notes. Round 1's six fixes still hold at all three sizes. Round 1's ten notes were not raised again.

## Red findings

### 1. On a phone a website box is too narrow for the hint's own example

- UNIT: the other websites question (`/make/<game>/websites`), phone (375 wide).
- VERDICT: red.
- REQUIREMENT: layout and polish; plain words and nothing that needs explaining (`visual-check` step 1). The answer box is where she checks what she typed.
- REASON: each line puts the box and a full-size "Remove" button side by side, and the box gets what the button leaves: about 205 of the 335 px, at 24 px type.
- EVIDENCE: journey "each website is its own line…", phone. With "api.example.com" typed, the box shows "i.example.com" while it has focus and "api.example.co" without it; "cdn.example.com" is cut the same way. "api.example.com" is the example the hint under the box gives. Tablet and computer show the whole address.
- EXPECTED: on a 375-wide phone, "api.example.com" shows whole in its box, with and without focus, and Remove is still 44 px or more.
- FIX: give the box the line on a phone: a narrower Remove (a shorter word or less padding) or Remove under the box, below 500 wide only. Files: the `.line` rules in `src/lib/look.css` (or `src/routes/make/parts/WebsiteLines.svelte`), and one phone check in an existing journey (for example `make-questions.test.ts` "each website is its own line") that a 15-letter address fits its box.

### 2. On a wide window "I agree" is below the fold

- UNIT: the maker agreement (`/make/<game>/agreement`), computer (1280 by 720) and tablet held sideways (1080 by 810).
- VERDICT: red.
- REQUIREMENT: `visual-check` step 1: each screen has one main action visible without scrolling. The spec, `specs/2026-11-14-maker-screens-redesign-design.md` section 4.2 ("The button is always in view; the sheet scrolls inside itself if it must") and 5a note 2 ("where the window is too short for all seven, the sheet scrolls inside itself and 'I agree' stays in view on the left").
- REASON: the buttons were moved under the seventh point (comment in `agreement/+page.svelte` line 40, and the check "on a wide window the agreement's buttons are after the last point, not beside the first", marked L23, in `tests/browser/make-second-look.test.ts` line 360). That was a review's call; no owner decision for it is recorded in the spec, `history.md` or `progress.md`.
- EVIDENCE: at 1280 by 720 the first view shows "Almost done", "Maker agreement", the version line, "Back to the last question" and points 1 to 5; there is no "I agree" and no blue button anywhere in view. The same on a sideways iPad. A person must scroll the whole page past seven points to find what to press.
- EXPECTED: at 1280 by 720 and 1080 by 810 "I agree" (and Back) is in the first view without scrolling, and the seven points can still all be read.
- FIX: put the buttons back in the left half under the heading, as the spec draws it, with the sheet scrolling inside itself on a short window; or keep them under the points and make the sheet scroll inside itself so the buttons sit at the window's foot. Either way, change the L23 check openly in the same pull request (it asserts the opposite) and say so in the pull request body. Files: `src/routes/make/[game]/agreement/+page.svelte`, the `.halves` rules in `src/lib/look.css`, `tests/browser/make-second-look.test.ts`. Phone and upright tablet keep their bottom bar.

## Notes (not defects, kept apart)

1. The game page's Share, where the browser cannot share, says "Copy the address from the bar at the top." On an iPhone Safari's address bar is at the bottom by default.
2. On an upright tablet the question screens put Back and the blue button in a bar fixed to the bottom of the window and start the question at the top. The spec, section 4.4, says a tablet has its buttons under the answer and an upright tablet's column is centred both ways. The code names the bar as deliberate (`src/lib/look.css` around line 1088, "for a phone and a tablet held upright"), and `tests/browser/make-look.test.ts` checks it, so it is left as a named difference for the owner to see on the screens page.
3. The fix for a sent-back upright video (Sent back, Fix the upright video) opens the video question with no counter and no "Finish later", as Change does elsewhere. It reads fine; noted only because it differs from the run of questions.

## Not covered

- The home page ("Coming soon") is parked slice 3 work and was left out, as asked. The maker's page (`/<handle>`) and "More from" on the game page belong to slice 3 and were only seen in passing.
- Safari's engine was not shot: the container has no WebKit, so the phone ran in Chromium at the iPhone SE size. CI runs the phone in WebKit.
- Some journeys use a 1 KB stand-in clip, which shows as a flat sage box.
- Sign-up, sign-in, Your account, Join and the payment pages are slice 1 and were dropped from the pictures.
