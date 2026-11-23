# The landing page (/about): design review, round 3 (the bolder page)

- Commit examined: 155b1de (branch claude/project-thread-2vpwcj, PR #333). This audit is committed directly on 155b1de.
- Written: 2026-11-22 17:21 UTC
- Reviewer: fresh session, Opus 5.5, medium (Settings, design review round 3).
- What it is judged against: the owner, 2026-11-22 17:01 UTC, on round 2: "It just feels so boring to me"; 17:02 UTC: "Keep same font and colors, but make it much bolder and more interesting; keep it tasteful though - it should make people stop in their tracks and become immediately aware this is nothing like our competitors, I'm also not a fan of how often we use the text with underline for buttons". So: (1) is it exciting, does it stop you, unlike competitors, still tasteful; (2) same fonts and colours as the app; (3) no underlined text acting as a button; (4) the usual spacing, size and word checks, and frosted glass for anything see-through. Plus the acceptance criteria in docs/superpowers/specs/2026-11-22-landing-page-design.md.
- What ran: the diff of 155b1de read in full (`look.css`, `about/+page.svelte`, `about/+page.server.ts`, the spec line, two tests). The /about pictures in /mnt/project-files/design-loop/landing-page/round-3-155b1de/ looked at one by one (whole page at 375 and 1280, first screen at 320, 375, 810 and 1280), side by side with the last-look pictures at 7c2c189. The dark-clip question was settled by a reproduction: a page with the same video markup (one rotated hero clip, a 12-clip reel with the same `#t=` moments, three wide clips at 3, 7 and 11 seconds) fed Floor Fifty's real clips from media.ruken.dev, served with byte ranges as the shooting script does, in the container's headless Chromium at 1280 by 800.
- What did not run: the app itself, the tests and the walk. The /join, /sign-in, /me and /help pictures were not re-judged: 155b1de does not touch them (round 2 passed them). The signed-in /about pictures were not compared pixel by pixel. No code changed.
- Verdict: **FAIL** at 155b1de: 3 red, 4 notes.

## The dark clips: a headless picture artifact, not a page bug

In the whole-page pictures two reel tiles (about-computer) and the "Safe to play" clip (about-computer, about-phone) are flat #111314, the clip's background colour.

The reproduction shows the same thing and shows why. After every video reported `loadeddata`, all 16 were `readyState 4` and playing (their `currentTime` moving). The whole-page picture still drew the second wide clip (the one at 7 seconds, "Safe to play") as a flat dark box. Scrolled into the window, the same video drew its frame (Floor Fifty's city at 0:12.1). Chromium's whole-page capture does not always draw a frame for a playing video outside the window; a person scrolling never sees it. Not a defect. For later shots: scroll each clip into view before shooting, or shoot window by window.

## Red

**R1. The first screen is the same page as before, so it does not stop anyone.**
- UNIT: the hero and the reel: `src/routes/about/+page.svelte` (hero section, `.reel`), `src/lib/look.css` (`.about .ways`, `.about .news`, `.about .hero`, `.about .phone`, `.about .reel`).
- VERDICT: red.
- REQUIREMENT: the owner, 17:02 UTC: "much bolder and more interesting ... it should make people stop in their tracks and become immediately aware this is nothing like our competitors".
- REASON: what a stranger sees first has the same shape as the round the owner called boring. The headline is bigger, the links are boxes and the clip leans 3 degrees. The one new moving thing, the reel, sits below the first screen at 1280 and on every phone.
- EVIDENCE: about-top-computer at 155b1de next to last-look-7c2c189/about-top-computer: same order (name, links, news line, headline left, one clip right, blue button), same places. The reel starts at y=832 CSS px in an 800-high window. about-top-phone and about-top-320: no moving picture on the first screen. On 320 the logo, three link boxes and a three-line news box fill the top 276 of 640 px before the headline. about-top-tablet: the reel shows, but the headline is smaller than on the phone (about 3rem, the tablet override).
- EXPECTED: on the first screen at every size, the moving clips are the main picture and the headline sits on or against them, so the page reads "a wall of games, playing" before it reads "a website". A first look should not be mistaken for the round-2 page.
- FIX (same fonts and colours, nothing new to install): make the hero one full-bleed block. The reel runs as two or three tall rows (or tilted columns) of the clips, filling the hero behind or beside the headline and starting at the top of the first screen. The headline goes on top at up to about 7rem on a computer and 3rem on a 320 phone, on a solid felt panel or a frosted panel (the glass rule) where it overlaps clips. "Watch the feed" stays under it. Move the three link boxes and the news box into one row under the name (on a phone: the links as one row of small boxes, the news under the blue button), so the headline starts in the top third of a 320 screen. Drop the separate leaning phone clip, or make it the first clip of the wall. Only `src/routes/about/+page.svelte`, `src/routes/about/+page.server.ts` (if the reel needs more clips) and the `.about` rules in `src/lib/look.css`.
- Check: about-top-* at all four sizes show moving clips filling at least half the first screen and the whole headline. A fresh reviewer, shown the round-2 and the new first screens unlabelled, says they look like different pages.

**R2. Sixteen full-size videos play at once.**
- UNIT: `src/routes/about/+page.svelte` (reel and band `<video>`s), `src/routes/about/+page.server.ts` (`REEL_LEAST`).
- VERDICT: red.
- REQUIREMENT: the owner's rule of an app feel at all times; `quiet-video.ts`'s own promise that a video plays "only where a person would not mind".
- REASON: with one live game the page holds 16 videos (1 hero, 12 reel copies, 3 bands), and every one starts playing on load, on or off screen. Floor Fifty's clips are 1080x1920 and 1920x1080, H.264 High@5.0, 18.8 MB and 26.6 MB. `mayAutoplay` lets an iPhone play them all (Safari reports no memory figure).
- EVIDENCE: the reproduction above: 31 range requests and 529.1 MB served to one 1280-wide page in about 13 seconds; all 16 videos playing at once, 13 of them off screen.
- EXPECTED: only clips a person can see are playing and fetching; the reel holds each distinct clip once per copy.
- FIX: an action (or an option on `quietVideo` used only on /about) that plays a video while it is on screen and pauses it off screen (IntersectionObserver), with `preload="none"` until it is near the window. The reel repeats a short feed only as far as it needs to fill its width once. Only `src/routes/about/+page.svelte`, `src/routes/about/+page.server.ts` and a new or changed file in `src/lib/` with its unit test.
- Check: in the same page at 1280, no more than the clips in the window are playing (count `!paused` from the page), and bytes fetched in the first 10 seconds are under 60 MB.

**R3. The step words do not line up.**
- UNIT: `src/lib/look.css`, `.about .steps li` and `li::before`.
- VERDICT: red.
- REQUIREMENT: the usual spacing check (`visual-check` step 1).
- REASON: each step is its own grid with an `auto` number column, so the words move with the width of the digit.
- EVIDENCE: about-phone, "How Ruken works": step 1's words start at about x=53 CSS px, step 2's and step 3's at about x=65, a 12 px jag. The same jag shows at 1280 (step 1 words at x=101, the "1" being narrower than the "2" and "3").
- EXPECTED: all three steps' words start at the same x.
- FIX: a fixed number column (for example `grid-template-columns: 2.5rem 1fr`) or `font-variant-numeric: tabular-nums` with a set `min-width` on `li::before`. Only that rule in `src/lib/look.css`.

## What passes

| Check | Result | Evidence |
| --- | --- | --- |
| Same fonts and colours (2) | PASS | The headline serif and the text sans as before; felt, dusky green, sage, the blue button, paper cards. No new colour or face in the diff. |
| No underlined text as a button (3) | PASS | The top links and the news line are boxes. "Help for makers", "See the price", "Make your page", "Read the maker agreement" and "Floor Fifty" are bold words with an arrow, never underlined (`text-decoration: none` in `.about a.more`). The foot links underline only on hover, as a site footer does. |
| Tasteful | PASS | Calm motion (60 s loop, stopped for reduced motion), one blue button, no clutter added. |
| See-through surfaces (glass rule) | PASS | Nothing is see-through: the boxes, panels and cards are solid. |
| Sideways overflow | PASS | Every picture is exactly its window wide; the reel is clipped by its own `overflow: hidden`. |
| Tab title | PASS | Base title, like every screen (#320); the journey checks it. |
| Words | PASS | No copy changed apart from the arrows. |

## Notes (ideas, not defects)

1. With one live game (today) the reel is Floor Fifty twelve times, each a few seconds apart. It reads as a repeat, not a feed. When the wall in R1 is built, a short feed could show fewer, bigger clips rather than more copies.
2. The upright clip carries a dark strip in its own pixels at the bottom (and the wide clip at the top). In the leaning hero frame it reads as a chin under the picture. A tighter crop in the frame (`object-position`, or a slightly larger scale) would hide it.
3. On a 320 phone the news box wraps to three lines with "step" alone on the last. Shorter words ("New: put your game on Ruken, step by step") or putting it under the blue button would fix both the wrap and the height it takes.
4. "One price. Every game." sits about 20 px above its panels at 1280, tighter than every other band's heading-to-content gap.
