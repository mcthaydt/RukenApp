# Design review, round 1: phones held sideways and the bar on every screen

- Reviewed: branch `claude/project-thread-qlb5o2` at code head **941ac7c** (live file at fbb1b99, which changes only the live file).
- Reviewer: fresh session, Fable 5.2, medium. Written 2026-11-22 22:37 UTC.
- Verdict: **941ac7c PASS**, no red, 6 notes. The pass rests on two things this session could not do itself, named under "What did not run".

The owner approved the look at 941ac7c during this review (22:27 UTC, "this is good to go"), so this review is kept to real defects: broken layout, accessibility, regressions and rule violations. Taste ideas are left out.

## What the owner asked for, and what I found

| Asked | Found |
| --- | --- |
| The bar on every page but the landing page, the play screen and the add-a-game question steps | Holds. Bar present on 22 kinds of screen I opened, absent on `/g/[game]/play`, `/make/new`, `/make/[game]/name`. `NO_BAR` in `src/routes/+layout.svelte` lists the rest of the step screens. `/about` does not exist on this branch (note 1). |
| Sideways, the bar stands along the right edge | Holds at 667x375, 844x390, 932x430, and at three smaller windows I added (667x320, 568x320, 740x360): the bar is a 64 by 176 column, centred on the height, wholly in the window, each of its three places at least 56 by 52. |
| Every screen sized right sideways | Holds. No sideways scroll, no heading over 36px, nothing of any screen under the bar (measured on every screen at all six sizes). Share stands under the bar on its centre line, 48 by 48, in the window even at 320 tall. |
| Is it exciting? | The feed sideways is: the clip has the whole window and the words keep to one corner. The card screens are tidy rather than exciting. The owner has seen and approved them. |

Owner rules: no "Loading..." text added; nothing new is underlined that was not before; Share now reads the glass tokens (`tests/lib/glass.test.ts` passes). The bar itself is still a solid colour (`rgb(17, 19, 20)`, `backdrop-filter: none`), as on `main`; that is the queued glass work, not this change.

## What ran

- Looked at all 57 "after" pictures on the screens page (19 screens at 3 sizes) one by one at 18a5e62, and 6 "before" pictures to tell a regression from something older. 941ac7c changes only `Feed.svelte` and its journey since then, so I shot the feed again myself at 941ac7c and did not re-read the other 54.
- `tests/browser/sideways-phone.test.ts` and `tests/browser/bar.test.ts` at 941ac7c, tablet and computer projects: 40 passed, 12 skipped (the computer project skips the sideways journeys by design).
- `tests/lib/glass.test.ts` and `tests/loading-states.test.ts`: 50 passed.
- My own probe (`2026-11-22-sideways-phone-and-bar-1-probe.test.ts.txt`, its last form; earlier forms measured every screen at six sideways sizes and at 375x667, 1024x768 and 1280x720 with each screen scrolled to its end).

## What did not run

- **Safari's engine.** The phone project is WebKit and this container has no WebKit (`Executable doesn't exist at /opt/pw-browsers/webkit-2359`). The builder's live file also names only "tablet, computer" for its full run. So the engine every iPhone uses has not run these journeys anywhere yet. The pull request's CI must be green on the phone pieces before this pass counts.
- The notch. `src/app.html` has no `viewport-fit=cover`, so every `env(safe-area-inset-*)` in this change is 0 and Safari keeps the page clear of the notch by itself. Nothing is broken; the insets only start to matter if `viewport-fit=cover` is ever added.

## Notes (none blocks; each is recorded, not fixed here unless the builder is already in the file)

**1. The landing page rule cannot be checked on this branch.**
UNIT: `src/routes/+layout.svelte` (`NO_BAR`), `tests/browser/bar.test.ts`. VERDICT: note. REQUIREMENT: owner, 2026-11-22: no bar on the landing page. REASON: `/about` is in `NO_BAR` but the route arrives with #333; here `/about` is the "We can't find that page" card, with the bar. No journey names `/about`. EVIDENCE: probe, `anon 667x375 /about`: h1 "We can't find that pag…", bar at 591,100. EXPECTED: when #333 is merged in, the bar is absent on the landing page and a journey says so. FIX: on that merge, add `/about` to the "no bar" list in `tests/browser/bar.test.ts` and confirm the landing route's id is exactly `/about`. Files: `tests/browser/bar.test.ts` only.

**2. Upright phone: a card that just fills the window ends under the bar.**
UNIT: `src/lib/look.css` (`:root:has(nav.bar) :is(main.card, .screen)`). VERDICT: note (low). REQUIREMENT: the rule's own comment: a screen with the bar "ends its last line clear above it". REASON: at 375x667, signed out, `/join` does not scroll and the card's foot sits 15px behind the bar; "Not now" is fully readable, its tap box touches the bar by 1px. New with this change (`/join` had no bar before). EVIDENCE: probe: bar top 595, `main` bottom 610, "Not now" 548 to 596. EXPECTED: the card ends above 595. FIX: reserve the room with padding on the scrolling box instead of a bottom margin that falls out of it, for example `:root:has(nav.bar) body { padding-bottom: … }` in place of the margin. Files: `src/lib/look.css`, and a line in `bar.test.ts` for `/join` at the phone size.

**3. Upright phone: "Take my page down" reaches 6px under the bar.**
UNIT: `src/routes/make/page/+page.svelte`, `src/lib/look.css`. VERDICT: note (low). REASON: with the screen scrolled to its end at 375x667 and 320x640, the link's 48px tap box runs from 553 to 601 and the bar starts at 595. The words are clear of the bar; only the lowest 6px of the tap box is covered. New with this change (this screen had its own pinned bar before). EVIDENCE: probe, `/make/page`. EXPECTED: the whole tap box above the bar. FIX: the same fix as note 2 covers it if the reserve grows by 8px. Files: `src/lib/look.css`.

**4. Sideways, Sign in's button is still below the first screen.**
UNIT: `src/lib/look.css` (the two-column card). VERDICT: note. REQUIREMENT: `visual-check` step 1, main action visible without scrolling. REASON: the form beside the heading is a clear gain on `main`, but with three fields the button's foot is at 440px: 65px below a 375 window, 50px below 390, 10px below 430. Change your password, Forgot your password and Join to play do fit. Not a regression. EVIDENCE: probe, `/sign-in`: button 392 to 440 at every sideways size. FIX (if wanted later): Country and Phone number side by side on a sideways phone. Files: `src/lib/look.css`.

**5. Existing tests changed; the pull request must name them.**
UNIT: the pull request body. VERDICT: note. REQUIREMENT: `review`: a pull request that changes an existing test names each one and why. EVIDENCE: `bar.test.ts` turns seven "no bar" checks into "the bar" checks and drops the play screen from that list into a new test; `adults-only.test.ts` presses Tab four times where it pressed once; `player-count.test.ts` allows 18 Tabs where it allowed 15. All three follow from the bar being first in Tab order on more screens, which is the change itself. EXPECTED: the body lists the three files and that reason.

**6. Older things seen on the way, not from this change.**
VERDICT: note, follow-ups. (a) Underlined text links on most card screens ("Forgot your password?", "Back to Ruken", "Join", Change/Down/Hide/Remove): the owner's no-underline rule, already the job of #345. (b) The bar is a solid colour, not glass: the queued glass work. (c) "Your links": the heading touches the first card and the cards touch each other (same on `main` 726fc66). (d) A maker's page sideways sits left of centre (same on `main`). (e) "Delete your account?" opens scrolled 44px because "Keep my account" takes focus (same on `main`). (f) Help, Privacy and Terms now have three ways home: the wordmark, "Back to Ruken" and Home in the bar.
