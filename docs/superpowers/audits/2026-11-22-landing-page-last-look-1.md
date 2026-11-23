# The landing page (/about): last look after the blind judge's fix

- Commit examined: 7c2c189 (branch claude/project-thread-2vpwcj). This audit is committed directly on 7c2c189.
- Written: 2026-11-22 16:50 UTC
- Reviewer: fresh session, Opus 5.5, medium (Settings, design review round 3 / last look).
- What ran: the 28 pictures in /mnt/project-files/design-loop/landing-page/last-look-7c2c189/ (/about signed out, signed in and top screen, and /join, /sign-in, /me, /help, at 320, 375, 810 and 1280 wide, shot at 2x), read one by one and measured from the pixels with a script (numbers are CSS pixels, half the picture's). Each picture was compared pixel by pixel with round 2's (round-2-adde553, which stands for f2f06ca). The diff 90fa5b7..7c2c189 (`look.css`, `about/+page.svelte`, `about/+page.server.ts`, `look.test.ts`, `progress.md`) was read. Judged against the fix brief in `docs/superpowers/audits/2026-11-22-landing-page-blind-judge-1.md` (90fa5b7), round 2's passes (`2026-11-22-landing-page-design-round-2.md`) and the owner's rules (frosted glass for anything see-through, an app feel at all times, no browser-default controls).
- What did not run: the app, the tests, the /about journey and CI (no pull request is open for this branch yet; criterion 6's journey half is for CI). Anything that moves (spinners, focus, a held finger) and how the stills paint on a real iPhone cannot be seen in Chromium stills. No code changed.
- Verdict: **7c2c189 PASS**. All six criteria met (criterion 6 for the last-look half; the journey is CI's). No regression against round 2. 6 notes, none blocking.

## The fix brief's criteria

| | Criterion | Result | Evidence |
| --- | --- | --- | --- |
| 1 | Full-width bands, touching bands never share a background, body text 4.5:1 or more | PASS | Five bands after the pitch cards at every size, edge to edge (column x=2 of each picture): Dusky Green #004f46, felt #112f2c, #004f46, #112f2c, #004f46, then the closing cards on felt. Computer: 1419-1906, 1908-2234, 2234-2736, 2737-3238, 3239-3742. No two touching bands match. White on #004f46 9.52:1, sage (#b4cdc2, "For makers", tax note) on #004f46 5.64:1; on felt 14.32:1 and 8.49:1. |
| 2 | Padding at least 96 (1280, 810) and 64 (375, 320) | PASS | Measured first and last non-background row in each band. Computer: 100/96, 98/100, 96/96, 96/96, 96/96. Tablet: 99/96, 98/100, 100/100, 100/100, 100/100. Phone: 68/64, 66/68, 64/68, 64/68, 64/68. 320: 67/64, 66/68, 64/68, 64/67, 64/68. |
| 3 | Price and How it works at the hero's width | PASS | Computer: hero x=64-1215; price band x=64-1216 (four panels in a row); steps x=64-1124 (three columns from x=64). Tablet: hero 16-793; price 16-794 (two by two); steps 16-784 (three columns). Phone and 320: one column at the gutters, as the hero. |
| 4 | One existing-asset picture per maker/player section, beside at 810+, above at 375 and under | PASS | "Bring your fans", "Safe to play" and "Makers' pay, in the open" each carry one still of Floor Fifty's wide clip, on the right at 810 and 1280 (computer x=664-1216, words x=64-616), above the words at 375 and 320. Stills come from the feed's clips (`+page.server.ts`); no new image file and no new dependency (`package.json` untouched). |
| 5 | Nothing else moves | PASS | Pixel compare with round 2. Top (header, hero, pitch cards): the only differing pixels are inside the hero clip's frame (a playing video; computer x=848-1209, y=262-1369 is the clip box) and, at 320, 40 anti-aliased pixels at a wrapped button's edge. Bottom (closing cards, foot): identical except the foot's second and third link rows, which sit 1 CSS px lower than in round 2. The foot's CSS is unchanged in the diff (`.about .sitefoot { margin-inline: auto }` kept); the shift is sub-pixel rounding from the new page height. See N4. |
| 6 | The last look runs again at the four sizes | PASS (this audit) | Journey: not run here; CI checks it on the pull request. |

## Round 2's passes, checked again

| Check | Result | Evidence |
| --- | --- | --- |
| Centred column (D1) | PASS, superseded on purpose | Criterion 3 widens price and steps to the hero's width; the three still sections fill both halves. No half of the window is left empty at 810 or 1280. Foot links still centred (computer x=472-808). |
| You tap gaps (D2) | PASS | /me pictures differ from round 2 only in the test phone numbers (each shoot's own account); layout identical. |
| 320 wraps (D3, D5, D6) | PASS | about-320: "Sign in" row, makers card title in two lines and centred wrapped buttons unchanged (pixel compare). New headings wrap cleanly: "How Ruken / works", "Makers' pay, / in the open". |
| Contrast 4.5:1 or more | PASS | See criterion 1; the closing cards and pitch cards are unchanged. |
| 48 px buttons | PASS | "Join Ruken" in the price band: outline rows 648 and 695 on phone, 48 tall. Others unchanged. |
| No sideways scroll | PASS | Every picture is exactly its window wide (640, 750, 1620, 2560 at 2x). The bands reach the edges with an outline cut by `clip-path`, which adds no scroll width. |
| /join, /sign-in, /help | PASS | Pixel-identical to round 2 at all four sizes. |

## Owner rules

- Frosted glass: nothing new is see-through. The bands, panels and still frames are opaque.
- App feel and no browser defaults: the stills are `<video>` with no `controls`, muted, `tabindex="-1"`, so no browser player shows; they wear the `loads` spinner, which clears on `loadeddata`, `suspend`, `error` or `stalled`, so it cannot hang.
- No "Loading..." text anywhere on the page.

## Notes (ideas, not defects)

- N1. With one live game, all three stills are Floor Fifty. "Safe to play" (7 s in) and "Makers' pay" (11 s in) look almost the same: both "08 / 20", the same skyline and sun. It reads as one picture repeated. More live games fix it by themselves (the code takes the next game in the feed for each); a later step could pick moments further apart.
- N2. "Bring your fans" is about the maker's page, but shows a game still. The brief allows either; a shot of a maker page would match the words better.
- N3. Tablet: the three steps side by side leave each column about 240 px, so the titles wrap ("Makers send their / games", "A person checks each / one") and step 1 runs five lines. Two lines of title in a three-up row is fine to read, but one column, as on the phone, or two-and-one would read easier there.
- N4. Criterion 5 says pixel-identical; the foot's lower two link rows sit 1 CSS px lower than round 2 at 1280. It is rounding, not a style change (see the table), and no one can see it; recorded so nobody reads "identical" as literal.
- N5. The stills are videos at `preload="metadata"` with a `#t=` time. Chromium paints that frame; iPhone Safari is known to show nothing until a video is played or more of it is loaded, which would leave a dark box with no picture. These shots cannot show it. The slice-end walk on the small-phone profile, or on a real iPhone under its permission, should look at it. If it is blank there, a poster image from the clip fixes it.
- N6. Each still loads its clip's start to find the frame: three more video requests on /about. Small, but a poster image (N5) would also save them.

## Every picture

- about-320, about-signed-in-320, about-top-320: clean. Bands, padding and stills above the words as the brief says.
- about-phone, about-signed-in-phone, about-top-phone: clean.
- about-tablet, about-signed-in-tablet, about-top-tablet: clean; N3.
- about-computer, about-signed-in-computer, about-top-computer: clean; N1, N2, N4.
- join, sign-in, help (all sizes): identical to round 2.
- me (all sizes): identical to round 2 except the test phone numbers.
