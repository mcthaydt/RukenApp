# Landing page blind judge, round 1

Examined: the landing page at f2f06ca (round 2 shots, taken at adde553, pixel-identical), against the reference home page captured 2026-11-22 16:26 UTC.

## Preparation

- Ours: the eight /about shots in `/mnt/project-files/design-loop/landing-page/round-2-adde553/` (`about-top-*` and `about-*`, at 320x640, 375x667, 810x1080 and 1280x800, deviceScaleFactor 2). The other screens in that round (join, sign-in, help, me) have no matching kind of page on the reference and are left out.
- Reference: the home page the owner named as the inspiration, shot with the container's Chromium and Playwright at the same four sizes and scale, first screen and whole page, after scrolling once to load its images. Its cookie notice (a legal overlay, not part of the design) was removed before the shot.
- Names and logos covered: on the reference, every text match of its name and its two partner brands became a bar in the text's own colour, the header and footer logo marks became a bar, and the images that carry the logo (a logo tile, an app screenshot, two QR codes) were blurred. Small logo stickers inside two photos could not be found by a program and remain. On ours, the 14 places "Ruken" appears were found on a running copy of the app at f2f06ca with text ranges (no change to the page), checked against a plain shot of the same run (layout matched the round 2 shots to within 1,643 of about 3.5 million pixels per size, outside the video), and painted on the round 2 shots as bars in the text's own colour.
- Labels: one random byte from the system's random source picked the order. The key is at the end of this file, written after the verdict; it was not in the judge's brief.
- Pairs given to the judge: `/mnt/project-files/blind-judge-2026-11-22/`, 48 files: each set's first screen at each width, and each whole page cut into parts.

## Judge

A fresh session (thread "Judge two marketing home pages", Opus 5.5, medium) given only the pairs and the criteria in visual-check step 4, plus hierarchy, the two-sided pitch, typography, spacing, rhythm and polish. It did not know which set was ours. The Agent hook refused running the judge as a subagent on Opus (subagents are helpers on the helper model), so the coordinator started the session instead.

**Verdict: set B looks amateur; set A is clearly better (judge's confidence about 90%).** It credited B with pitching both sides more plainly in words.

## Key

A = the reference home page. **B = ours.**

## The gap named for ours

**The section wall after the hero** (B at 1280 part 02; 375 parts 03 and 04). Price, How it works, Bring your fans, Safe to play and Makers' pay run one after another in a narrow centred column on one dark-green background, with no pictures, no change of background and the same heading style, told apart only by a small grey "For makers" or "For players" label. Nothing shows where one section ends and the next begins.

The gap the judge named for the reference: its first screen pitches only riders; the drivers' side waits until you scroll, and at 375 a promo banner takes about a fifth of the first screen. Ours does better there: the hero names both sides on the first screen.

## Fix brief (one, within the slice's scope)

Make each section after the hero read as its own block. Only `/about` changes; the words stay as they are in `src/routes/about/sections.ts`.

Acceptance criteria (each observable on the shots at 320, 375, 810 and 1280):

1. Every section after the hero sits on its own full-width band, and two touching bands never share a background: the dark green alternates with one lighter tint or cream already in, or derived from, the page's colours, at contrast of 4.5:1 or more for body text on each band.
2. Each band has at least 96px of padding above and below at 1280 and 810, and at least 64px at 375 and 320.
3. The price block and "How it works" span the content width the hero uses, not the narrow centred column.
4. Each "For makers" or "For players" section carries one picture beside it (beside at 810 and up, above at 375 and under), using only what the product already has: a still from a live game's clip, or a shot of a maker page. No new stock images, no new dependency.
5. Nothing else on the page moves: hero, the two pitch cards, the closing cards and the footer are pixel-identical to f2f06ca outside the bands they touch.
6. Checks: the /about journey passes; the visual-check last look (step 3) runs again on /about at the four sizes. The blind judge does not run again.

Tries and lane: the tries in Settings; lane 2 for the landing page as before.

## Notes (not part of the fix)

The judge's other shortfalls for ours, worst first, for the owner's first look and later rounds; none is a criterion here:

1. The header is not a bar: underlined links under the logo; the "New: how to get your game on…" link wraps to two lines in a faded colour; at 320 "Sign in" drops to its own line.
2. The buttons disagree: filled blue, outlined blue, outlined white "Join"; full width at 375 only at the end. The blue clashes with the green (changing the accent colour is a product choice).
3. The price block is four near-black cards on dark green, every line in the display font, with the weakest button on the page.
4. The makers' story is split across three places (maker card, Bring your fans, Makers' pay); maker bullets wrap to three or four lines at 375.
5. At 1280 a wide gap sits between hero text and clip, lines run about 90 characters, the description sits tight under the headline, and the footer ends with two link lists and nothing to close the page.

## Limits

- The reference keeps two small logo stickers inside two photos, and its brand colour; the judge was told not to guess the products, and its report names neither.
- The reference was masked by wrapping words in coloured spans, which can move a line break; ours was masked without touching the page.
- Only the landing page was judged; join, sign-in, help and You have no matching page on the reference.
