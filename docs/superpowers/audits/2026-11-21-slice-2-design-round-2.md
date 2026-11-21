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

## Fix check

- Commit examined: `f10d63b` on pull request #255 (the fixes are in `5e875f0`), built fresh the same way. Checked 2026-11-21 06:00 UTC by the same reviewer session.
- How: a local, uncommitted journey typed "api.example.com" and "cdn.example.com" into two website boxes and opened the agreement, at the three sizes and at 667 by 375, 1080 by 810, 1366 by 1024, 1280 by 720 and 1440 by 900. It measured each box's text width against its inside width, and where "I agree" and Back sit against the window. The builder's changed checks (`each website is its own line…`, the agreement checks in `make-second-look.test.ts`) ran beside it: 9 passed, none failed. Chromium only.

| Red | Verdict | What was seen at `f10d63b` |
|---|---|---|
| 1 | **still red** | On the 375-wide phone "api.example.com" now just fits (text 189 px in a 189 px inside width, nothing to spare), but "cdn.example.com" does not: 196 px of text in 189 px, shown as "cdn.example.com" cut at the "m" without focus and as "dn.example.com" with it. The new check types only "api.example.com", so it passes. Remove is 98 by 64. |
| 2 | fixed | At 1280 by 720 "I agree" ends at 696 px of 720, and at 1080 by 810 at 782 of 810, with Back beside it; the seven points scroll inside the sheet (1123 px in 500 on the computer) and the last point is reachable. At 1440 by 900 and 1366 by 1024 the same. The page itself scrolls 8 px at 1280 by 720, which moves nothing out of view. Phone, sideways phone and upright tablet keep their bottom bar with "I agree" in it. |

- FIX for red 1, bounded: on a phone also take padding off the box's sides (`.screen .line > .answer { padding-inline: 0.75rem }` below 500 wide gives back 16 px), and have the phone check type "cdn.example.com" as well as "api.example.com". Files: `src/lib/look.css`, `tests/browser/make-questions.test.ts`.

## Second fix check

- Commit examined: `e0d4e8f` on pull request #255, built fresh the same way. Checked 2026-11-21 08:53 UTC by the same reviewer session.
- How: the same kind of local, uncommitted journey typed "api.example.com" and "cdn.example.com" into two website boxes. It measured each box with and without focus at 375 by 667, 320 by 568, 667 by 375, 810 by 1080, 1080 by 810 and 1280 by 720, and took a picture at each size. The builder's changed checks (`each website is its own line…` and the agreement checks in `make-second-look.test.ts`) ran in all three projects: 6 passed, none failed. Chromium only.

| Red | Verdict | What was seen at `e0d4e8f` |
|---|---|---|
| 1 | fixed | On the 375-wide phone both addresses show whole, with and without focus. The box is 205 px wide with 12 px padding, its scroll width equals its width, and with focus it does not scroll (scroll left 0). The picture shows "api.example.com" and "cdn.example.com" whole. Remove is 98 by 64. The phone check now types both addresses, with and without focus. Tablet, computer and the sideways phone show both whole too. |
| 2 | still fixed | Nothing on the agreement changed after `f10d63b`: the new CSS is only `.screen .line > .answer` below 500 wide. The agreement checks passed again. |

- New note, not a red: on the old 320-wide iPhone SE both addresses are still cut ("api.example.c", "cdn.example.") in a 150 px box. Round 2's red and its EXPECTED named the 375-wide phone, which is the small phone in Settings, so this is left for the owner to see.
